#!/usr/bin/env node
/**
 * 全shopsに cleanShopName() を適用
 *  使い方:
 *   node scripts/preview-clean-shop-names.mjs [--limit 100]   # dry-run
 *   node scripts/preview-clean-shop-names.mjs --apply         # 実際にUPDATE
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { cleanShopName } from './lib/clean-shop-name.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'panemaji.db');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 0;
const APPLY = process.argv.includes('--apply');

const db = new Database(dbPath, { readonly: !APPLY });
const shops = db.prepare('SELECT id, name FROM shops WHERE is_active=1').all();

const fixes = [];
const broken = []; // 短くなりすぎ等
for (const s of shops) {
  const c = cleanShopName(s.name);
  if (c !== s.name) {
    if (!c || c.length < 2) {
      broken.push({ id: s.id, old: s.name, new: c });
    } else {
      fixes.push({ id: s.id, old: s.name, new: c });
    }
  }
}

console.log(`総shops(active): ${shops.length}`);
console.log(`変化あり: ${fixes.length}件 (${(fixes.length / shops.length * 100).toFixed(2)}%)`);
console.log(`空/1文字に縮みすぎ(=破壊回避): ${broken.length}件\n`);

const showCount = LIMIT > 0 ? Math.min(LIMIT, fixes.length) : fixes.length;
console.log(`変更プレビュー (${showCount}件):`);
for (let i = 0; i < showCount; i++) {
  const f = fixes[i];
  console.log(`  [${f.id}] "${f.old}"`);
  console.log(`        →  "${f.new}"`);
}

if (broken.length > 0) {
  console.log(`\n⚠️  破壊される(短すぎ)で skip した例:`);
  for (const b of broken.slice(0, 10)) {
    console.log(`  [${b.id}] "${b.old}" → "${b.new}"  (skip)`);
  }
}

if (APPLY) {
  const upd = db.prepare('UPDATE shops SET name=? WHERE id=?');
  const txn = db.transaction(() => {
    for (const f of fixes) upd.run(f.new, f.id);
  });
  txn();
  console.log(`\n✅ ${fixes.length}件 UPDATE 完了`);
}
db.close();
