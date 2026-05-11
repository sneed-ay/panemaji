#!/usr/bin/env node
/**
 * fj-prefix source_id の girls 画像補完 (shop の source_url が fuzoku.jp 以外でも 動く版)
 *
 * 既存 update-fuzoku-girl-images.mjs は s.source_url LIKE '%fuzoku.jp%' でフィルタしてるが、
 * 多くの fj-* girls は shop の source_url が cityheaven に書き換わってる (より優先な source として)。
 * その結果 41K の fj-prefix 画像なし girls が 取り残されてる。
 *
 * 本スクリプトは:
 *   - girls.source_id LIKE 'fj-%' AND image_url IS NULL の girls を 全部スキャン
 *   - source_id を "fj-{shop_slug}-{girl_id}" にパース
 *   - shop_slug ごとに 1 回だけ fuzoku.jp girllist (page 1-5) を 取得
 *   - girl_id → image_url の マップを作って girls を UPDATE
 *   - INSERT は しない (UPDATE only、 dup 作らない)
 *
 * 使い方:
 *   node scripts/fill-fuzoku-orphan-images.mjs            # 実行
 *   node scripts/fill-fuzoku-orphan-images.mjs --dry-run  # 確認のみ
 *   node scripts/fill-fuzoku-orphan-images.mjs --limit=50 # slug 数上限
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(1500 + Math.random() * 800);

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// fuzoku girllist HTML → girlId → image_url の Map
function parseImages(html, slug) {
  const out = new Map();
  // パターン1: href="/SLUG/girl/ID/" → 直後の cloudfront URL
  const re1 = new RegExp(`href="/${slug}/girl/(\\d+)/?"[\\s\\S]{0,2000}?(?:src|data-src)="(https?://d1ywb8dvwodsnl\\.cloudfront\\.net/[^"?]+\\.(?:jpg|jpeg|png|webp))`, 'g');
  let m;
  while ((m = re1.exec(html))) {
    if (!out.has(m[1])) out.set(m[1], m[2]);
  }
  // パターン2: 逆順 (cloudfront → href)
  const re2 = new RegExp(`(?:src|data-src)="(https?://d1ywb8dvwodsnl\\.cloudfront\\.net/[^"?]+\\.(?:jpg|jpeg|png|webp))[^"]*"[\\s\\S]{0,500}?href="/${slug}/girl/(\\d+)/?"`, 'g');
  while ((m = re2.exec(html))) {
    if (!out.has(m[2])) out.set(m[2], m[1]);
  }
  return out;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎀 fuzoku.jp orphan girls の 画像補完');
  console.log('   (fj-prefix source_id の 画像なし girls を 全 shop_url 関係なく fill)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // fj-* source_id を 持つ 画像なし girls を slug で 集約
  const rows = db.prepare(`
    SELECT id, name, source_id, shop_id
    FROM girls WHERE is_active=1
      AND (image_url IS NULL OR image_url = '')
      AND source_id LIKE 'fj-%'
  `).all();

  // slug → [{id, source_id, girlNum}]
  const bySlug = new Map();
  for (const g of rows) {
    // fj-{slug}-{girlNum} を 分解
    const m = g.source_id.match(/^fj-(.+)-(\d+)$/);
    if (!m) continue;
    const slug = m[1];
    const girlNum = m[2];
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push({ ...g, girlNum });
  }

  const slugs = [...bySlug.keys()].sort((a, b) => bySlug.get(b).length - bySlug.get(a).length);
  const targetSlugs = LIMIT > 0 ? slugs.slice(0, LIMIT) : slugs;
  console.log(`  対象 fuzoku.jp shop slug: ${slugs.length} (girls 数の多い順)`);
  if (LIMIT > 0) console.log(`  処理対象 (limit): ${targetSlugs.length}`);

  const updateStmt = db.prepare('UPDATE girls SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = \'\')');

  let processed = 0;
  let totalImg = 0;
  for (const slug of targetSlugs) {
    processed++;
    const girls = bySlug.get(slug);

    // page 1-5 を 順次取得して girlId→img マップを 構築
    const allMap = new Map();
    for (let p = 1; p <= 5; p++) {
      const url = p === 1
        ? `https://fuzoku.jp/${slug}/girllist/`
        : `https://fuzoku.jp/${slug}/girllist/page${p}/`;
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

    // 該当 girls の source_id 末尾 number で マッチ → image UPDATE
    let updated = 0;
    const txn = db.transaction(() => {
      for (const g of girls) {
        const img = allMap.get(g.girlNum);
        if (!img) continue;
        if (DRY) {
          updated++;
        } else {
          const r = updateStmt.run(img, g.id);
          if (r.changes > 0) updated++;
        }
      }
    });
    txn();
    totalImg += updated;
    if (updated > 0 || processed % 50 === 0) {
      console.log(`  [${processed}/${targetSlugs.length}] ${slug}: img+${updated}/${girls.length} (page取得${allMap.size})`);
    }
    await delay();
  }

  // 最終 stats
  const remaining = db.prepare(`SELECT COUNT(*) AS c FROM girls WHERE is_active=1 AND (image_url IS NULL OR image_url='') AND source_id LIKE 'fj-%'`).get();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 完了: slug 処理=${processed}, 画像 UPDATE=${totalImg}${DRY ? ' (DRY RUN)' : ''}`);
  console.log(`   fj-* 残り画像なし girls: ${remaining.c}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  db.close();
}

main().catch(e => { console.error('💀', e); process.exit(1); });
