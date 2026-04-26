#!/usr/bin/env node
/**
 * 駅ちか shops の girls に image_url を後付け取得 + 嬢未取得 shops の嬢取得
 *
 * 対象: ranking-deli source の全 shops
 * 取得: girlslist HTML → 嬢名+画像URL → girls.image_url UPDATE
 *
 * 使い方: node scripts/update-rd-girl-images.mjs
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(1500 + Math.random() * 1000);

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

// HTMLから 嬢名+画像URL ペア抽出
// パターン: <p class="girls-name">嬢名</p> ... background: url(IMG_URL)
// または: <p class="data-name ellipsis">嬢名</p> + 周辺の background: url() / src=""
function parseGirlsWithImages(html) {
  const out = new Map(); // name → image_url
  // <p class="girls-name p-ellipsis">嬢名</p> の周辺 (前後 1500 chars) にある background:url() を探す
  const re = /<p\s+class="girls-name[^"]*">\s*([^<]+?)\s*<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1].trim().replace(/\s+/g, ' ');
    if (!name) continue;
    // m.index 周辺 1500chars の image url 探索
    const start = Math.max(0, m.index - 1500);
    const end = Math.min(html.length, m.index + 1500);
    const ctx = html.slice(start, end);
    const im = ctx.match(/background:\s*url\((https:\/\/fuzoku-images\.ranking-deli\.jp\/[^)]+\.(?:jpg|jpeg|png|webp))/);
    if (im) out.set(name, im[1]);
  }
  // パターン2: <p class="data-name ellipsis">嬢名</p>
  const re2 = /class="data-name\s+ellipsis"[^>]*>\s*([^<]+?)\s*</g;
  while ((m = re2.exec(html))) {
    const name = m[1].trim().replace(/\s+/g, ' ');
    if (!name || out.has(name)) continue;
    const start = Math.max(0, m.index - 1500);
    const end = Math.min(html.length, m.index + 1500);
    const ctx = html.slice(start, end);
    const im = ctx.match(/(?:src|data-src)=["'](https?:\/\/[^"']*fuzoku-images\.ranking-deli[^"']*\.(?:jpg|jpeg|png|webp))/);
    if (im) out.set(name, im[1]);
  }
  return out;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

// rd shops 全件 (image_url 未取得 girls がある shop のみ)
const shops = db.prepare(`
  SELECT s.id, s.name, s.source_url
  FROM shops s
  WHERE s.is_active=1 AND s.source_url LIKE '%ranking-deli%'
    AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND (g.image_url IS NULL OR g.image_url=''))
`).all();

console.log(`🚇 駅ちか 画像取得: ${shops.length} shops\n`);

const insertGirl = db.prepare(`INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at) VALUES (?, ?, 1, datetime('now'))`);
const updateImg = db.prepare(`UPDATE girls SET image_url=? WHERE shop_id=? AND name=? AND (image_url IS NULL OR image_url='')`);

let totalShops = 0, totalImgUpdates = 0, totalNewGirls = 0;
for (const s of shops) {
  totalShops++;
  if (!s.source_url) continue;
  const url = s.source_url.replace(/\/?$/, '/') + 'girlslist/';
  const html = await fetchPage(url);
  if (!html) { await delay(); continue; }
  const map = parseGirlsWithImages(html);
  if (map.size === 0) { await delay(); continue; }
  let imgUpdated = 0, newGirls = 0;
  const txn = db.transaction(() => {
    for (const [name, img] of map) {
      // 1) 既存 girl にimageを UPDATE
      const r = updateImg.run(img, s.id, name);
      if (r.changes > 0) imgUpdated++;
      // 2) 新規girl もINSERT (嬢拡充)
      const ins = insertGirl.run(name, s.id);
      if (ins.changes > 0) {
        newGirls++;
        // 画像も入れる
        db.prepare(`UPDATE girls SET image_url=? WHERE id=?`).run(img, ins.lastInsertRowid);
      }
    }
  });
  txn();
  totalImgUpdates += imgUpdated;
  totalNewGirls += newGirls;
  if (totalShops % 50 === 0 || imgUpdated > 0 || newGirls > 0) {
    console.log(`  [${totalShops}/${shops.length}] ${s.name}: img+${imgUpdated} newG+${newGirls}`);
  }
  await delay();
}

db.close();
console.log(`\n=== 完了 ===\nshops: ${totalShops}, image UPDATE: ${totalImgUpdates}, 新規girls: ${totalNewGirls}`);
