#!/usr/bin/env node
/**
 * パネマジチェッカー スクレイピングスクリプト
 *
 * 使い方:
 *   node scripts/scrape.mjs shops              # 店舗一覧を取得
 *   node scripts/scrape.mjs girls              # 全店舗の女性データ取得
 *   node scripts/scrape.mjs girls --resume     # 中断した続きから再開
 *   node scripts/scrape.mjs all                # shops → girls を連続実行
 *
 * ?nenrei=y パラメータでページ1のみアクセス可能。
 * エリア別・サブエリア別にアクセスして全店舗を網羅する。
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_PATH = path.join(PROJECT_ROOT, 'scrape-progress.json');

const BASE = 'https://www.cityheaven.net';
const DELAY_MIN = 1200;
const DELAY_JITTER = 500;
const MAX_RETRIES = 3;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en;q=0.9',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

async function fetchPage(url) {
  const fetchUrl = url.includes('?') ? url + '&nenrei=y' : url + '?nenrei=y';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(fetchUrl, { headers: HEADERS });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      if (html.length < 10000 && html.includes('img.cityheaven.net/cs/nenrei')) {
        throw new Error('Age verification redirect');
      }
      return html;
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
}

// ─── パーサー ────────────────────────────────────────

function parseShopList(html) {
  const shops = [];
  const shopRegex = /<a[^>]*class="shop_title_shop"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const catRegex = /<[^>]*class="shop_title_gyousyu"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/gi;
  const shopMatches = [...html.matchAll(shopRegex)];
  const catMatches = [...html.matchAll(catRegex)];

  for (let i = 0; i < shopMatches.length; i++) {
    const href = shopMatches[i][1];
    const rawName = shopMatches[i][2].replace(/<[^>]*>/g, '').split('\n').map(s => s.trim()).filter(s => s)[0] || '';
    if (!rawName) continue;

    let category = '', area = '';
    if (catMatches[i]) {
      const parts = catMatches[i][1].replace(/<[^>]*>/g, '').split('\n').map(s => s.trim()).filter(s => s);
      category = parts[0] || '';
      area = parts.length >= 2 ? parts[parts.length - 1].replace(/[()]/g, '') : '';
    }

    const fullHref = href.startsWith('http') ? href : BASE + href;
    shops.push({ name: rawName, href: fullHref, category, area });
  }
  return shops;
}

function parseSubAreas(html, parentAreaCode) {
  const pattern = new RegExp(`/tokyo/${parentAreaCode}/A\\d+/`, 'g');
  const matches = html.match(pattern) || [];
  return [...new Set(matches)];
}

function parseGirlList(html) {
  const girls = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(liRegex)) {
    const liHtml = match[1];
    const girlIdMatch = liHtml.match(/girlid-(\d+)/);
    if (!girlIdMatch) continue;

    const textMatch = liHtml.match(/<[^>]*class="girllisttext"[^>]*>([\s\S]*?)<\/div>/i);
    if (!textMatch) continue;

    const text = textMatch[1].replace(/<[^>]*>/g, '');
    const lines = text.split('\n').map(s => s.trim()).filter(s => s);
    if (lines.length < 1) continue;

    const name = lines[0].replace(/\s*(更新|NEW|新人).*$/, '').trim();
    const statsLine = lines[1] || '';
    const ageMatch = statsLine.match(/(\d+)歳/);
    const heightMatch = statsLine.match(/T(\d+)/);
    const sizeMatch = statsLine.match(/(\d+)\s*[（(](\w+)[）)]\s*[･・]\s*(\d+)\s*[･・]\s*(\d+)/);

    girls.push({
      name, sourceId: girlIdMatch[1],
      age: ageMatch ? parseInt(ageMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1]) : null,
      bust: sizeMatch ? parseInt(sizeMatch[1]) : null,
      cup: sizeMatch ? sizeMatch[2] : null,
      waist: sizeMatch ? parseInt(sizeMatch[3]) : null,
      hip: sizeMatch ? parseInt(sizeMatch[4]) : null,
    });
  }
  return girls;
}

// ─── ヘルパー ────────────────────────────────────────

function normalizeName(name) {
  return name.normalize('NFKC').replace(/[\s　]+/g, '').replace(/[☆★♡♥～〜・]/g, '').trim();
}

function slugify(name) {
  const map = {
    '新宿': 'shinjuku', '歌舞伎町': 'shinjuku', '池袋': 'ikebukuro',
    '渋谷': 'shibuya', '五反田': 'gotanda', '目黒': 'gotanda',
    '鶯谷': 'uguisudani', '日暮里': 'uguisudani', '上野': 'ueno', '浅草': 'ueno',
    '品川': 'shinagawa', '大井町': 'shinagawa',
    '錦糸町': 'kinshicho', '亀戸': 'kinshicho',
    '立川': 'tachikawa', '八王子': 'tachikawa', '吉原': 'yoshiwara',
    '赤坂': 'roppongi', '六本木': 'roppongi',
    '新橋': 'shinbashi', '銀座': 'shinbashi',
    '大塚': 'otsuka', '巣鴨': 'sugamo', '駒込': 'otsuka', '赤羽': 'otsuka',
    '蒲田': 'kamata', '大森': 'kamata', '大井': 'kamata',
    '町田': 'machida', '吉祥寺': 'kichijoji', '府中': 'kichijoji',
    '秋葉原': 'akihabara', '神田': 'akihabara',
    '築地': 'tsukiji', 'お台場': 'tsukiji',
    '板橋': 'itabashi', '東武': 'itabashi',
    '飯田橋': 'iidabashi', '市ヶ谷': 'iidabashi',
    '東京': 'tokyo-st', '日本橋': 'tokyo-st',
    '東急': 'tokyu', '京王': 'keio', '小田急': 'keio',
    '西武': 'seibu', '国分寺': 'kokubunji', '国立': 'kokubunji',
    '西東京': 'nishi-tokyo', '福生': 'fussa', '青梅': 'fussa',
    '伊豆': 'izu', '小笠原': 'izu',
  };
  for (const [k, v] of Object.entries(map)) {
    if (name.includes(k)) return v;
  }
  return 'area_' + Buffer.from(name).toString('hex').slice(0, 8);
}

// ─── DB ─────────────────────────────────────────────

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS shops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, area_id INTEGER NOT NULL, category TEXT NOT NULL DEFAULT 'デリヘル', description TEXT, source_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (area_id) REFERENCES areas(id));
    CREATE TABLE IF NOT EXISTS girls (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, shop_id INTEGER NOT NULL, age INTEGER, height INTEGER, bust INTEGER, waist INTEGER, hip INTEGER, cup TEXT, image_url TEXT, source_id TEXT, is_active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (shop_id) REFERENCES shops(id));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_girls_source_id ON girls(source_id) WHERE source_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, girl_id INTEGER NOT NULL, visit_date TEXT NOT NULL, panel_rating TEXT NOT NULL CHECK(panel_rating IN ('panel_match','panel_diff','jirai')), comment TEXT, browser_id TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (girl_id) REFERENCES girls(id));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique ON reviews(girl_id, browser_id);
  `);

  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  const sc = cols('shops');
  if (!sc.includes('is_active')) db.exec('ALTER TABLE shops ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!sc.includes('last_seen_at')) db.exec('ALTER TABLE shops ADD COLUMN last_seen_at TEXT');
  const gc = cols('girls');
  if (!gc.includes('source_id')) db.exec('ALTER TABLE girls ADD COLUMN source_id TEXT');
  if (!gc.includes('is_active')) db.exec('ALTER TABLE girls ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!gc.includes('last_seen_at')) db.exec('ALTER TABLE girls ADD COLUMN last_seen_at TEXT');

  return db;
}

// ─── Phase 1: 店舗スクレイピング ──────────────────────

const AREAS = {
  'A1304': { name: '新宿・歌舞伎町', slug: 'shinjuku' },
  'A1305': { name: '池袋', slug: 'ikebukuro' },
  'A1303': { name: '渋谷', slug: 'shibuya' },
  'A1317': { name: '五反田・目黒', slug: 'gotanda' },
  'A1315': { name: '品川', slug: 'shinagawa' },
  'A1316': { name: '蒲田・大井', slug: 'kamata' },
  'A1311': { name: '吉原', slug: 'yoshiwara' },
  'A1312': { name: '上野・鶯谷', slug: 'ueno' },
  'A1313': { name: '錦糸町・小岩', slug: 'kinshicho' },
  'A1314': { name: '築地・お台場', slug: 'tsukiji' },
  'A1301': { name: '新橋・銀座', slug: 'shinbashi' },
  'A1310': { name: '秋葉原・神田', slug: 'akihabara' },
  'A1302': { name: '東京・日本橋', slug: 'tokyo-st' },
  'A1307': { name: '六本木・赤坂', slug: 'roppongi' },
  'A1309': { name: '飯田橋・市ヶ谷', slug: 'iidabashi' },
  'A1318': { name: '東急沿線', slug: 'tokyu' },
  'A1319': { name: '京王・小田急沿線', slug: 'keio' },
  'A1322': { name: '西武沿線', slug: 'seibu' },
  'A1323': { name: '板橋・東武沿線', slug: 'itabashi' },
  'A1324': { name: '大塚・巣鴨', slug: 'otsuka' },
  'A1326': { name: '国分寺・国立', slug: 'kokubunji' },
  'A1329': { name: '西東京', slug: 'nishi-tokyo' },
  'A1321': { name: '吉祥寺・府中', slug: 'kichijoji' },
  'A1330': { name: '立川・八王子', slug: 'tachikawa' },
  'A1331': { name: '福生・青梅', slug: 'fussa' },
  'A1332': { name: '伊豆諸島', slug: 'izu' },
};
const AREA_CODES = Object.keys(AREAS);

async function scrapeShops(db) {
  console.log('\n━━━ Phase 1: 店舗一覧スクレイピング ━━━\n');

  const now = new Date().toISOString();
  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name, slug) VALUES (?, ?)');
  const getAreaByName = db.prepare('SELECT id FROM areas WHERE name = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1, name = ?, category = ? WHERE id = ?');
  const updateShopUrl = db.prepare('UPDATE shops SET source_url = ?, last_seen_at = ?, is_active = 1 WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalReconciled = 0;
  const seenHrefs = new Set();

  // Collect all seed shops once
  const seedShops = db.prepare('SELECT id, name FROM shops WHERE source_url IS NULL').all();
  const seedMap = new Map(seedShops.map(s => [normalizeName(s.name), s.id]));

  // Pre-create all areas
  for (const [code, info] of Object.entries(AREAS)) {
    insertArea.run(info.name, info.slug);
  }

  for (const areaCode of AREA_CODES) {
    const areaInfo = AREAS[areaCode];
    try {
      process.stdout.write(`📍 ${areaInfo.name}... `);
      const html = await fetchPage(`${BASE}/tokyo/${areaCode}/`);
      const shops = parseShopList(html);

      const subAreas = parseSubAreas(html, areaCode);
      let extraShops = [];

      if (shops.length >= 30 && subAreas.length > 0) {
        process.stdout.write(`(${shops.length}件, ${subAreas.length}サブエリア) `);
        for (const subPath of subAreas) {
          try {
            await delay();
            const subHtml = await fetchPage(`${BASE}${subPath}`);
            const sub = parseShopList(subHtml);
            extraShops.push(...sub);
          } catch {}
        }
      }

      const allShops = [...shops, ...extraShops];
      let areaNew = 0, areaUpdated = 0;

      // Use the area from AREAS mapping
      const areaRow = getAreaByName.get(areaInfo.name);
      const areaId = areaRow ? areaRow.id : 1;

      for (const shop of allShops) {
        if (seenHrefs.has(shop.href)) continue;
        seenHrefs.add(shop.href);

        const existing = getShopByUrl.get(shop.href);
        if (existing) {
          updateShopSeen.run(now, shop.name, shop.category || 'デリヘル', existing.id);
          totalUpdated++;
          areaUpdated++;
          continue;
        }

        // Try seed reconciliation
        const nName = normalizeName(shop.name);
        if (seedMap.has(nName)) {
          const seedId = seedMap.get(nName);
          updateShopUrl.run(shop.href, now, seedId);
          seedMap.delete(nName);
          totalReconciled++;
          continue;
        }

        insertShop.run(shop.name, areaId, shop.category || 'デリヘル', shop.href, now);
        totalNew++;
        areaNew++;
      }

      console.log(`${allShops.length}件 (新規:${areaNew} 更新:${areaUpdated})`);
      await delay();
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  const deactivated = db.prepare('UPDATE shops SET is_active = 0 WHERE source_url IS NOT NULL AND (last_seen_at IS NULL OR last_seen_at < ?)').run(now);
  const total = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get();

  console.log(`\n✅ 店舗スクレイピング完了`);
  console.log(`   新規: ${totalNew} | 更新: ${totalUpdated} | シード照合: ${totalReconciled} | 非アクティブ化: ${deactivated.changes}`);
  console.log(`   ユニーク店舗数: ${seenHrefs.size} | アクティブ店舗数: ${total.c}`);
}

// ─── Phase 2: 女性スクレイピング ──────────────────────

function loadProgress() { try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8')); } catch { return null; } }
function saveProgress(data) { fs.writeFileSync(PROGRESS_PATH, JSON.stringify(data, null, 2)); }
function clearProgress() { try { fs.unlinkSync(PROGRESS_PATH); } catch {} }

async function scrapeGirls(db, resume = false) {
  console.log('\n━━━ Phase 2: 女性データスクレイピング ━━━\n');

  const now = new Date().toISOString();
  let lastShopId = 0;
  if (resume) {
    const p = loadProgress();
    if (p?.lastShopId) { lastShopId = p.lastShopId; console.log(`🔄 再開 (shop_id > ${lastShopId})`); }
  }

  const shops = db.prepare(`SELECT id, name, source_url FROM shops WHERE source_url IS NOT NULL AND is_active = 1 AND id > ? ORDER BY id`).all(lastShopId);
  console.log(`📋 対象: ${shops.length} 店舗\n`);

  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const reconcileGirl = db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalReconciled = 0, totalDeactivated = 0;
  let shopsDone = 0;
  const errors = [];

  for (const shop of shops) {
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      process.stdout.write(`[${shopsDone + 1}/${shops.length}] ${shop.name}... `);
      const html = await fetchPage(girlListUrl);
      let allScraped = parseGirlList(html);

      // Check for page 2 if 100 girls found
      if (allScraped.length >= 100) {
        try {
          await delay();
          const html2 = await fetchPage(girlListUrl.replace(/\/$/, '') + '/p2/');
          allScraped = [...allScraped, ...parseGirlList(html2)];
        } catch {}
      }

      const seenIds = new Set();
      let sNew = 0, sUpd = 0, sRec = 0;

      const tx = db.transaction(() => {
        for (const girl of allScraped) {
          seenIds.add(girl.sourceId);
          const ex = getGirlBySourceId.get(girl.sourceId);
          if (ex) {
            const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height ||
              ex.bust !== girl.bust || ex.cup !== girl.cup || ex.waist !== girl.waist || ex.hip !== girl.hip;
            if (changed) updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, ex.id);
            else markSeen.run(now, ex.id);
            sUpd++; continue;
          }
          const seed = getGirlByNameShop.get(girl.name, shop.id);
          if (seed) {
            reconcileGirl.run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, seed.id);
            sRec++; continue;
          }
          insertGirl.run(girl.name, shop.id, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.sourceId, now);
          sNew++;
        }
        // Deactivate unseen
        if (seenIds.size > 0) {
          const ph = [...seenIds].map(() => '?').join(',');
          return db.prepare(`UPDATE girls SET is_active = 0 WHERE shop_id = ? AND source_id IS NOT NULL AND is_active = 1 AND source_id NOT IN (${ph})`).run(shop.id, ...seenIds).changes;
        }
        return 0;
      });

      const deact = tx();
      console.log(`${allScraped.length}人 (新:${sNew} 更新:${sUpd} 照合:${sRec} 退店:${deact})`);
      totalNew += sNew; totalUpdated += sUpd; totalReconciled += sRec; totalDeactivated += deact;
    } catch (e) {
      console.log(`❌ ${e.message}`);
      errors.push({ shopId: shop.id, name: shop.name, error: e.message });
    }

    shopsDone++;
    saveProgress({ lastShopId: shop.id, timestamp: now, shopsDone, shopsTotal: shops.length });
    await delay();
  }

  clearProgress();
  const total = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
  console.log(`\n✅ 女性スクレイピング完了`);
  console.log(`   新規: ${totalNew} | 更新: ${totalUpdated} | 照合: ${totalReconciled} | 退店: ${totalDeactivated}`);
  if (errors.length > 0) console.log(`   エラー: ${errors.length} 店舗`);
  console.log(`   アクティブ女性数: ${total.c}`);
}

// ─── メイン ─────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const resume = args.includes('--resume');

  console.log('╔══════════════════════════════════════╗');
  console.log('║   パネマジチェッカー スクレイパー    ║');
  console.log('╚══════════════════════════════════════╝');

  const db = openDb();
  try {
    if (command === 'shops' || command === 'all') await scrapeShops(db);
    if (command === 'girls' || command === 'all') await scrapeGirls(db, resume || command === 'all');
    if (!['shops', 'girls', 'all'].includes(command)) console.log('使い方: node scripts/scrape.mjs [shops|girls|all] [--resume]');
  } finally { db.close(); }
}

main().catch(e => { console.error('\n💀 エラー:', e.message); process.exit(1); });
