#!/usr/bin/env node
/**
 * 既存DB shops テーブルの重複候補を集計
 *  使い方: node scripts/preview-duplicate-shops.mjs [--limit 30]
 *
 *  「同一都道府県 × 正規化名一致」を重複候補とみなす（チェーン店の別エリアは別店舗扱い）。
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { normalizeShopName, registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'panemaji.db');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 30;

const db = new Database(dbPath, { readonly: true });
registerNormalizeUdf(db);

// 重複候補集計: 同一 prefecture + normalize_shop 一致
const dups = db.prepare(`
  WITH n AS (
    SELECT s.id, s.name, s.category, a.prefecture, normalize_shop(s.name) AS nk
    FROM shops s LEFT JOIN areas a ON s.area_id = a.id
    WHERE s.is_active=1 AND length(normalize_shop(s.name)) >= 2
  )
  SELECT prefecture, nk, COUNT(*) as cnt, GROUP_CONCAT(name, ' | ') as names, GROUP_CONCAT(id) as ids
  FROM n
  GROUP BY prefecture, nk
  HAVING cnt >= 2
  ORDER BY cnt DESC, prefecture
`).all();

const totalDupGroups = dups.length;
const totalDupShops = dups.reduce((s, d) => s + d.cnt, 0);
const wouldBeMerged = totalDupShops - totalDupGroups;

console.log(`総active shops: ${db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c}`);
console.log(`重複グループ: ${totalDupGroups}`);
console.log(`重複に巻き込まれているshops合計: ${totalDupShops}`);
console.log(`統合で減るshops数: ${wouldBeMerged}\n`);

console.log(`重複候補 Top ${Math.min(LIMIT, dups.length)}:`);
for (const d of dups.slice(0, LIMIT)) {
  console.log(`  [${d.prefecture}] (${d.cnt}件) ${d.names}`);
}

db.close();
