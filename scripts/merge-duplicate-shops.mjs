#!/usr/bin/env node
/**
 * 同一都道府県 × 正規化名 一致 のshopsを統合
 *
 * 使い方:
 *   node scripts/merge-duplicate-shops.mjs            # dry-run
 *   node scripts/merge-duplicate-shops.mjs --apply    # 実行
 *
 * 処理:
 *   1. 重複グループを抽出 (prefecture + normalize_shop(name))
 *   2. 各グループから「正」を1件選定 (girls数の多い順 → reviews数 → 古いid)
 *   3. 他のshopの foreign key を「正」に書き換え (girls.shop_id)
 *   4. 統合された shop は is_active=0 に
 *   5. 統合ログを出力
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'panemaji.db');
const APPLY = process.argv.includes('--apply');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
db.pragma('foreign_keys = ON');
registerNormalizeUdf(db);

console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}`);

// 重複グループ抽出
const dups = db.prepare(`
  WITH n AS (
    SELECT s.id, s.name, s.area_id, s.category, s.source_url, s.last_seen_at,
           a.prefecture, normalize_shop(s.name) AS nk
    FROM shops s LEFT JOIN areas a ON s.area_id = a.id
    WHERE s.is_active=1 AND length(normalize_shop(s.name)) >= 2
  )
  SELECT prefecture, nk, GROUP_CONCAT(id) as ids
  FROM n
  GROUP BY prefecture, nk
  HAVING COUNT(*) >= 2
`).all();

console.log(`\n重複グループ: ${dups.length}`);
let totalShopsInDup = 0, totalToMerge = 0;
for (const d of dups) totalShopsInDup += d.ids.split(',').length;
totalToMerge = totalShopsInDup - dups.length;
console.log(`重複に巻き込まれているshops: ${totalShopsInDup}`);
console.log(`統合される shops 数 (is_active=0 化): ${totalToMerge}\n`);

// 「正」を選ぶ: girls数 → reviews数 → 古い id 優先
const pickPrimary = (ids) => {
  const candidates = db.prepare(`
    SELECT s.id,
           (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id) as girls_cnt,
           (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id=g.id WHERE g.shop_id=s.id) as rev_cnt
    FROM shops s WHERE s.id IN (${ids.split(',').map(() => '?').join(',')})
    ORDER BY girls_cnt DESC, rev_cnt DESC, s.id ASC
    LIMIT 1
  `).all(...ids.split(','));
  return candidates[0]?.id;
};

const updateGirlShop = db.prepare('UPDATE girls SET shop_id = ? WHERE shop_id = ?');
const deactivateShop = db.prepare('UPDATE shops SET is_active = 0 WHERE id = ?');

// 統合実行
let mergedCount = 0;
const mergeLog = [];
const txn = db.transaction(() => {
  for (const d of dups) {
    const ids = d.ids.split(',').map(Number);
    const primary = pickPrimary(d.ids);
    if (!primary) continue;
    const others = ids.filter((id) => id !== primary);
    for (const oid of others) {
      updateGirlShop.run(primary, oid);
      deactivateShop.run(oid);
      mergedCount++;
    }
    mergeLog.push({ pref: d.prefecture, nk: d.nk, primary, others });
  }
});

if (APPLY) {
  txn();
  console.log(`✅ 統合完了: ${mergedCount}件を is_active=0 に`);
} else {
  console.log(`(dry-run) ${dups.length}グループ → ${totalToMerge}件統合予定`);
  console.log('\n統合プレビュー (Top 10):');
  for (const d of dups.slice(0, 10)) {
    const ids = d.ids.split(',').map(Number);
    const primary = pickPrimary(d.ids);
    const primaryName = db.prepare('SELECT name FROM shops WHERE id=?').get(primary).name;
    console.log(`  [${d.pref}] 正=${primary}(${primaryName}) ← マージ${ids.length - 1}件 ids:${ids.filter((i) => i !== primary).join(',')}`);
  }
}

const after = db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c;
console.log(`\n${APPLY ? 'After' : 'Predicted'} active shops: ${after}${APPLY ? '' : ` (現在 - ${totalToMerge})`}`);

db.close();
