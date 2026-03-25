#!/usr/bin/env node
/**
 * エリア統合マイグレーション v2
 *
 * パネマジ掲示板の東京エリアを独自定義16エリアに統合
 * - 沿線名（東急沿線/西武沿線/東武沿線）を廃止し地域名に統合
 * - 吉原を上野・鶯谷に統合
 * - 福生・青梅（1店舗）を立川に統合
 * - 東京・日本橋を新橋・銀座に統合
 * - 国分寺・国立を吉祥寺・府中に統合
 *
 * 他県: 0店舗エリアを削除、display_orderを設定
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

console.log('='.repeat(60));
console.log('エリア統合マイグレーション v2');
console.log('='.repeat(60));

// ─── Helper ─────────────────────────────────────────────────
function countShops(areaId) {
  return db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(areaId).c;
}
function areaName(areaId) {
  const row = db.prepare('SELECT name FROM areas WHERE id = ?').get(areaId);
  return row ? row.name : `(not found: ${areaId})`;
}

// ─── Tokyo merge rules ──────────────────────────────────────
// [source_id, target_id]  source shops → target, then delete source
const TOKYO_MERGES = [
  // 吉原 → 上野・鶯谷
  { from: 7, to: 8 },
  // 東京・日本橋 → 新橋・銀座
  { from: 13, to: 11 },
  // 板橋・東武沿線 → 大塚・巣鴨
  { from: 19, to: 20 },
  // 東急沿線 → 吉祥寺・府中
  { from: 16, to: 23 },
  // 西武沿線 → 吉祥寺・府中
  { from: 18, to: 23 },
  // 国分寺・国立 → 吉祥寺・府中
  { from: 21, to: 23 },
  // 福生・青梅 → 立川・八王子
  { from: 25, to: 24 },
];

// Rename after merge
const RENAMES = [
  { id: 3, name: '渋谷・恵比寿', slug: 'shibuya' },
  { id: 5, name: '品川・田町', slug: 'shinagawa' },
  { id: 6, name: '蒲田・大井町', slug: 'kamata' },
  { id: 8, name: '上野・鶯谷・浅草', slug: 'ueno' },
  { id: 11, name: '新橋・銀座', slug: 'shinbashi' },         // already correct
  { id: 12, name: '秋葉原・神田', slug: 'akihabara' },       // already correct
  { id: 14, name: '六本木・赤坂', slug: 'roppongi' },         // already correct
  { id: 20, name: '大塚・巣鴨・赤羽', slug: 'otsuka' },
  { id: 23, name: '吉祥寺・府中', slug: 'kichijoji' },       // already correct
  { id: 24, name: '立川・八王子', slug: 'tachikawa' },        // already correct
  { id: 9, name: '錦糸町・小岩', slug: 'kinshicho' },         // already correct
  { id: 15, name: '飯田橋・市ヶ谷', slug: 'iidabashi' },     // already correct
];

// Final display order (1-based)
const TOKYO_DISPLAY_ORDER = [
  1,   // 新宿
  2,   // 池袋
  3,   // 渋谷・恵比寿
  4,   // 五反田・目黒
  5,   // 品川・田町
  6,   // 蒲田・大井町
  8,   // 上野・鶯谷・浅草
  9,   // 錦糸町・小岩
  11,  // 新橋・銀座
  12,  // 秋葉原・神田
  14,  // 六本木・赤坂
  20,  // 大塚・巣鴨・赤羽
  23,  // 吉祥寺・府中
  24,  // 立川・八王子
  15,  // 飯田橋・市ヶ谷
];

// ─── Step 1: Merge Tokyo areas ──────────────────────────────
console.log('\n[Step 1] 東京エリア統合');
const moveShops = db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?');
const deleteArea = db.prepare('DELETE FROM areas WHERE id = ?');

const mergeTransaction = db.transaction(() => {
  for (const { from, to } of TOKYO_MERGES) {
    const shopCount = countShops(from);
    const fromName = areaName(from);
    const toName = areaName(to);
    console.log(`  ${fromName}(${from}) → ${toName}(${to}): ${shopCount}店舗移動`);
    moveShops.run(to, from);
    deleteArea.run(from);
  }
});
mergeTransaction();

// ─── Step 2: Rename Tokyo areas ─────────────────────────────
console.log('\n[Step 2] エリア名リネーム');
const renameArea = db.prepare('UPDATE areas SET name = ?, slug = ? WHERE id = ?');
const renameTransaction = db.transaction(() => {
  for (const { id, name, slug } of RENAMES) {
    const current = db.prepare('SELECT name FROM areas WHERE id = ?').get(id);
    if (!current) continue;
    if (current.name !== name) {
      console.log(`  ${current.name} → ${name}`);
      renameArea.run(name, slug, id);
    }
  }
});
renameTransaction();

// ─── Step 3: Set display_order for Tokyo ────────────────────
console.log('\n[Step 3] 東京 display_order設定');
const setOrder = db.prepare('UPDATE areas SET display_order = ? WHERE id = ?');
const orderTransaction = db.transaction(() => {
  for (let i = 0; i < TOKYO_DISPLAY_ORDER.length; i++) {
    setOrder.run(i + 1, TOKYO_DISPLAY_ORDER[i]);
  }
});
orderTransaction();
console.log(`  ${TOKYO_DISPLAY_ORDER.length}エリアに順序設定`);

// ─── Step 4: Clean up other prefectures ─────────────────────
console.log('\n[Step 4] 他県の整理');

// Delete 0-shop areas
const emptyAreas = db.prepare(`
  SELECT a.id, a.name, a.prefecture
  FROM areas a
  WHERE (SELECT COUNT(*) FROM shops WHERE area_id = a.id) = 0
`).all();

const cleanupTransaction = db.transaction(() => {
  for (const a of emptyAreas) {
    console.log(`  削除(0店舗): ${a.prefecture} / ${a.name}(${a.id})`);
    deleteArea.run(a.id);
  }
});
cleanupTransaction();

// Set display_order for non-Tokyo prefectures (order by shop count desc within prefecture)
console.log('\n[Step 5] 他県の display_order設定');
const prefectures = db.prepare(`
  SELECT DISTINCT prefecture FROM areas WHERE prefecture != 'tokyo' ORDER BY prefecture
`).all().map(r => r.prefecture);

const otherOrderTransaction = db.transaction(() => {
  for (const pref of prefectures) {
    const areas = db.prepare(`
      SELECT a.id, a.name,
        (SELECT COUNT(*) FROM shops WHERE area_id = a.id) as shop_count
      FROM areas a
      WHERE a.prefecture = ?
      ORDER BY a.id
    `).all(pref);
    for (let i = 0; i < areas.length; i++) {
      setOrder.run(i + 1, areas[i].id);
    }
  }
});
otherOrderTransaction();
console.log(`  ${prefectures.length}都道府県の表示順を設定`);

// ─── Verify: Show final Tokyo areas ─────────────────────────
console.log('\n' + '='.repeat(60));
console.log('統合結果 - 東京エリア');
console.log('='.repeat(60));
const tokyoAreas = db.prepare(`
  SELECT a.id, a.name, a.slug, a.display_order,
    (SELECT COUNT(*) FROM shops WHERE area_id = a.id) as shop_count
  FROM areas a
  WHERE a.prefecture = 'tokyo'
  ORDER BY a.display_order
`).all();

for (const a of tokyoAreas) {
  console.log(`  ${a.display_order}\t${a.name}\t(${a.slug})\t${a.shop_count}店舗`);
}
console.log(`  合計: ${tokyoAreas.length}エリア`);

// Summary
const totalAreas = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
const totalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get().c;
const orphanShops = db.prepare(`
  SELECT COUNT(*) as c FROM shops
  WHERE area_id NOT IN (SELECT id FROM areas)
`).get().c;

console.log('\n' + '='.repeat(60));
console.log(`サマリー: ${totalAreas}エリア, ${totalShops}アクティブ店舗`);
if (orphanShops > 0) {
  console.log(`  ⚠ 孤立店舗: ${orphanShops} (area_idが存在しないエリアを参照)`);
} else {
  console.log('  孤立店舗なし（整合性OK）');
}
console.log('='.repeat(60));

db.pragma('foreign_keys = ON');
db.close();
