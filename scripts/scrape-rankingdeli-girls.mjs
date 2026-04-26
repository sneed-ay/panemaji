#!/usr/bin/env node
/**
 * 駅ちか (ranking-deli.jp) の shops に紐付く girls を取得
 *
 * 対象: source_url が ranking-deli を含み、girls=0 の shops
 * 使い方:
 *   node scripts/scrape-rankingdeli-girls.mjs --dry-run
 *   node scripts/scrape-rankingdeli-girls.mjs
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 1500;
const DELAY_JITTER = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);
const DRY = process.argv.includes('--dry-run');

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.error(`  retry ${i + 1}/${retries}: ${e.message}`);
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

function parseGirls(html) {
  const names = new Set();
  const re1 = /<p\s+class="girls-name[^"]*">\s*([^<]+?)\s*<\/p>/g;
  const re2 = /class="data-name\s+ellipsis"[^>]*>\s*([^<]+?)\s*</g;
  let m;
  while ((m = re1.exec(html))) {
    const n = m[1].trim().replace(/\s+/g, ' ');
    if (n.length >= 1 && n.length <= 20) names.add(n);
  }
  while ((m = re2.exec(html))) {
    const n = m[1].trim().replace(/\s+/g, ' ');
    if (n.length >= 1 && n.length <= 20) names.add(n);
  }
  return [...names];
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

const shops = db.prepare(`
  SELECT s.id, s.name, s.source_url
  FROM shops s
  WHERE s.is_active=1
    AND s.source_url LIKE '%ranking-deli%'
    AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
`).all();

console.log(`🚇 駅ちか嬢取得: ${shops.length} shops (dry-run=${DRY})\n`);

const insertGirl = db.prepare(`
  INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at)
  VALUES (?, ?, 1, datetime('now'))
`);
const findGirl = db.prepare(`
  SELECT id FROM girls WHERE shop_id=? AND name=?
`);

let totalShops = 0, totalGirlsAdded = 0, totalGirlsSkipped = 0, totalShopsWithGirls = 0;

for (const s of shops) {
  totalShops++;
  if (!s.source_url) continue;
  // /shop/[ID]/ → /shop/[ID]/girlslist/
  const girlsUrl = s.source_url.replace(/\/?$/, '/') + 'girlslist/';
  const html = await fetchPage(girlsUrl);
  if (!html) {
    if (totalShops % 20 === 0) console.log(`  [${totalShops}/${shops.length}] (skip ${s.name})`);
    await delay();
    continue;
  }
  const girls = parseGirls(html);
  if (girls.length === 0) {
    if (totalShops % 20 === 0) console.log(`  [${totalShops}/${shops.length}] (no girls ${s.name})`);
    await delay();
    continue;
  }
  if (DRY) {
    console.log(`  [${totalShops}/${shops.length}] ${s.name}: ${girls.length}名 [${girls.slice(0, 3).join(', ')}]`);
  } else {
    let added = 0, skipped = 0;
    const txn = db.transaction(() => {
      for (const g of girls) {
        const exists = findGirl.get(s.id, g);
        if (exists) { skipped++; continue; }
        insertGirl.run(g, s.id);
        added++;
      }
    });
    txn();
    totalGirlsAdded += added;
    totalGirlsSkipped += skipped;
    totalShopsWithGirls++;
    if (totalShops % 50 === 0 || added > 0) {
      console.log(`  [${totalShops}/${shops.length}] ${s.name}: +${added} (skip ${skipped})`);
    }
  }
  await delay();
}

db.close();
console.log(`\n=== 完了 ===`);
console.log(`shops処理: ${totalShops}, 嬢付き shops: ${totalShopsWithGirls}, INSERT girls: ${totalGirlsAdded}, SKIP: ${totalGirlsSkipped}`);
