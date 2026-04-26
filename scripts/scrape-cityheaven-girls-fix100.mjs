#!/usr/bin/env node
/**
 * cityheaven 嬢ちょうど100の shops に対して girllist 全ページ取得 → 100超え嬢を追加
 *
 * 対象: girls=100 ちょうど の cityheaven shops (約110件)
 *
 * 使い方:
 *   node scripts/scrape-cityheaven-girls-fix100.mjs --dry-run
 *   node scripts/scrape-cityheaven-girls-fix100.mjs
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
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Cookie': 'nenrei=y' } });
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
  // <div class="girllisttext"> 嬢名 ... </div>
  const re = /<div\s+class="girllisttext">\s*([^<]+?)\s*\n/g;
  let m;
  while ((m = re.exec(html))) {
    const n = m[1].trim().replace(/\s+/g, ' ');
    if (n.length >= 1 && n.length <= 20 && !/girlmark|attendance/i.test(n)) names.add(n);
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
    AND s.source_url LIKE '%cityheaven%'
    AND (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1) = 100
`).all();

console.log(`👯 cityheaven 100嬢cap fix: ${shops.length} shops (dry-run=${DRY})\n`);

const insertGirl = db.prepare(`
  INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at)
  VALUES (?, ?, 1, datetime('now'))
`);
const findGirl = db.prepare(`SELECT id FROM girls WHERE shop_id=? AND name=?`);

let totalShops = 0, totalGirlsAdded = 0;

for (const s of shops) {
  totalShops++;
  if (!s.source_url) continue;
  // shop URL → girllist page1, page2, page3...
  const baseUrl = s.source_url.replace(/\/?$/, '/') + 'girllist/';
  const allGirls = new Set();
  for (let p = 1; p <= 10; p++) {
    const url = p === 1 ? baseUrl + '?nenrei=y' : `${baseUrl}page${p}/?nenrei=y`;
    const html = await fetchPage(url);
    if (!html) break;
    const girls = parseGirls(html);
    if (girls.length === 0) break;
    const before = allGirls.size;
    for (const g of girls) allGirls.add(g);
    if (allGirls.size === before) break; // no new
    await delay();
  }
  if (allGirls.size <= 100) {
    if (totalShops % 10 === 0) console.log(`  [${totalShops}/${shops.length}] ${s.name}: ${allGirls.size}名 (no add)`);
    continue;
  }
  if (DRY) {
    console.log(`  [${totalShops}/${shops.length}] ${s.name}: ${allGirls.size}名 (would add ${allGirls.size - 100})`);
  } else {
    let added = 0;
    const txn = db.transaction(() => {
      for (const g of allGirls) {
        const exists = findGirl.get(s.id, g);
        if (exists) continue;
        insertGirl.run(g, s.id);
        added++;
      }
    });
    txn();
    totalGirlsAdded += added;
    if (added > 0) console.log(`  [${totalShops}/${shops.length}] ${s.name}: 取得${allGirls.size} +${added}`);
  }
}

db.close();
console.log(`\n=== 完了 ===\nshops: ${totalShops}, INSERT girls: ${totalGirlsAdded}`);
