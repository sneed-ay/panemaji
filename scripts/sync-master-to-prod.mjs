#!/usr/bin/env node
/**
 * 会員データ非破壊・マスター同期: master(db-latest) → 本番DB
 *
 * 本番DBの shops/girls/areas を新しい master(db-latest)で UPSERT する。
 *  - 突合キー: areas=slug / shops=source_url(無ければ name+area) / girls=source_id(無ければ shop+name)
 *
 *    🚨 source_url は「店の同一性」そのもの。master 側で既存店の source_url を書き換えてはいけない。
 *       書き換えると findShopByUrl が本番の既存行に当たらないので
 *         (a) 新しい URL で別の行が INSERT される
 *         (b) 元の行は _m_s に入らないため末尾の一括処理で is_active=0 にされる
 *       = 本番に重複行ができ、元の行 (reviews/shop_comments が紐づく側) が消える。
 *       掲載元リンクを変えたい場合は source_url ではなく別カラムを足すこと。
 *       girls も同様に source_id が同一性キー。
 *  - FK 連鎖は master内部id→本番id のマップで解決（NULL source_url の店舗も扱える）
 *  - 既存行は UPDATE（本番の id を温存 = reviews.girl_id 等のFKを壊さない）/ 新規は INSERT
 *  - master の active 集合に無い本番行は is_active=0（★DELETE は絶対にしない）
 *  - reviews / users / sessions / favorites には一切触れない（=会員データ完全保全）
 *  - master が異常に小さい/壊れてたら ABORT（破損 master の伝播防止）
 *  - master は別コネクション(readonly)で stream 読み（iterate中の書込busy回避 + 省メモリ）
 *  - 嬢は GIRL_BATCH 件ごとにコミットして WAL を小さく保つ (1GB ディスク。全件1トランザクションだと
 *    WAL が 116MB まで膨らみ、空き不足で同期を見送る原因になっていた / 2026-09-25)。
 *    途中で落ちても UPSERT なので次の起動でやり直せば揃う。失敗時は init-db.sh が起動時退避から戻す。
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
const GIRL_BATCH = 20000; // 1トランザクションの上限。WAL をこの件数分に抑える (1GB ディスク)

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

const syncShops = db.transaction(() => {
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
  db.exec('CREATE TEMP TABLE _m_sid(id INTEGER PRIMARY KEY)');
  const insMSid = db.prepare('INSERT OR IGNORE INTO _m_sid(id) VALUES (?)');
  // 同じ source_url の行が複数ある (重複統合の負け・嬢名で作られた店) とき、素の WHERE だと id の小さい
  // 非アクティブ行に当たり、その行を master の店名に書き換えて復活させていた (例: 本番 /shop/12915 「KIREI凛」→「ミサキ」)。
  // master と同じ id の行 → アクティブな行 → id の順で選ぶ。
  const findShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ? ORDER BY (id = ?) DESC, is_active DESC, id LIMIT 1');
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
    const ex = hasUrl ? findShopByUrl.get(s.source_url, s.mid) : findShopByName.get(s.name, areaId);
    let pid;
    if (ex) { updShop.run(s.name, areaId, s.category, s.description, s.last_seen_at, ex.id); pid = ex.id; sUpd++; }
    else { const r = insShop.run(s.name, areaId, s.category, s.description, hasUrl ? s.source_url : null, s.last_seen_at); pid = r.lastInsertRowid; sNew++; }
    shopIdByMid.set(s.mid, pid);
    insMSid.run(pid);
  }
  console.log(`shops: new=${sNew} upd=${sUpd}`);
  return shopIdByMid;
});
const shopIdByMid = syncShops();
db.pragma('wal_checkpoint(TRUNCATE)');

{
  // ── 3. GIRLS（source_id 突合 / 無ければ shop+name。shopは master内部id経由で本番id解決）──
  db.exec('CREATE TEMP TABLE _m_g(source_id TEXT PRIMARY KEY)');
  const insMG = db.prepare('INSERT OR IGNORE INTO _m_g(source_id) VALUES (?)');
  // source_id の無い嬢は名前で突き合わせるので、master に居る嬢として当たった本番 id を控えておく (末尾の退店処理用)
  db.exec('CREATE TEMP TABLE _m_gid(id INTEGER PRIMARY KEY)');
  const insMGid = db.prepare('INSERT OR IGNORE INTO _m_gid(id) VALUES (?)');
  const findGirlBySrc = db.prepare('SELECT id FROM girls WHERE source_id = ?');
  const findGirlByName = db.prepare("SELECT id FROM girls WHERE shop_id = ? AND name = ? AND (source_id IS NULL OR source_id = '') ORDER BY is_active DESC, id LIMIT 1");
  // 名前で当たらなければ、master と同じ id・同じ名前の行を使う (master で重複店を統合して嬢が別の店へ
  // 移ったとき、移動先の店では見つからず新しい行を作り、元の行も残って二重になっていた)。
  //   本番とmasterで id がずれた行を取り違えないよう、今は master に無い店 (統合で消えた店) に居る行に限る。
  const findGirlByIdName = db.prepare("SELECT id FROM girls WHERE id = ? AND name = ? AND (source_id IS NULL OR source_id = '') AND shop_id NOT IN (SELECT id FROM _m_sid)");
  const insGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, waist, hip, cup, image_url, source_id, is_active, last_seen_at, twitter_url) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)');
  const updGirl = db.prepare('UPDATE girls SET name=?, shop_id=?, age=?, height=?, bust=?, waist=?, hip=?, cup=?, image_url=COALESCE(image_url,?), is_active=1, last_seen_at=? WHERE id=?');
  let gNew = 0, gUpd = 0, gSkip = 0, gAdopt = 0;
  const adoptGirl = db.prepare("UPDATE girls SET source_id = ? WHERE id = ? AND (source_id IS NULL OR source_id = '')");
  const applyGirls = db.transaction((rows) => {
    for (const g of rows) {
      const shopId = shopIdByMid.get(g.mShopId);
      if (!shopId) { gSkip++; continue; }
      const hasSrc = !!(g.source_id && g.source_id !== '');
      if (hasSrc) insMG.run(g.source_id);
      let ex = hasSrc ? findGirlBySrc.get(g.source_id) : (findGirlByName.get(shopId, g.name) || findGirlByIdName.get(g.mid, g.name));
      // master で後から source_id が付いた嬢は、本番の source_id 無しの行に当たらず新しい行ができ、古い行
      // (口コミ・URL が付いている) が退店扱いになる。同じ店・同じ名前の source_id 無しの行があれば引き継ぐ。
      if (hasSrc && !ex) {
        const byName = findGirlByName.get(shopId, g.name);
        if (byName) { adoptGirl.run(g.source_id, byName.id); ex = byName; gAdopt++; }
      }
      let pid;
      if (ex) { updGirl.run(g.name, shopId, g.age, g.height, g.bust, g.waist, g.hip, g.cup, g.image_url, g.last_seen_at, ex.id); pid = ex.id; gUpd++; }
      else { pid = insGirl.run(g.name, shopId, g.age, g.height, g.bust, g.waist, g.hip, g.cup, g.image_url, hasSrc ? g.source_id : null, g.last_seen_at, g.twitter_url).lastInsertRowid; gNew++; }
      if (!hasSrc) insMGid.run(pid);
    }
  });
  let batch = [];
  for (const g of mdb.prepare('SELECT g.id AS mid, g.name, g.age, g.height, g.bust, g.waist, g.hip, g.cup, g.image_url, g.source_id, g.last_seen_at, g.twitter_url, g.shop_id AS mShopId FROM girls g WHERE g.is_active=1').iterate()) {
    batch.push(g);
    if (batch.length >= GIRL_BATCH) { applyGirls(batch); batch = []; db.pragma('wal_checkpoint(TRUNCATE)'); }
  }
  if (batch.length) applyGirls(batch);
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(`girls: new=${gNew} upd=${gUpd} skip=${gSkip} (source_id を引き継いだ ${gAdopt})`);
}

db.transaction(() => {
  // ── 4. 退店/退店嬢: master(active) に無い本番行を is_active=0（DELETEはしない / source 無し行は対象外）──
  const deG = db.prepare("UPDATE girls SET is_active=0 WHERE is_active=1 AND source_id IS NOT NULL AND source_id <> '' AND source_id NOT IN (SELECT source_id FROM _m_g)").run().changes;
  const deS = db.prepare("UPDATE shops SET is_active=0 WHERE is_active=1 AND source_url IS NOT NULL AND source_url <> '' AND source_url NOT IN (SELECT source_url FROM _m_s)").run().changes;
  // source_id の無い嬢 (駅ちか等) は上の source_id 判定に掛からず、master で退店しても本番では在籍のままだった
  // (2026-09-26 時点で本番の在籍嬢が master より約2.4万人多かった)。今回 master の在籍嬢として当たった行
  // (_m_gid) 以外を止める。DELETE はしないので口コミは残り、店ページの「退店した可能性のある女性」に出る。
  // 突き合わせの不具合で一度に大量に止めないよう、本番の在籍嬢の 15% を超える場合はこの処理だけ見送る。
  const staleWhere = "is_active=1 AND (source_id IS NULL OR source_id = '') AND id NOT IN (SELECT id FROM _m_gid)";
  const staleN = db.prepare(`SELECT COUNT(*) c FROM girls WHERE ${staleWhere}`).get().c;
  const activeN = db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;
  let deStale = 0;
  if (staleN > activeN * 0.15) {
    console.error(`[skip] source_id 無しの退店嬢 ${staleN}件 は在籍 ${activeN}件の15%超 → 突き合わせ異常の疑いで今回は止めない`);
  } else {
    deStale = db.prepare(`UPDATE girls SET is_active=0 WHERE ${staleWhere}`).run().changes;
  }
  console.log(`deactivated(source_id 無しで master に在籍していない嬢): girls=${deStale}`);
  // 同じ URL で master が選ばなかった本番行 (過去の同期で誤って復活させた行) を止める。DELETE はしない。
  //   その店に残った source_id の無い嬢も止める (source_id がある嬢は上で正しい店へ移っている)。
  const dupShops = "SELECT id FROM shops WHERE is_active=1 AND source_url IN (SELECT source_url FROM _m_s) AND id NOT IN (SELECT id FROM _m_sid)";
  const deDupG = db.prepare(`UPDATE girls SET is_active=0 WHERE is_active=1 AND (source_id IS NULL OR source_id = '') AND shop_id IN (${dupShops})`).run().changes;
  const deDup = db.prepare(`UPDATE shops SET is_active=0 WHERE id IN (${dupShops})`).run().changes;
  console.log(`deactivated(同じURLの選ばれなかった行): shops=${deDup} girls=${deDupG}`);
  // 以前の同期が書き換えてしまった店名を戻す: master で非アクティブな店のうち、本番に id と source_url が
  // 両方一致する行があれば master の店名にする (本番 /shop/12915 が「ミサキ」のままだった)。
  const fixName = db.prepare("UPDATE shops SET name=? WHERE id=? AND source_url=? AND is_active=0 AND name<>?");
  let sRenamed = 0;
  for (const s of mdb.prepare("SELECT id, name, source_url FROM shops WHERE is_active=0 AND source_url IS NOT NULL AND source_url <> ''").iterate()) {
    sRenamed += fixName.run(s.name, s.id, s.source_url, s.name).changes;
  }
  console.log(`店名を master に戻した非アクティブ店: ${sRenamed}`);
  // source_url の無い店は上の URL 判定に掛からないので、master で統合・閉店しても本番に残っていた。
  // master で非アクティブな店と id・店名が両方一致し、今回 master の店として当たらなかった行だけ止める。
  const offNoUrl = db.prepare("UPDATE shops SET is_active=0 WHERE id=? AND name=? AND is_active=1 AND (source_url IS NULL OR source_url = '') AND id NOT IN (SELECT id FROM _m_sid)");
  let sNoUrl = 0;
  for (const s of mdb.prepare("SELECT id, name FROM shops WHERE is_active=0 AND (source_url IS NULL OR source_url = '')").iterate()) sNoUrl += offNoUrl.run(s.id, s.name).changes;
  console.log(`deactivated(URLの無い店で master が止めたもの): shops=${sNoUrl}`);
  db.exec('DROP TABLE _m_g; DROP TABLE _m_s; DROP TABLE _m_sid; DROP TABLE _m_gid');
  console.log(`deactivated(本番のみ・master退店分): girls=${deG} shops=${deS}`);
})();

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
