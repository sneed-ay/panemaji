#!/usr/bin/env node
/**
 * ぴゅあらば shops の girls に image_url 後付け取得 + 嬢拡充
 *
 * パターン: <a href="/shop/[ID]/girl/[GID]/" ...> ... data-src="//contents.purelovers.com/...jpg"
 *           alt="嬢名(年齢)/..." 周辺
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

// shop ID を含めて 嬢名+image マッピング抽出
function parseGirlsWithImages(html, shopId) {
  const out = new Map();
  // <a href="https://purelovers.com/shop/SID/girl/GID/" ...> ... <img data-src="//contents.purelovers.com/.../GID/photo/.../original.jpg" ... alt="嬢名(年齢)/..." />
  const re = new RegExp(
    `href="https://purelovers\\.com/shop/${shopId}/girl/(\\d+)/"[\\s\\S]{0,3000}?data-src="(//contents\\.purelovers\\.com/[^"]+\\.(?:jpg|jpeg|png|webp))[^"]*"[\\s\\S]{0,500}?alt="([^/"\\(\\n]+?)\\(\\d+\\)`,
    'g'
  );
  let m;
  while ((m = re.exec(html))) {
    const girlId = m[1];
    const img = 'https:' + m[2];
    const name = m[3].trim().replace(/\s+/g, ' ');
    if (!name || out.has(name)) continue;
    out.set(name, img);
  }
  return out;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

const shops = db.prepare(`
  SELECT s.id, s.name, s.source_url
  FROM shops s
  WHERE s.is_active=1 AND s.source_url LIKE '%purelovers%'
    AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND (g.image_url IS NULL OR g.image_url=''))
`).all();

console.log(`💗 ぴゅあらば 画像取得: ${shops.length} shops\n`);

const insertGirl = db.prepare(`INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at) VALUES (?, ?, 1, datetime('now'))`);
const updateImg = db.prepare(`UPDATE girls SET image_url=? WHERE shop_id=? AND name=? AND (image_url IS NULL OR image_url='')`);

let totalShops = 0, totalImgUpdates = 0, totalNewGirls = 0;
for (const s of shops) {
  totalShops++;
  if (!s.source_url) continue;
  const idMatch = s.source_url.match(/\/shop\/(\d+)\//);
  if (!idMatch) continue;
  const shopId = idMatch[1];
  const html = await fetchPage(s.source_url);
  if (!html) { await delay(); continue; }
  const map = parseGirlsWithImages(html, shopId);
  if (map.size === 0) { await delay(); continue; }
  let imgUpdated = 0, newGirls = 0;
  const txn = db.transaction(() => {
    for (const [name, img] of map) {
      const r = updateImg.run(img, s.id, name);
      if (r.changes > 0) imgUpdated++;
      const ins = insertGirl.run(name, s.id);
      if (ins.changes > 0) {
        newGirls++;
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
