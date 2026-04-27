#!/usr/bin/env node
/**
 * panemaji 健全性チェック (read-only、副作用ゼロ)
 *
 * 出力:
 *   - shops/girls/reviews/areas 件数
 *   - エリアMECE違反 (159以外)
 *   - 嬢0 shops 数 (ソース別)
 *   - 嬢ちょうど100 shops 数
 *   - 画像なし girls / shops
 *   - 重複検出 (shops/girls)
 *   - レガシー area 残存検知
 *
 * 使い方:
 *   node scripts/health-check.mjs
 *   npm run health
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'panemaji.db');

const db = new Database(DB_PATH, { readonly: true });

const fmt = (n) => Number(n).toLocaleString();
const status = (ok) => (ok ? '✅' : '⚠️');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏥 panemaji 健全性チェック');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. 基本カウント
const stats = {
  shops_active: db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c,
  girls_active: db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c,
  reviews: db.prepare('SELECT COUNT(*) c FROM reviews').get().c,
  areas: db.prepare('SELECT COUNT(*) c FROM areas').get().c,
};
console.log('📊 基本カウント');
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${fmt(v)}`);

// 2. エリアMECE
console.log(`\n🚨 エリアMECE (159固定ルール)`);
console.log(`  ${status(stats.areas === 159)} areas total = ${stats.areas} (期待: 159)`);
const legacy = db.prepare(`
  SELECT COUNT(*) c FROM areas
  WHERE slug LIKE '%-pending' OR slug LIKE '%-fj-%' OR slug LIKE '%-ch-A%'
     OR slug LIKE '%-rd-%' OR slug LIKE '%-pl-%' OR slug LIKE '%-meste-%' OR slug LIKE '%-robin-%'
     OR slug GLOB '*-a[0-9][0-9][0-9][0-9]'
`).get().c;
console.log(`  ${status(legacy === 0)} レガシーslug残: ${legacy}`);

// 3. 嬢0 shops
const zero = db.prepare(`
  SELECT
    CASE
      WHEN s.source_url LIKE '%m-este%' THEN 'm-este'
      WHEN s.source_url LIKE '%cityheaven%' THEN 'cityheaven'
      WHEN s.source_url LIKE '%fuzoku.jp%' THEN 'fuzoku'
      WHEN s.source_url LIKE '%ranking-deli%' THEN 'rd'
      WHEN s.source_url LIKE '%purelovers%' THEN 'pl'
      WHEN s.source_url LIKE '%soap-robin%' THEN 'robin'
      ELSE 'その他'
    END source,
    COUNT(*) c
  FROM shops s WHERE s.is_active=1 AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
  GROUP BY source ORDER BY c DESC
`).all();
const zeroTotal = zero.reduce((s, r) => s + r.c, 0);
console.log(`\n👻 嬢0 shops: ${fmt(zeroTotal)}`);
for (const r of zero) console.log(`  ${r.source}: ${fmt(r.c)}`);

// 4. 嬢ちょうど100
const cap100 = db.prepare(`
  SELECT COUNT(*) c FROM shops s WHERE s.is_active=1 AND (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1) = 100
`).get().c;
console.log(`\n📌 嬢ちょうど100 shops: ${fmt(cap100)}`);

// 5. 画像
const img = db.prepare(`SELECT COUNT(*) c FROM girls WHERE is_active=1 AND image_url IS NOT NULL AND image_url != ''`).get().c;
const noImg = stats.girls_active - img;
console.log(`\n🖼️  画像`);
console.log(`  画像あり girls: ${fmt(img)} (${((img / stats.girls_active) * 100).toFixed(1)}%)`);
console.log(`  画像なし girls: ${fmt(noImg)}`);

// 6. 重複候補 (shops)
db.function('normalize_shop', { deterministic: true }, (s) => {
  if (!s) return '';
  let n = String(s).normalize('NFKC').trim();
  n = n.replace(/[★☆♡♥♦♢♪♬◆◇●○■□▲▽△▼※#＃@＠＊*&＆+＋=＝/／\\￥]/g, '');
  n = n.replace(/[・･\-―—‐ーｰ~～〜!！?？.,，、。'"`’‘“”]/g, '');
  n = n.replace(/[（(\[【〔『「].*?[）)\]】〕』」]/g, '');
  n = n.replace(/[\s　]/g, '');
  n = n.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  for (let i = 0; i < 3; i++) {
    const before = n;
    n = n.replace(/(本店|支店|号店|新店|別館|本館|分店|店)$/, '');
    if (n === before) break;
  }
  return n.toLowerCase();
});
const dupShops = db.prepare(`
  WITH n AS (SELECT s.id, s.name, a.prefecture, normalize_shop(s.name) AS nk FROM shops s LEFT JOIN areas a ON s.area_id=a.id WHERE s.is_active=1 AND length(normalize_shop(s.name)) >= 2)
  SELECT COUNT(*) c FROM (SELECT 1 FROM n GROUP BY prefecture, nk HAVING COUNT(*) >= 2)
`).get().c;
console.log(`\n🚫 店舗重複候補グループ: ${fmt(dupShops)} ${status(dupShops === 0)}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
db.close();
