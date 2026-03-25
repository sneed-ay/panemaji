#!/usr/bin/env node
/**
 * fix-area-tags.mjs
 * Fixes shops that are assigned to wrong areas based on location keywords in their names.
 *
 * Main issue: aromaesthe.co.jp shops from outside Tokyo are all placed in Tokyo areas
 * (typically Shinjuku area_id=1) because they were scraped from tokyo.aromaesthe.co.jp.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'panemaji.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Load all areas for lookup
const areas = db.prepare('SELECT id, name, slug, prefecture FROM areas').all();
const areaMap = new Map();
for (const a of areas) {
  areaMap.set(a.id, a);
}

// Find area by slug prefix or name match
function findAreaBySlug(slugPrefix) {
  return areas.find(a => a.slug === slugPrefix || a.slug.startsWith(slugPrefix + '-'));
}

function findAreaByNameContains(keyword) {
  return areas.find(a => a.name.includes(keyword));
}

// Keyword -> target area mapping
// Each entry: [keyword in shop name, target area finder function]
const LOCATION_RULES = [
  // Chiba prefecture
  { keyword: '津田沼', targetAreaId: () => findAreaByNameContains('船橋')?.id },       // 船橋・西船橋・八千代市
  { keyword: '船橋', targetAreaId: () => findAreaByNameContains('船橋')?.id },
  { keyword: '西船橋', targetAreaId: () => findAreaByNameContains('船橋')?.id },
  { keyword: '千葉', targetAreaId: () => findAreaByNameContains('千葉市')?.id },        // 千葉市・栄町
  { keyword: '柏', targetAreaId: () => findAreaByNameContains('柏')?.id },              // 柏・我孫子
  { keyword: '松戸', targetAreaId: () => findAreaByNameContains('松戸')?.id },          // 松戸・新松戸

  // Saitama prefecture
  { keyword: '大宮', targetAreaId: () => findAreaByNameContains('大宮')?.id },          // さいたま市・大宮周辺
  { keyword: '浦和', targetAreaId: () => findAreaByNameContains('大宮')?.id },          // さいたま市・大宮周辺
  { keyword: '南越谷', targetAreaId: () => findAreaByNameContains('越谷')?.id },        // 越谷市
  { keyword: '越谷', targetAreaId: () => findAreaByNameContains('越谷')?.id },
  { keyword: '所沢', targetAreaId: () => findAreaByNameContains('所沢')?.id },          // 所沢市・入間市
  { keyword: '和光', targetAreaId: () => findAreaByNameContains('大宮')?.id },          // Near Saitama
  { keyword: '川口', targetAreaId: () => findAreaByNameContains('西川口')?.id },        // 西川口・蕨市
  { keyword: '西川口', targetAreaId: () => findAreaByNameContains('西川口')?.id },

  // Kanagawa prefecture
  { keyword: '横浜', targetAreaId: () => findAreaByNameContains('横浜')?.id },          // 横浜・関内
  { keyword: '川崎', targetAreaId: () => findAreaByNameContains('川崎')?.id },          // 川崎

  // Tokyo sub-area corrections (shops with area names in different Tokyo areas)
  { keyword: '池袋', targetAreaId: () => findAreaByNameContains('池袋')?.id, onlyFromTokyo: true },
  { keyword: '新宿', targetAreaId: () => findAreaByNameContains('新宿')?.id, onlyFromTokyo: true },
  { keyword: '渋谷', targetAreaId: () => findAreaByNameContains('渋谷')?.id, onlyFromTokyo: true },
  { keyword: '五反田', targetAreaId: () => findAreaByNameContains('五反田')?.id, onlyFromTokyo: true },
  { keyword: '上野', targetAreaId: () => findAreaByNameContains('上野')?.id, onlyFromTokyo: true },
  { keyword: '秋葉原', targetAreaId: () => findAreaByNameContains('秋葉原')?.id, onlyFromTokyo: true },
  { keyword: '錦糸町', targetAreaId: () => findAreaByNameContains('錦糸町')?.id, onlyFromTokyo: true },
  { keyword: '新橋', targetAreaId: () => findAreaByNameContains('新橋')?.id, onlyFromTokyo: true },
  { keyword: '六本木', targetAreaId: () => findAreaByNameContains('六本木')?.id, onlyFromTokyo: true },
  { keyword: '蒲田', targetAreaId: () => findAreaByNameContains('蒲田')?.id, onlyFromTokyo: true },
  { keyword: '品川', targetAreaId: () => findAreaByNameContains('品川')?.id, onlyFromTokyo: true },
  { keyword: '北千住', targetAreaId: () => findAreaByNameContains('上野')?.id, onlyFromTokyo: true }, // 北千住 -> 上野・鶯谷・浅草 area
  { keyword: '葛西', targetAreaId: () => findAreaByNameContains('錦糸町')?.id, onlyFromTokyo: true }, // 葛西 -> 錦糸町・小岩 area
];

// Get all shops that might need area fixing
const shops = db.prepare(`
  SELECT s.id, s.name, s.area_id, s.source_url, a.name as area_name, a.prefecture
  FROM shops s
  JOIN areas a ON s.area_id = a.id
`).all();

const updateStmt = db.prepare('UPDATE shops SET area_id = ? WHERE id = ?');

let fixedCount = 0;
const fixes = [];

// All Tokyo area keywords for conflict detection
const TOKYO_AREA_KEYWORDS = ['池袋', '新宿', '渋谷', '五反田', '上野', '秋葉原', '錦糸町', '新橋', '銀座', '六本木', '蒲田', '品川', '北千住', '葛西', '大塚', '巣鴨', '赤羽'];

for (const shop of shops) {
  for (const rule of LOCATION_RULES) {
    if (!shop.name.includes(rule.keyword)) continue;

    const targetAreaId = rule.targetAreaId();
    if (!targetAreaId) continue;

    // Skip if already in correct area
    if (shop.area_id === targetAreaId) continue;

    const currentArea = areaMap.get(shop.area_id);
    if (!currentArea) continue;

    // For Tokyo sub-area rules, only apply if both current and target are Tokyo
    if (rule.onlyFromTokyo) {
      const targetArea = areaMap.get(targetAreaId);
      if (!targetArea) continue;
      if (currentArea.prefecture !== 'tokyo' || targetArea.prefecture !== 'tokyo') continue;

      // Skip shops that mention multiple Tokyo area keywords (ambiguous)
      const matchedKeywords = TOKYO_AREA_KEYWORDS.filter(kw => shop.name.includes(kw));
      if (matchedKeywords.length > 1) continue;
    }

    // For non-Tokyo rules, only move shops that are currently in a Tokyo area
    // but have non-Tokyo location keywords
    if (!rule.onlyFromTokyo) {
      // Only fix if shop is currently in a Tokyo area but keyword suggests elsewhere
      if (currentArea.prefecture !== 'tokyo') continue;
    }

    const targetArea = areaMap.get(targetAreaId);
    fixes.push({
      id: shop.id,
      name: shop.name,
      oldArea: shop.area_name,
      oldAreaId: shop.area_id,
      newArea: targetArea?.name || `area_${targetAreaId}`,
      newAreaId: targetAreaId,
      keyword: rule.keyword,
    });
    break; // Apply first matching rule only
  }
}

console.log(`Found ${fixes.length} shops with incorrect area assignments:\n`);

// Group by movement type for clearer output
const grouped = {};
for (const fix of fixes) {
  const key = `${fix.oldArea} -> ${fix.newArea}`;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(fix);
}

for (const [movement, items] of Object.entries(grouped)) {
  console.log(`${movement} (${items.length} shops):`);
  for (const item of items.slice(0, 5)) {
    console.log(`  [${item.id}] ${item.name} (keyword: ${item.keyword})`);
  }
  if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
  console.log('');
}

// Apply fixes
const txn = db.transaction(() => {
  for (const fix of fixes) {
    updateStmt.run(fix.newAreaId, fix.id);
    fixedCount++;
  }
});
txn();

console.log(`Fixed ${fixedCount} shop area assignments.`);
db.close();
