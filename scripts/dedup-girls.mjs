#!/usr/bin/env node
// ============================================================================
// 嬢の重複統合
//
// 同じ shop_id + 同じ name のアクティブ嬢が複数ある場合、
// 情報量が多い方（reviews数 > 画像有無 > cityheaven出自 > 最終取得日）を
// keeper として残し、他を非アクティブ化する。
// reviews は keeper に付け替え、unique制約で衝突したものは削除。
//
// 使い方:
//   node scripts/dedup-girls.mjs           # 実行
//   node scripts/dedup-girls.mjs --dry     # dry-run（統計のみ）
// ============================================================================

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '..', 'panemaji.db');
const DRY_RUN = process.argv.includes('--dry');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const groups = db.prepare(`
  SELECT shop_id, name, COUNT(*) as cnt
  FROM girls
  WHERE is_active = 1 AND name IS NOT NULL AND length(name) > 1
  GROUP BY shop_id, name
  HAVING cnt > 1
`).all();

console.log(`重複グループ: ${groups.length}`);
if (groups.length === 0) {
  db.close();
  process.exit(0);
}

if (DRY_RUN) {
  const total = groups.reduce((s, g) => s + (g.cnt - 1), 0);
  console.log(`dry-run: ${total} 件が統合対象`);
  db.close();
  process.exit(0);
}

const selectGirlsInGroup = db.prepare(`
  SELECT g.id, g.image_url, g.source_id, g.last_seen_at,
         (SELECT COUNT(*) FROM reviews r WHERE r.girl_id = g.id) as review_count
  FROM girls g
  WHERE g.shop_id = ? AND g.name = ? AND g.is_active = 1
`);
const moveReviews = db.prepare('UPDATE OR IGNORE reviews SET girl_id = ? WHERE girl_id = ?');
const deleteOrphanReviews = db.prepare('DELETE FROM reviews WHERE girl_id = ?');
const deactivateGirl = db.prepare('UPDATE girls SET is_active = 0 WHERE id = ?');

let mergedCount = 0;
let reviewsMoved = 0;
let reviewsDropped = 0;

const scoreGirl = (g) => {
  // 優先度: review数 > 画像有無 > cityheaven数値source > 最終取得日
  const isCityheaven = g.source_id && /^\d+$/.test(g.source_id);
  const ts = g.last_seen_at ? Date.parse(g.last_seen_at) / 1000 : 0;
  return (g.review_count * 1e12) +
         ((g.image_url ? 1 : 0) * 1e9) +
         ((isCityheaven ? 1 : 0) * 1e7) +
         ts;
};

const txn = db.transaction(() => {
  for (const grp of groups) {
    const girls = selectGirlsInGroup.all(grp.shop_id, grp.name);
    if (girls.length < 2) continue;
    girls.sort((a, b) => scoreGirl(b) - scoreGirl(a));
    const keeper = girls[0];
    for (let i = 1; i < girls.length; i++) {
      const dup = girls[i];
      const moved = moveReviews.run(keeper.id, dup.id);
      reviewsMoved += moved.changes;
      const dropped = deleteOrphanReviews.run(dup.id);
      reviewsDropped += dropped.changes;
      deactivateGirl.run(dup.id);
      mergedCount++;
    }
  }
});
txn();

console.log(`統合: ${mergedCount} | 評価移動: ${reviewsMoved} | 評価削除: ${reviewsDropped}`);
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
