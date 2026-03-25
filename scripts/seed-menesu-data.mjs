#!/usr/bin/env node
/**
 * メンエス店舗にダミーセラピスト＆口コミデータを生成
 *
 * - 各メンエス店舗に3〜8名のセラピストを生成
 * - 各セラピストに0〜5件の口コミを生成
 * - 口コミ評価分布: panel_match 60%, panel_diff 30%, jirai 10%
 * - browser_id: 'ext-trend-menesu-{timestamp}-{連番}'
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Name generation ─────────────────────────────────────────
const FIRST_NAMES = [
  'あいり','あかり','あき','あこ','あさひ','あすか','あずさ','あみ','あや','あゆみ',
  'いちか','うた','うみ','えみ','えり','おとは',
  'かえで','かな','かのん','かほ','かれん','きい','きさき','くるみ','けい','こころ',
  'さえ','さき','さくら','さな','さやか','しおり','しずく','すず','すみれ','せな',
  'そら','ちあき','ちか','つかさ','つばき','つばさ','てん','とわ',
  'なお','なぎさ','なつき','なつみ','なな','にこ','のあ','のぞみ','はな','はるか',
  'ひかり','ひな','ひまり','ふうか','ほのか','まい','まお','まこと','まな','まゆ',
  'みう','みお','みく','みさ','みづき','みなみ','みゆ','みれい','めい','もえ',
  'もか','もも','ゆい','ゆう','ゆうか','ゆき','ゆな','ゆめ','よつば','らん',
  'りお','りか','りこ','りさ','りな','りの','りん','るい','るか','るな',
  'れい','れいな','れな','れん','わかな',
  'アイリ','カレン','サラ','ナナ','ミク','ユイ','リナ','レイ','ルカ','マリア',
];

const CUPS = ['A', 'B', 'B', 'C', 'C', 'C', 'D', 'D', 'D', 'E', 'E', 'F', 'G'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateGirl(shopId, idx) {
  const name = pick(FIRST_NAMES);
  const age = rand(20, 32);
  const height = rand(150, 170);
  const cupSize = pick(CUPS);
  const cupIdx = 'ABCDEFGH'.indexOf(cupSize);
  const bust = rand(78 + cupIdx * 3, 85 + cupIdx * 4);
  const waist = rand(54, 62);
  const hip = rand(82, 92);
  const sourceId = `menesu-seed-${shopId}-${idx}`;

  return { name, shop_id: shopId, age, height, bust, waist, hip, cup: cupSize, image_url: null, source_id: sourceId };
}

// ─── Review comment templates ────────────────────────────────
const MATCH_COMMENTS = [
  'パネル通りで安心しました',
  '写真通りの綺麗な方でした',
  'パネルより可愛いかも',
  '施術も丁寧で大満足',
  'リピ確定です！',
  '写真そのままの美人さん',
  'スタイル抜群でした',
  '笑顔が素敵な方でした',
  null, null, null, // Some reviews have no comment
];

const DIFF_COMMENTS = [
  'パネルとちょっと違った',
  '加工が強めでした',
  '実物は少し印象が違います',
  '暗くてよく見えなかった',
  null, null,
];

const JIRAI_COMMENTS = [
  'パネルと全然違う…',
  '完全に別人でした',
  '期待外れでした',
  null,
];

// ─── Main ────────────────────────────────────────────────────
console.log('='.repeat(60));
console.log('メンエス ダミーデータ生成');
console.log('='.repeat(60));

// Get all menesu shops with 0 girls
const shops = db.prepare(`
  SELECT s.id, s.name FROM shops s
  WHERE s.category = 'メンズエステ' AND s.is_active = 1
  AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id = s.id)
`).all();

console.log(`対象店舗: ${shops.length}`);

const insertGirl = db.prepare(`
  INSERT OR IGNORE INTO girls (name, shop_id, age, height, bust, waist, hip, cup, image_url, source_id, is_active, last_seen_at, created_at)
  VALUES (@name, @shop_id, @age, @height, @bust, @waist, @hip, @cup, @image_url, @source_id, 1, datetime('now'), datetime('now'))
`);

const insertReview = db.prepare(`
  INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const TIMESTAMP = Date.now();
let totalGirls = 0;
let totalReviews = 0;
let reviewSeq = 0;

const transaction = db.transaction(() => {
  for (const shop of shops) {
    const girlCount = rand(3, 8);

    for (let i = 0; i < girlCount; i++) {
      const girl = generateGirl(shop.id, i);
      const result = insertGirl.run(girl);

      if (result.changes > 0) {
        totalGirls++;
        const girlId = result.lastInsertRowid;

        // Generate reviews: 0-5 per girl, weighted toward fewer
        const reviewCount = pick([0, 0, 1, 1, 2, 2, 3, 4, 5]);

        for (let r = 0; r < reviewCount; r++) {
          // Rating distribution: panel_match 60%, panel_diff 30%, jirai 10%
          const roll = Math.random();
          let rating, comment;
          if (roll < 0.60) {
            rating = 'panel_match';
            comment = pick(MATCH_COMMENTS);
          } else if (roll < 0.90) {
            rating = 'panel_diff';
            comment = pick(DIFF_COMMENTS);
          } else {
            rating = 'jirai';
            comment = pick(JIRAI_COMMENTS);
          }

          // Random visit date in last 90 days
          const daysAgo = rand(1, 90);
          const visitDate = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
          const createdAt = new Date(Date.now() - (daysAgo - rand(0, 1)) * 86400000).toISOString();

          reviewSeq++;
          const browserId = `ext-trend-menesu-${TIMESTAMP}-${reviewSeq}`;

          try {
            insertReview.run(girlId, visitDate, rating, comment, browserId, createdAt);
            totalReviews++;
          } catch {
            // Unique constraint violation - skip
          }
        }
      }
    }
  }
});

transaction();

// ─── Summary ──────────────────────────────────────────────────
const menesuStats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id WHERE s.category = 'メンズエステ' AND g.is_active = 1) as girls,
    (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id JOIN shops s ON g.shop_id = s.id WHERE s.category = 'メンズエステ') as reviews,
    (SELECT COUNT(*) FROM shops WHERE category = 'メンズエステ' AND is_active = 1) as shops
`).get();

console.log(`\n生成結果:`);
console.log(`  新規セラピスト: ${totalGirls}`);
console.log(`  新規口コミ: ${totalReviews}`);
console.log(`\nメンエス合計:`);
console.log(`  店舗: ${menesuStats.shops}`);
console.log(`  セラピスト: ${menesuStats.girls}`);
console.log(`  口コミ: ${menesuStats.reviews}`);

// Show rating distribution
const dist = db.prepare(`
  SELECT panel_rating, COUNT(*) as cnt
  FROM reviews r
  JOIN girls g ON r.girl_id = g.id
  JOIN shops s ON g.shop_id = s.id
  WHERE s.category = 'メンズエステ'
  GROUP BY panel_rating
`).all();
console.log(`\n口コミ評価分布:`);
for (const d of dist) {
  const pct = (d.cnt / totalReviews * 100).toFixed(1);
  console.log(`  ${d.panel_rating}: ${d.cnt} (${pct}%)`);
}

db.close();
