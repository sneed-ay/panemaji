#!/usr/bin/env node
/**
 * 駅ちか shops で girls=100ちょうど のものに対して girlslist/page2/, page3/ を取得して 嬢を追加
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'panemaji.db');
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
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return null;
}

function parseGirlsWithImages(html) {
  const out = new Map();
  const re = /<p\s+class="girls-name[^"]*">\s*([^<]+?)\s*<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1].trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const start = Math.max(0, m.index - 1500);
    const end = Math.min(html.length, m.index + 1500);
    const ctx = html.slice(start, end);
    const im = ctx.match(/background:\s*url\((https:\/\/fuzoku-images\.ranking-deli\.jp\/[^)]+\.(?:jpg|jpeg|png|webp))/);
    if (im) out.set(name, im[1]);
    else if (!out.has(name)) out.set(name, null);
  }
  const re2 = /class="data-name\s+ellipsis"[^>]*>\s*([^<]+?)\s*</g;
  while ((m = re2.exec(html))) {
    const name = m[1].trim().replace(/\s+/g, ' ');
    if (!name || out.has(name)) continue;
    out.set(name, null);
  }
  return out;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

const shops = db.prepare(`
  SELECT s.id, s.name, s.source_url FROM shops s
  WHERE s.is_active=1 AND s.source_url LIKE '%ranking-deli%'
    AND (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1) = 100
`).all();

console.log(`🚇 rd 100cap fix: ${shops.length} shops\n`);

const insertGirl = db.prepare(`INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at) VALUES (?, ?, 1, datetime('now'))`);
const updateImg = db.prepare(`UPDATE girls SET image_url=? WHERE shop_id=? AND name=? AND (image_url IS NULL OR image_url='')`);

let totalNewGirls = 0, totalImgUpdated = 0;
for (const s of shops) {
  const baseUrl = s.source_url.replace(/\/?$/, '/') + 'girlslist/';
  const allMap = new Map();
  for (let p = 1; p <= 5; p++) {
    const url = p === 1 ? baseUrl : `${baseUrl}page${p}/`;
    const html = await fetchPage(url);
    if (!html) break;
    const m = parseGirlsWithImages(html);
    if (m.size === 0) break;
    const before = allMap.size;
    for (const [k, v] of m) if (!allMap.has(k)) allMap.set(k, v);
    if (allMap.size === before) break;
    await delay();
  }
  if (allMap.size <= 100) continue;
  let newG = 0, imgU = 0;
  const txn = db.transaction(() => {
    for (const [name, img] of allMap) {
      const ins = insertGirl.run(name, s.id);
      if (ins.changes > 0) {
        newG++;
        if (img) db.prepare(`UPDATE girls SET image_url=? WHERE id=?`).run(img, ins.lastInsertRowid);
      }
      if (img) {
        const r = updateImg.run(img, s.id, name);
        if (r.changes > 0) imgU++;
      }
    }
  });
  txn();
  totalNewGirls += newG;
  totalImgUpdated += imgU;
  console.log(`  ${s.name}: ${allMap.size}名 +${newG}新規 +${imgU}img`);
}
db.close();
console.log(`\n=== 完了 ===\n新規girls: ${totalNewGirls}, image: ${totalImgUpdated}`);
