#!/usr/bin/env node
/**
 * fix-shop-names.mjs
 * Fixes shop names that have bad suffixes like "の超割引クーポン" from fues.jp scraping.
 * Also handles area-name prefixes on aromaesthe shops.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'panemaji.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Patterns to strip from end of shop names
const SUFFIX_PATTERNS = [
  /の超割引クーポン$/,
  /のクーポン$/,
  /クーポン$/,
];

// Get all shops that need fixing
const shops = db.prepare(`
  SELECT id, name, source_url FROM shops
  WHERE name LIKE '%クーポン%'
     OR name LIKE '%超割引%'
`).all();

console.log(`Found ${shops.length} shops with potentially bad names`);

const updateStmt = db.prepare('UPDATE shops SET name = ? WHERE id = ?');

let fixedCount = 0;
const fixes = [];

for (const shop of shops) {
  let newName = shop.name;

  for (const pattern of SUFFIX_PATTERNS) {
    newName = newName.replace(pattern, '');
  }

  // Trim whitespace
  newName = newName.trim();

  if (newName !== shop.name && newName.length > 0) {
    fixes.push({ id: shop.id, oldName: shop.name, newName });
  }
}

console.log(`\nWill fix ${fixes.length} shop names:`);
for (const fix of fixes.slice(0, 20)) {
  console.log(`  [${fix.id}] "${fix.oldName}" -> "${fix.newName}"`);
}
if (fixes.length > 20) {
  console.log(`  ... and ${fixes.length - 20} more`);
}

// Apply fixes
const txn = db.transaction(() => {
  for (const fix of fixes) {
    updateStmt.run(fix.newName, fix.id);
    fixedCount++;
  }
});
txn();

console.log(`\nFixed ${fixedCount} shop names.`);
db.close();
