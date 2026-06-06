#!/usr/bin/env node
/**
 * 会員データ非破壊・マスター同期: master(db-latest) → 本番DB
 *
 * 本番DBの shops/girls/areas を新しい master(db-latest)で UPSERT する。
 *  - 突合キー: areas=slug / shops=source_url(無ければ name+area) / girls=source_id(無ければ shop+name)
 *  - FK 連鎖は master内部id→本番id のマップで解決（NULL source_url の店舗も扱える）
 *  - 既存行は UPDATE（本番の id を温存 = reviews.girl_id 等のFKを壊さない）/ 新規は INSERT
 *  - master の active 集合に無い本番行は is_active=0（★DELETE は絶対にしない）
 *  - reviews / users / sessions / favorites には一切触れない（=会員データ完全保全）
 *  - master が異常に小さい/壊れてたら ABORT（破損 master の伝播防止）
 *  - master は別コネクション(readonly)で stream 読み（iterate中の書込busy回避 + 省メモリ）
 *
 * 使い方: node scripts/sync-master-to-prod.mjs <PROD_DB> <MASTER_DB>
 * exit:  0=成功 / 1=引数不足 / 2=master異常でABORT / 3=会員データ減少を検知(要調査)
 */
import Database from 'better-sqlite3';

const PROD = process.argv[2];
const MASTER = process.argv[3];
if (!PROD || !MASTER) {
  console.error('usage: node scripts/sync-master-to-prod.mjs <PROD_DB> <MASTER_DB>');
  process.exit(1);
}

const db = new Database(PROD);                          // 本番 (read-write)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');
const mdb = new Database(MASTER, { readonly: true });   // master (read-only / 別コネクション)

// ── サニティガード ──
const mGirls = mdb.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;
const mShops = mdb.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c;
const pGirls = db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;
const integ = mdb.prepare('PRAGMA integrity_check').get().integrity_check;
console.log(`master: girls=${mGirls} shops=${mShops} integrity=${integ} / prod girls=${pGirls}`);
if (integ !== 'ok' || mGirls < 1000 || mGirls < pGirls * 0.7) {
  console.error(`[ABORT] master が異常 (girls=${mGirls}, prod=${pGirls}, integ=${integ}) → 同期中止`);
  process.exit(2);
}

// ── 会員データ スナップショット ──
const snap = () => {
  const s = {
    reviewsTotal: db.prepare('SELECT COUNT(*) c FROM reviews').get().c,
    reviewsGenuine: db.prepare("SELECT COUNT(*) c FROM reviews WHERE browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'").get().c,
  };
  for (const [k, sql] of [
    ['reviewsUserLinked', 'SELECT COUNT(*) c FROM reviews WHERE user_id IS NOT NULL'],
    ['users', 'SELECT COUNT(*) c FROM users'],
    ['favorites', 'SELECT COUNT(*) c FROM favorites'],
    ['sessions', 'SELECT COUNT(*) c FROM sessions'],
  ]) { try { s[k] = db.prepare(sql).get().c; } catch { /* 列/表が無い環境ではスキップ */ } }
  return s;
};
const before = snap();
console.log('会員 before:', JSON.stringify(before));

// 突合キーのインデックス（冪等）。406k girls の点引きを O(n²) にしないため必須。
db.exec('CREATE INDEX IF NOT EXISTS idx_girls_source_id ON girls(source_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_girls_shop_name ON girls(shop_id, name)');
db.exec('CREATE INDEX IF NOT EXISTS idx_shops_source_url ON shops(source_url)');
db.exec('CREATE INDEX IF NOT EXISTS idx_shops_name_area ON shops(name, area_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_areas_slug ON areas(slug)');

