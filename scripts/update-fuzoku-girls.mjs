#!/usr/bin/env node
/**
 * fuzoku.jp 嬢0 shops に対して girllist から嬢取得
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

// fuzoku.jp girllist パース
function parseGirls(html, shopSlug) {
  const out = new Map(); // name -> image_url
  const re = new RegExp(`<a[^>]*href="(?:https?://fuzoku\\.jp)?/${shopSlug}/girl/(\\d+)/"[^>]*>([\\s\\S]*?)</a>`, 'gi');
  for (const m of html.matchAll(re)) {
    const inner = m[2];
    // 名前+年齢
    const text = inner.replace(/<[^>]*>/g, '\n');
    const lines = text.split('\n').map(s => s.trim()).filter(s => s);
    let name = '';
    for (const line of lines) {
      const nameAge = line.match(/^(.+?)\s*[（(]\d+[）)]$/);
      if (nameAge && !name) { name = nameAge[1].replace(/\*+/g, '').trim(); break; }
      if (!name && !/^T\d+|^\d+:\d+/.test(line) && line.length < 20) name = line.replace(/\*+/g, '').trim();
    }
    if (!name || name.length < 1 || name.length > 20) continue;
    // 画像 (innerに<img src="...">)
    const imgM = inner.match(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"/);
    const img = imgM ? (imgM[1].startsWith('//') ? 'https:' + imgM[1] : imgM[1]) : null;
    if (!out.has(name)) out.set(name, img);
  }
  return out;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

const shops = db.prepare(`
  SELECT s.id, s.name, s.source_url FROM shops s
  WHERE s.is_active=1 AND s.source_url LIKE '%fuzoku.jp%'
    AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
`).all();

console.log(`🎀 fuzoku 嬢取得: ${shops.length} shops\n`);

const insertGirl = db.prepare(`INSERT OR IGNORE INTO girls (name, shop_id, is_active, last_seen_at) VALUES (?, ?, 1, datetime('now'))`);

let totalNewGirls = 0;
let totalShopsFilled = 0;
let i = 0;
for (const s of shops) {
  i++;
  if (!s.source_url) continue;
  // shopslug を URL から抽出: https://fuzoku.jp/SHOPSLUG/...
  const slugM = s.source_url.match(/^https?:\/\/fuzoku\.jp\/([^/?#]+)/);
  if (!slugM) continue;
  const slug = slugM[1];
  const url = `https://fuzoku.jp/${slug}/girllist/`;
  const html = await fetchPage(url);
  if (!html) { await delay(); continue; }
  const map = parseGirls(html, slug);
  if (map.size === 0) { await delay(); continue; }
  let newG = 0;
  const txn = db.transaction(() => {
    for (const [name, img] of map) {
      const ins = insertGirl.run(name, s.id);
      if (ins.changes > 0) {
        newG++;
        if (img) db.prepare(`UPDATE girls SET image_url=? WHERE id=?`).run(img, ins.lastInsertRowid);
      }
    }
  });
  txn();
  totalNewGirls += newG;
  if (newG > 0) {
    totalShopsFilled++;
    console.log(`  [${i}/${shops.length}] ${s.name}: +${newG}`);
  }
  await delay();
}
db.close();
console.log(`\n=== 完了 ===\n${totalShopsFilled} shops に嬢追加 / 新規girls合計: ${totalNewGirls}`);
