#!/usr/bin/env node
// ============================================================================
// 店舗の重複統合
//
// 同名+同カテゴリの店舗が複数エリアに散らばっている場合、嬢が多い方を
// keeper として残し、他の店舗の嬢を keeper に付け替えて非アクティブ化する。
// settings.md ルール: 重複店舗は嬢が多い方に統合。
//
// ここで統合した結果、keeper に同名嬢が複数発生する可能性があるため、
// 実行後に dedup-girls.mjs を続けて呼ぶこと。daily-maintenance.sh では
// その順序で組み込んでいる。
//
// 使い方:
//   node scripts/dedup-shops.mjs           # 実行
//   node scripts/dedup-shops.mjs --dry     # 統計のみ
// ============================================================================

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '..', 'panemaji.db');
const DRY_RUN = process.argv.includes('--dry');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 同名+同カテゴリの重複グループ
const groups = db.prepare(`
  SELECT name, category, COUNT(*) as cnt
  FROM shops
  WHERE is_active = 1 AND name IS NOT NULL AND length(name) > 1
  GROUP BY name, category
  HAVING cnt > 1
`).all();

console.log(`重複グループ: ${groups.length}`);
if (groups.length === 0) {
  db.close();
  process.exit(0);
}

if (DRY_RUN) {
  const total = groups.reduce((s, g) => s + (g.cnt - 1), 0);
  console.log(`dry-run: ${total} 店舗が統合対象`);
  db.close();
  process.exit(0);
}

const selectShopsInGroup = db.prepare(`
  SELECT s.id, s.area_id, s.last_seen_at,
         (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1) as girls_count
  FROM shops s
  WHERE s.name = ? AND s.category = ? AND s.is_active = 1
`);
const moveGirls = db.prepare('UPDATE girls SET shop_id = ? WHERE shop_id = ?');
const deactivateShop = db.prepare('UPDATE shops SET is_active = 0 WHERE id = ?');

let mergedCount = 0;
let girlsMoved = 0;

const scoreShop = (s) => {
  // 優先度: 嬢数 > 最終取得日
  const ts = s.last_seen_at ? Date.parse(s.last_seen_at) / 1000 : 0;
  return (s.girls_count * 1e12) + ts;
};

const txn = db.transaction(() => {
  for (const grp of groups) {
    const shops = selectShopsInGroup.all(grp.name, grp.category);
    if (shops.length < 2) continue;
    shops.sort((a, b) => scoreShop(b) - scoreShop(a));
    const keeper = shops[0];
    for (let i = 1; i < shops.length; i++) {
      const dup = shops[i];
      const moved = moveGirls.run(keeper.id, dup.id);
      girlsMoved += moved.changes;
      deactivateShop.run(dup.id);
      mergedCount++;
    }
  }
});
txn();

console.log(`統合: ${mergedCount} 店舗 | 嬢移動: ${girlsMoved}`);
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