const sync = db.transaction(() => {
  // ── 1. AREAS（slug 突合）──
  const findArea = db.prepare('SELECT id FROM areas WHERE slug = ?');
  const insArea = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, ?)');
  const updArea = db.prepare('UPDATE areas SET name=?, prefecture=?, display_order=? WHERE id=?');
  const areaIdBySlug = new Map();
  for (const a of mdb.prepare('SELECT name, slug, prefecture, display_order FROM areas').all()) {
    const ex = findArea.get(a.slug);
    if (ex) { updArea.run(a.name, a.prefecture, a.display_order, ex.id); areaIdBySlug.set(a.slug, ex.id); }
    else { const r = insArea.run(a.name, a.slug, a.prefecture, a.display_order); areaIdBySlug.set(a.slug, r.lastInsertRowid); }
  }
  for (const a of db.prepare('SELECT id, slug FROM areas').all()) if (!areaIdBySlug.has(a.slug)) areaIdBySlug.set(a.slug, a.id);

  // ── 2. SHOPS（source_url 突合 / 無ければ name+area。master内部id→本番idマップ構築）──
  db.exec('CREATE TEMP TABLE _m_s(source_url TEXT PRIMARY KEY)');
  const insMS = db.prepare('INSERT OR IGNORE INTO _m_s(source_url) VALUES (?)');
  const findShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const findShopByName = db.prepare("SELECT id FROM shops WHERE name = ? AND area_id = ? AND (source_url IS NULL OR source_url = '') LIMIT 1");
  const insShop = db.prepare('INSERT INTO shops (name, area_id, category, description, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, 1, ?)');
  const updShop = db.prepare('UPDATE shops SET name=?, area_id=?, category=?, description=?, is_active=1, last_seen_at=? WHERE id=?');
  const shopIdByMid = new Map();
  let sNew = 0, sUpd = 0;
  for (const s of mdb.prepare('SELECT s.id AS mid, s.name, s.source_url, s.category, s.description, s.last_seen_at, a.slug AS aslug FROM shops s JOIN areas a ON s.area_id=a.id WHERE s.is_active=1').all()) {
    const areaId = areaIdBySlug.get(s.aslug);
    if (!areaId) continue;
    const hasUrl = !!(s.source_url && s.source_url !== '');
    if (hasUrl) insMS.run(s.source_url);
    const ex = hasUrl ? findShopByUrl.get(s.source_url) : findShopByName.get(s.name, areaId);
    let pid;
    if (ex) { updShop.run(s.name, areaId, s.category, s.description, s.last_seen_at, ex.id); pid = ex.id; sUpd++; }
    else { const r = insShop.run(s.name, areaId, s.category, s.description, hasUrl ? s.source_url : null, s.last_seen_at); pid = r.lastInsertRowid; sNew++; }
    shopIdByMid.set(s.mid, pid);
  }
  console.log(`shops: new=${sNew} upd=${sUpd}`);

  // ── 3. GIRLS（source_id 突合 / 無ければ shop+name。shopは master内部id経由で本番id解決）──
  db.exec('CREATE TEMP TABLE _m_g(source_id TEXT PRIMARY KEY)');
  const insMG = db.prepare('INSERT OR IGNORE INTO _m_g(source_id) VALUES (?)');
  const findGirlBySrc = db.prepare('SELECT id FROM girls WHERE source_id = ?');
  const findGirlByName = db.prepare("SELECT id FROM girls WHERE shop_id = ? AND name = ? AND (source_id IS NULL OR source_id = '') LIMIT 1");
  const insGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, waist, hip, cup, image_url, source_id, is_active, last_seen_at, twitter_url) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)');
  const updGirl = db.prepare('UPDATE girls SET name=?, shop_id=?, age=?, height=?, bust=?, waist=?, hip=?, cup=?, image_url=COALESCE(image_url,?), is_active=1, last_seen_at=? WHERE id=?');
  let gNew = 0, gUpd = 0, gSkip = 0;
  for (const g of mdb.prepare('SELECT g.name, g.age, g.height, g.bust, g.waist, g.hip, g.cup, g.image_url, g.source_id, g.last_seen_at, g.twitter_url, g.shop_id AS mShopId FROM girls g WHERE g.is_active=1').iterate()) {
    const shopId = shopIdByMid.get(g.mShopId);
    if (!shopId) { gSkip++; continue; }
    const hasSrc = !!(g.source_id && g.source_id !== '');
    if (hasSrc) insMG.run(g.source_id);
    const ex = hasSrc ? findGirlBySrc.get(g.source_id) : findGirlByName.get(shopId, g.name);
    if (ex) { updGirl.run(g.name, shopId, g.age, g.height, g.bust, g.waist, g.hip, g.cup, g.image_url, g.last_seen_at, ex.id); gUpd++; }
    else { insGirl.run(g.name, shopId, g.age, g.height, g.bust, g.waist, g.hip, g.cup, g.image_url, hasSrc ? g.source_id : null, g.last_seen_at, g.twitter_url); gNew++; }
  }
  console.log(`girls: new=${gNew} upd=${gUpd} skip=${gSkip}`);

  // ── 4. 退店/退店嬢: master(active) に無い本番行を is_active=0（DELETEはしない / source 無し行は対象外）──
  const deG = db.prepare("UPDATE girls SET is_active=0 WHERE is_active=1 AND source_id IS NOT NULL AND source_id <> '' AND source_id NOT IN (SELECT source_id FROM _m_g)").run().changes;
  const deS = db.prepare("UPDATE shops SET is_active=0 WHERE is_active=1 AND source_url IS NOT NULL AND source_url <> '' AND source_url NOT IN (SELECT source_url FROM _m_s)").run().changes;
  db.exec('DROP TABLE _m_g; DROP TABLE _m_s');
  console.log(`deactivated(本番のみ・master退店分): girls=${deG} shops=${deS}`);
});

sync();

// ── 会員データ after 検証 ──
const after = snap();
console.log('会員 after :', JSON.stringify(after));
const dropped = (before.reviewsGenuine - after.reviewsGenuine) > 0
  || ((before.reviewsUserLinked ?? 0) - (after.reviewsUserLinked ?? 0)) > 0
  || ((before.users ?? 0) - (after.users ?? 0)) > 0
  || ((before.favorites ?? 0) - (after.favorites ?? 0)) > 0;
if (dropped) {
  console.error('[FATAL] 会員データが減少した! 直ちに調査・ロールバックを要する');
  process.exitCode = 3;
} else {
  console.log('✅ 会員データ完全保全を確認（genuine/userLinked/users/favorites いずれも非減少）');
}
console.log(`✅ 同期完了: shops active=${db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c}, girls active=${db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c}`);
db.pragma('wal_checkpoint(TRUNCATE)'); // WAL を本体に統合してから閉じる (デプロイ直後の app 起動に備える)
db.close();
mdb.close();
