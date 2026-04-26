#!/usr/bin/env node
/**
 * ロビンのお部屋 (soap-robin.jp) スクレイピング - ソープ特化
 *
 * 使い方:
 *   node scripts/scrape-robin.mjs --dry-run
 *   node scripts/scrape-robin.mjs
 *
 * URL: /shop/search.php?uid=&acode=NNN
 * 店舗詳細: detail.php?uid=&acode=NNN&scode=NNNNNNN
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');

const BASE = 'https://www.soap-robin.jp';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 1500;
const DELAY_JITTER = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);
const DRY = process.argv.includes('--dry-run');

// acode → prefecture マッピング (ロビンのエリアコード)
// 不明な acode は調査時にデフォルトで「-other」へ
const ACODE_PREF = {
  100: 'hokkaido', 110: 'akita', 120: 'fukushima', 130: 'aomori', 140: 'iwate', 150: 'miyagi', 160: 'yamagata', 170: 'fukushima', 180: 'fukushima', 190: 'hokkaido',
  200: 'ibaraki', 210: 'ibaraki', 220: 'tochigi', 230: 'saitama', 240: 'saitama', 250: 'chiba', 260: 'kanagawa', 270: 'kanagawa', 280: 'kanagawa', 290: 'chiba',
  300: 'tokyo', 310: 'tokyo', 320: 'tokyo', 330: 'tokyo', 340: 'tokyo', 350: 'tokyo', 360: 'tokyo', 370: 'tokyo', 380: 'tokyo', 390: 'tokyo',
  400: 'niigata', 410: 'ishikawa', 420: 'toyama', 430: 'fukui', 440: 'yamanashi', 450: 'nagano', 460: 'nagano', 470: 'nagano', 480: 'niigata', 490: 'niigata',
  500: 'aichi', 510: 'gifu', 520: 'mie', 530: 'shizuoka', 540: 'shizuoka', 550: 'aichi', 560: 'aichi', 570: 'aichi', 580: 'aichi', 590: 'aichi',
  600: 'shiga', 610: 'hyogo', 620: 'hyogo', 630: 'osaka', 640: 'osaka', 650: 'kyoto', 660: 'wakayama', 670: 'nara', 680: 'osaka', 690: 'osaka',
  700: 'okayama', 710: 'hiroshima', 720: 'yamaguchi', 730: 'tokushima', 740: 'kagawa', 750: 'ehime', 760: 'kochi', 770: 'shimane', 780: 'tottori', 790: 'okayama',
  800: 'fukuoka', 810: 'fukuoka', 820: 'saga', 830: 'kumamoto', 840: 'oita', 850: 'okinawa', 860: 'nagasaki', 870: 'kagoshima', 880: 'miyazaki', 890: 'okinawa',
};

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.error(`  retry ${i + 1}/${retries}: ${url} - ${e.message}`);
      await sleep(3000 * (i + 1));
    }
  }
  return null;
}

function parseShops(html, acode) {
  const shops = [];
  const seen = new Set();
  // <a href="detail.php?uid=&acode=NNN&scode=NNNNNNN">店舗名</a>
  const re = new RegExp(`<a\\s+href="detail\\.php\\?uid=&acode=${acode}&scode=(\\d+)">\\s*([^<]+?)\\s*</a>`, 'g');
  let m;
  while ((m = re.exec(html))) {
    const scode = m[1];
    const rawName = m[2].trim().replace(/\s+/g, ' ');
    if (!rawName || seen.has(scode)) continue;
    seen.add(scode);
    const cleaned = cleanShopName(rawName);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    shops.push({ scode, name: cleaned, rawName, url: `${BASE}/shop/detail.php?uid=&acode=${acode}&scode=${scode}` });
  }
  return shops;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');
  registerNormalizeUdf(db);

  const findShop = db.prepare(`
    SELECT s.id FROM shops s LEFT JOIN areas a ON s.area_id=a.id
    WHERE s.is_active=1 AND a.prefecture=? AND normalize_shop(s.name) = normalize_shop(?)
    LIMIT 1
  `);
  const insertShop = db.prepare(`
    INSERT INTO shops (name, area_id, category, source_url, last_seen_at)
    VALUES (?, ?, 'ソープ', ?, datetime('now'))
  `);
  const getOrCreateArea = (slug, pref) => {
    let row = db.prepare('SELECT id FROM areas WHERE slug=?').get(slug);
    if (!row) {
      const r = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, 999)').run(slug, slug, pref);
      row = { id: r.lastInsertRowid };
    }
    return row.id;
  };

  const acodes = Object.keys(ACODE_PREF).map(Number).sort((a, b) => a - b);
  console.log(`🛁 ロビン scrape: ${acodes.length} acode (dry-run=${DRY})\n`);

  let totalIns = 0, totalSkip = 0, totalFetch = 0;
  for (const acode of acodes) {
    const pref = ACODE_PREF[acode];
    if (!pref) continue;
    await delay();
    const url = `${BASE}/shop/search.php?uid=&acode=${acode}`;
    const html = await fetchPage(url);
    if (!html) continue;
    const shops = parseShops(html, acode);
    if (shops.length === 0) continue;
    totalFetch += shops.length;
    if (DRY) {
      console.log(`  acode=${acode}(${pref}): ${shops.length}件 [${shops.slice(0, 3).map((s) => s.name).join(', ')}]`);
      continue;
    }
    const tempAreaSlug = `${pref}-robin-a${acode}`;
    let inserted = 0, skipped = 0;
    const txn = db.transaction(() => {
      for (const s of shops) {
        const exists = findShop.get(pref, s.name);
        if (exists) { skipped++; continue; }
        const areaId = getOrCreateArea(tempAreaSlug, pref);
        insertShop.run(s.name, areaId, s.url);
        inserted++;
      }
    });
    txn();
    totalIns += inserted;
    totalSkip += skipped;
    console.log(`  acode=${acode}(${pref}): 取得${shops.length} INSERT${inserted} SKIP(既存)${skipped}`);
  }

  db.close();
  console.log(`\n=== 完了 ===`);
  console.log(`fetch: ${totalFetch} / INSERT: ${totalIns} / SKIP: ${totalSkip}`);
}

main().catch((e) => { console.error('❌', e.message); console.error(e.stack); process.exit(1); });
