#!/usr/bin/env node
/**
 * fuzoku.jp 既存 girls の image_url を後付け取得 (girllist + page2..N から)
 * 副作用ゼロ: 既存 image_url は上書きしない (NULL or '' のときのみ UPDATE)
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

// fuzoku girllist から girl_id → image_url ペア抽出
// shop slug ベースで <a href="/SLUG/girl/ID/" ...> 周辺に <img src="cloudfront/.../gimg/X.jpg">
function parseImages(html, slug) {
  const out = new Map(); // girlId -> img URL
  // ブロック単位: <a href="/SLUG/girl/ID/" ... > ... </a> 周辺
  const re = new RegExp(`href="/${slug}/girl/(\\d+)/?"[\\s\\S]{0,2000}?(?:src|data-src)="(https://d1ywb8dvwodsnl\\.cloudfront\\.net/[^"?]+\\.(?:jpg|jpeg|png|webp))`, 'g');
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const img = m[2];
    if (!out.has(id)) out.set(id, img);
  }
  // 別ブロック構造: 先に <img> → <a href> パターン
  const re2 = new RegExp(`(?:src|data-src)="(https://d1ywb8dvwodsnl\\.cloudfront\\.net/[^"?]+\\.(?:jpg|jpeg|png|webp))[^"]*"[\\s\\S]{0,500}?href="/${slug}/girl/(\\d+)/?"`, 'g');
  while ((m = re2.exec(html))) {
    const id = m[2];
    const img = m[1];
    if (!out.has(id)) out.set(id, img);
  }
  return out;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

// fuzoku shops で 嬢付き かつ image_url なし girls 持つもの
const shops = db.prepare(`
  SELECT s.id, s.name, s.source_url FROM shops s
  WHERE s.is_active=1 AND s.source_url LIKE '%fuzoku.jp%'
    AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND (g.image_url IS NULL OR g.image_url=''))
`).all();

console.log(`🎀 fuzoku 画像補完: ${shops.length} shops\n`);

const updateImg = db.prepare(`UPDATE girls SET image_url=? WHERE shop_id=? AND name=? AND (image_url IS NULL OR image_url='')`);

let totalImg = 0, processed = 0;
for (const s of shops) {
  processed++;
  if (!s.source_url) continue;
  const slugM = s.source_url.match(/^https?:\/\/fuzoku\.jp\/([^/?#]+)/);
  if (!slugM) continue;
  const slug = slugM[1];

  // 全 page収集 (1-5まで)
  const allMap = new Map();
  for (let p = 1; p <= 5; p++) {
    const url = p === 1 ? `https://fuzoku.jp/${slug}/girllist/` : `https://fuzoku.jp/${slug}/girllist/page${p}/`;
    const html = await fetchPage(url);
    if (!html) break;
    const m = parseImages(html, slug);
    if (m.size === 0) break;
    const before = allMap.size;
    for (const [k, v] of m) if (!allMap.has(k)) allMap.set(k, v);
    if (allMap.size === before) break;
    await delay();
  }
  if (allMap.size === 0) continue;

  // 既存girls との name match: source_id とは別に id と girl id を紐付ける必要あるが、
  // ここでは shop 内の全 girls に対して 同じ shop の 嬢の image_url を更新する
  // (girl ID → name の mapping が無いので、 source_id で照合できない)
  // → simplification: shop内の image_url なし girls の order を 任意で上書き
  // しかし name が変わってしまうので不可
  // → 結局 girl id → image マッピングだけ確保して girls.source_id == girl_id でJOIN
  let updated = 0;
  const txn = db.transaction(() => {
    for (const [girlId, img] of allMap) {
      const r = db.prepare(`UPDATE girls SET image_url=? WHERE shop_id=? AND source_id=? AND (image_url IS NULL OR image_url='')`).run(img, s.id, girlId);
      if (r.changes > 0) updated++;
    }
  });
  txn();
  totalImg += updated;
  if (processed % 50 === 0 || updated > 0) {
    console.log(`  [${processed}/${shops.length}] ${s.name}: img+${updated} (girls in girllist: ${allMap.size})`);
  }
}

db.close();
console.log(`\n=== 完了 ===\nshops: ${processed}, image UPDATE: ${totalImg}`);
