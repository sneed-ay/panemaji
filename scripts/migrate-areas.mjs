#!/usr/bin/env node
/**
 * エリア統合マイグレーション
 *
 * 問題: cityheavenのデリヘル用エリアとソープ/ヘルス用エリアが別々にDBに入っていて重複
 * 解決: パネマジ独自のエリアマスターに統合
 *
 * 東京の統合ルール:
 *   - 「新宿・大久保・高田馬場・中野」(315) → 「新宿・歌舞伎町」(1) に統合
 *   - 「渋谷・恵比寿・原宿・青山」(325) → 「渋谷」(3) に統合
 *   - 「吉原・浅草」(290) → 「吉原」(7) に統合 (上野・鶯谷エリアに近いがソープ街として独立維持)
 *   - 「立川市・八王子市周辺」(326) → 「立川・八王子」(24) に統合
 *   - 「京王・小田急沿線」(17) → 「吉祥寺・府中」(23) に統合
 *   - 「東急沿線」(16), 「西武沿線」(18), 「東武沿線」(19→板橋) はそのまま残す
 *   - 「伊豆諸島」(26), 「西東京」(22) → 空なら削除
 *   - 「築地・お台場」(10) → 「新橋・銀座」(11) に統合
 *
 * エリア名の整理:
 *   - 「新宿・歌舞伎町」→「新宿」に改名
 *   - 「上野・鶯谷」→「上野・鶯谷」(変更なし)
 *   - 「五反田・目黒」(変更なし)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // Temporarily disable for migration

// ─── Tokyo area merge rules: [source_id] → target_id ─────────
const TOKYO_MERGES = [
  { from: 315, to: 1 },   // 新宿・大久保・高田馬場・中野 → 新宿・歌舞伎町
  { from: 325, to: 3 },   // 渋谷・恵比寿・原宿・青山 → 渋谷
  { from: 290, to: 7 },   // 吉原・浅草 → 吉原
  { from: 326, to: 24 },  // 立川市・八王子市周辺 → 立川・八王子
  { from: 17, to: 23 },   // 京王・小田急沿線 → 吉祥寺・府中
  { from: 10, to: 11 },   // 築地・お台場 → 新橋・銀座
];

// Areas to delete if they have 0 shops after merge
const TOKYO_CLEANUP = [26, 22]; // 伊豆諸島, 西東京

// Rename some areas for clarity
const RENAMES = [
  { id: 1, newName: '新宿', newSlug: 'shinjuku' },
  // Keep others as they are - they're clear enough
];

console.log('='.repeat(60));
console.log('エリア統合マイグレーション開始');
console.log('='.repeat(60));

// ─── Step 1: Merge shops ─────────────────────────────────────
const moveShops = db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?');
const moveGirls = db.prepare(`
  UPDATE girls SET shop_id = shop_id WHERE shop_id IN (
    SELECT id FROM shops WHERE area_id = ?
  )
`);

const mergeTransaction = db.transaction(() => {
  for (const { from, to } of TOKYO_MERGES) {
    const fromArea = db.prepare('SELECT name FROM areas WHERE id = ?').get(from);
    const toArea = db.prepare('SELECT name FROM areas WHERE id = ?').get(to);
    if (!fromArea || !toArea) {
      console.log(`  スキップ: area ${from} or ${to} not found`);
      continue;
    }

    const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(from).c;
    console.log(`  統合: ${fromArea.name}(${from}) → ${toArea.name}(${to}): ${shopCount}店舗`);

    moveShops.run(to, from);

    // Delete old area
    db.prepare('DELETE FROM areas WHERE id = ?').run(from);
  }

  // Clean up empty areas
  for (const areaId of TOKYO_CLEANUP) {
    const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(areaId).c;
    if (shopCount === 0) {
      const area = db.prepare('SELECT name FROM areas WHERE id = ?').get(areaId);
      if (area) {
        console.log(`  削除: ${area.name}(${areaId}) - 店舗0`);
        db.prepare('DELETE FROM areas WHERE id = ?').run(areaId);
      }
    }
  }

  // Rename areas
  for (const { id, newName, newSlug } of RENAMES) {
    db.prepare('UPDATE areas SET name = ?, slug = ? WHERE id = ?').run(newName, newSlug, id);
    console.log(`  改名: id=${id} → ${newName} (${newSlug})`);
  }
});

mergeTransaction();

// ─── Step 2: Verify results ──────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('統合結果 - 東京エリア');
console.log('='.repeat(60));

const tokyoAreas = db.prepare(`
  SELECT a.id, a.name, a.slug,
    (SELECT COUNT(*) FROM shops WHERE area_id = a.id AND is_active = 1) as shop_count
  FROM areas a
  WHERE a.prefecture = 'tokyo'
  ORDER BY shop_count DESC, a.name
`).all();

for (const a of tokyoAreas) {
  console.log(`  ${a.id}\t${a.name}\t(${a.slug})\t${a.shop_count}店舗`);
}
console.log(`  合計: ${tokyoAreas.length}エリア`);

// ─── Step 3: Set display_order for Tokyo areas ────────────────
// Add display_order column if not exists
try {
  db.prepare('ALTER TABLE areas ADD COLUMN display_order INTEGER DEFAULT 999').run();
  console.log('\n  display_orderカラム追加');
} catch {
  // Column already exists
}

// Set preferred order for Tokyo
const TOKYO_ORDER = [
  'shinjuku',        // 新宿
  'ikebukuro',       // 池袋
  'shibuya',         // 渋谷
  'gotanda',         // 五反田・目黒
  'shinagawa',       // 品川
  'shinbashi',       // 新橋・銀座
  'ueno',            // 上野・鶯谷
  'yoshiwara',       // 吉原
  'kinshicho',       // 錦糸町・小岩
  'akihabara',       // 秋葉原・神田
  'roppongi',        // 六本木・赤坂
  'kamata',          // 蒲田・大井
  'otsuka',          // 大塚・巣鴨
  'itabashi',        // 板橋・東武沿線
  'iidabashi',       // 飯田橋・市ヶ谷
  'tokyo-st',        // 東京・日本橋
  'tachikawa',       // 立川・八王子
  'kichijoji',       // 吉祥寺・府中
  'kokubunji',       // 国分寺・国立
  'seibu',           // 西武沿線
  'tokyu',           // 東急沿線
  'fussa',           // 福生・青梅
];

const setOrder = db.prepare('UPDATE areas SET display_order = ? WHERE slug = ?');
const orderTransaction = db.transaction(() => {
  for (let i = 0; i < TOKYO_ORDER.length; i++) {
    setOrder.run(i + 1, TOKYO_ORDER[i]);
  }
});
orderTransaction();

console.log('\n  東京エリアの表示順設定完了');

// ─── Summary ──────────────────────────────────────────────────
const totalAreas = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
const totalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get().c;
console.log('\n' + '='.repeat(60));
console.log(`サマリー: ${totalAreas}エリア, ${totalShops}店舗`);
console.log('='.repeat(60));

db.pragma('foreign_keys = ON');
db.close();
