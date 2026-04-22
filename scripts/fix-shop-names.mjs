#!/usr/bin/env node
/**
 * fix-shop-names.mjs
 * shops.name から「の超割引クーポン」等の営業用サフィックスを除去する。
 * ロジックは scripts/lib/clean-shop-name.mjs に集約（スクレイパーと完全同一）。
 *
 * 使い方:
 *   node scripts/fix-shop-names.mjs            # dry-run で差分表示
 *   node scripts/fix-shop-names.mjs --apply    # 実際に UPDATE 実行
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cleanShopName } from './lib/clean-shop-name.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Render では /data/panemaji.db、ローカル/CI 環境ではリポジトリ直下の panemaji.db
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'panemaji.db');

const APPLY = process.argv.includes('--apply');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 対象候補を広めに取得（クリーニング関数が最終判定）
const shops = db.prepare(`
  SELECT id, name, source_url FROM shops
  WHERE name LIKE '%クーポン%'
     OR name LIKE '%超割引%'
     OR name LIKE '%割引%'
     OR name LIKE '%特典%'
`).all();

console.log(`候補: ${shops.length} 件を検査`);

const updateStmt = db.prepare('UPDATE shops SET name = ? WHERE id = ?');

const fixes = [];
for (const shop of shops) {
  const newName = cleanShopName(shop.name);
  if (newName && newName !== shop.name && newName.length >= 2 && newName.length <= 80) {
    fixes.push({ id: shop.id, oldName: shop.name, newName });
  }
}

console.log(`\n修正対象: ${fixes.length} 件`);
for (const fix of fixes) {
  console.log(`  [${fix.id}] "${fix.oldName}" -> "${fix.newName}"`);
}

if (!APPLY) {
  console.log('\n(dry-run) 実際に UPDATE するには --apply を付けて実行');
  db.close();
  process.exit(0);
}

const txn = db.transaction(() => {
  for (const fix of fixes) updateStmt.run(fix.newName, fix.id);
});
txn();

console.log(`\n✅ ${fixes.length} 件の shops.name を修正しました`);
db.close();
