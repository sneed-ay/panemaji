#!/usr/bin/env node
/**
 * ぴゅあらば (purelovers.com) の shops に紐付く girls を取得
 *
 * 対象: source_url が purelovers を含み、girls=0 の shops
 * 取得方法: shop URL に直接アクセス → 嬢一覧を alt="名前(年齢)/..." から抽出
 *
 * 使い方:
 *   node scripts/scrape-purelovers-girls.mjs --dry-run
 *   node scripts/scrape-purelovers-girls.mjs
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(2000 + Math.random() * 1500);
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

function parseGirls(html, shopId) {
  const names = new Set();
  // alt="名前(年齢)/キャッチ" パターン (嬢ID 紐付き)
  const re = new RegExp(
    `href="https://purelovers\\.com/shop/${shopId}/girl/(\\d+)/[\\s\\S]{0,3000}?alt="([^/"\\(\\n]+?)\\([0-9]+\\)`,
    'g'
  );
  let m;
  while ((m = re.exec(html))) {
    const n = m[2].trim().replace(/\s+/g, ' ');
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
    AND s.source_url LIKE '%purelovers%'
    AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
`).all();

console.log(`💗 ぴゅあらば嬢取得: ${shops.length} shops (dry-run=${DRY})\n`);

const insertGirl = db.prepare(`
  INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at)
  VALUES (?, ?, 1, datetime('now'))
`);
const findGirl = db.prepare(`SELECT id FROM girls WHERE shop_id=? AND name=?`);

let totalShops = 0, totalGirlsAdded = 0, totalShopsWithGirls = 0;

for (const s of shops) {
  totalShops++;
  if (!s.source_url) continue;
  // shopID 抽出
  const idMatch = s.source_url.match(/\/shop\/(\d+)\//);
  if (!idMatch) continue;
  const shopId = idMatch[1];
  const html = await fetchPage(s.source_url);
  if (!html) {
    if (totalShops % 30 === 0) console.log(`  [${totalShops}/${shops.length}] (skip)`);
    await delay();
    continue;
  }
  const girls = parseGirls(html, shopId);
  if (girls.length === 0) {
    if (totalShops % 30 === 0) console.log(`  [${totalShops}/${shops.length}] (no girls ${s.name})`);
    await delay();
    continue;
  }
  if (DRY) {
    console.log(`  [${totalShops}/${shops.length}] ${s.name}: ${girls.length}名 [${girls.slice(0, 3).join(', ')}]`);
  } else {
    let added = 0;
    const txn = db.transaction(() => {
      for (const g of girls) {
        const exists = findGirl.get(s.id, g);
        if (exists) continue;
        insertGirl.run(g, s.id);
        added++;
      }
    });
    txn();
    totalGirlsAdded += added;
    totalShopsWithGirls++;
    if (totalShops % 50 === 0 || added > 5) {
      console.log(`  [${totalShops}/${shops.length}] ${s.name}: +${added}`);
    }
  }
  await delay();
}

db.close();
console.log(`\n=== 完了 ===\nshops処理: ${totalShops}, 嬢付き shops: ${totalShopsWithGirls}, INSERT girls: ${totalGirlsAdded}`);
