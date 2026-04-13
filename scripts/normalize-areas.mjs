#!/usr/bin/env node
/**
 * エリア・カテゴリの正規化スクリプト
 *
 * 1. 重複エリアを統合（空エリアの店舗を主エリアに移動）
 * 2. カテゴリ名を正規化
 * 3. 不要なカテゴリ（キャバクラ等）の店舗を非アクティブ化
 * 4. 空エリアを削除
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // 一時的にFK無効化

// ─── カテゴリ正規化マッピング ─────────────────────────
const CATEGORY_MAP = {
  'デリヘル': 'デリヘル',
  'ソープ': 'ソープ',
  'ヘルス': 'ヘルス',
  'トクヨク・ヘルス': 'ヘルス',
  'エンジェル・ヘルス': 'ヘルス',
  'ホテヘル': 'ホテヘル',
  'メンズエステ': 'メンエス',
  'エステ・アロマ': 'メンエス',
  'セクキャバ': null, // 除外
  'ツーショット・セクキャバ': null, // 除外
  'キャバクラ': null, // 除外
  '待ち合わせ': 'その他',
};

// ─── エリア統合マッピング（重複エリアを主エリアに統合）─────
// key: 統合先のslug, value: 統合元のslugリスト
const AREA_MERGE_MAP = {
  // === 東京 ===
  'shinjuku': ['tokyo-a1304'], // 新宿・大久保・高田馬場・中野 → 新宿・歌舞伎町
  'ikebukuro': [],
  'shibuya': ['tokyo-a1303'], // 渋谷・恵比寿・原宿・青山 → 渋谷・恵比寿
  'gotanda': ['tokyo-a1317'], // 五反田・目黒・白金 → 五反田・目黒
  'shinagawa': ['tokyo-a1315'], // 品川・田町・浜松町 → 品川・田町
  'kamata': ['tokyo-a1316'], // 蒲田・大井 → 蒲田・大井町
  'ueno': ['tokyo-a1311', 'tokyo-a1312'], // 吉原・浅草, 上野・鶯谷・日暮里・葛飾 → 上野・鶯谷・浅草
  'kinshicho': ['tokyo-a1313'], // 錦糸町・小岩・葛西 → 錦糸町・亀戸・小岩
  'shinbashi': ['tokyo-a1301'], // 新橋・銀座・有楽町 → 新橋・銀座
  'roppongi': ['tokyo-a1307'], // 六本木・赤坂・麻布・広尾 → 六本木・赤坂
  'akihabara': ['tokyo-a1310', 'tokyo-a1302'], // 秋葉原・神田・水道橋, 東京・日本橋 → 秋葉原・神田
  'iidabashi': ['tokyo-a1309'], // 飯田橋・市ヶ谷・四ツ谷 → 飯田橋・市ヶ谷
  'otsuka': ['tokyo-a1324'], // 大塚・巣鴨・駒込・赤羽 → 大塚・巣鴨・赤羽
  'nakano': ['tokyo-a1320'], // 中野 → 中野・高円寺・荻窪
  'kitasenju': [],
  'kichijoji': ['tokyo-a1321', 'tokyo-a1326', 'tokyo-a1327'], // 吉祥寺・府中・調布, 国分寺・国立, 府中 → 吉祥寺・三鷹・府中
  'tachikawa': ['tokyo-a1330', 'tokyo-a1331', 'tokyo-a1329', 'tokyo-a1332'], // 立川・八王子, 福生・青梅, 西東京, 伊豆 → 立川・八王子・町田
  'tokyo-other': ['tokyo-a1314', 'tokyo-a1318', 'tokyo-a1319', 'tokyo-a1322', 'tokyo-a1323', 'tokyo-a1325'], // 築地, 東急, 京王, 西武, 板橋 → 東京その他

  // === 大阪 ===
  // 大阪はfuzoku.jpから大量のエリアが追加されている。主要エリアに統合
};

// ─── 実行 ─────────────────────────────────────────────
console.log('=== カテゴリ正規化 ===');

// 1. カテゴリ正規化
const updateCat = db.prepare('UPDATE shops SET category = ? WHERE category = ?');
const deactivateShops = db.prepare('UPDATE shops SET is_active = 0 WHERE category = ?');

for (const [from, to] of Object.entries(CATEGORY_MAP)) {
  if (to === null) {
    const r = deactivateShops.run(from);
    if (r.changes > 0) console.log(`  除外: ${from} → ${r.changes}店を非アクティブ化`);
  } else if (from !== to) {
    const r = updateCat.run(to, from);
    if (r.changes > 0) console.log(`  統合: ${from} → ${to} (${r.changes}店)`);
  }
}

// 2. エリア統合
console.log('\n=== エリア統合 ===');

const getAreaBySlug = db.prepare('SELECT id, name FROM areas WHERE slug = ?');
const moveShops = db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?');
const moveGirls = db.prepare('UPDATE girls SET shop_id = shop_id WHERE shop_id IN (SELECT id FROM shops WHERE area_id = ?)');
const deleteEmptyArea = db.prepare('DELETE FROM areas WHERE id = ? AND NOT EXISTS (SELECT 1 FROM shops WHERE area_id = ?)');

let mergedCount = 0;
for (const [targetSlug, sourceSlugList] of Object.entries(AREA_MERGE_MAP)) {
  const target = getAreaBySlug.get(targetSlug);
  if (!target) continue;

  for (const srcSlug of sourceSlugList) {
    const src = getAreaBySlug.get(srcSlug);
    if (!src) continue;

    const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(src.id).c;
    if (shopCount > 0) {
      moveShops.run(target.id, src.id);
      console.log(`  統合: ${src.name} (${shopCount}店) → ${target.name}`);
      mergedCount += shopCount;
    }

    // 空になったエリアを削除
    deleteEmptyArea.run(src.id, src.id);
  }
}

// 3. 全都道府県の空エリアを自動検出・削除
console.log('\n=== 空エリア削除 ===');
const emptyAreas = db.prepare(`
  SELECT a.id, a.name, a.slug, a.prefecture
  FROM areas a
  WHERE NOT EXISTS (SELECT 1 FROM shops s WHERE s.area_id = a.id AND s.is_active = 1)
  ORDER BY a.prefecture, a.name
`).all();

let deletedCount = 0;
for (const area of emptyAreas) {
  // 嬢データがある場合は削除しない
  const girlCount = db.prepare('SELECT COUNT(*) as c FROM girls g JOIN shops s ON g.shop_id = s.id WHERE s.area_id = ?').get(area.id).c;
  if (girlCount > 0) continue;

  db.prepare('DELETE FROM areas WHERE id = ?').run(area.id);
  deletedCount++;
}
console.log(`  ${deletedCount}件の空エリアを削除`);

// 4. 大阪エリアの統合（fuzoku.jp由来の細かいエリアを主要エリアに統合）
console.log('\n=== 大阪エリア統合 ===');

// 大阪の主要エリア定義
const OSAKA_MERGE = {
  'minami': { name: '難波・日本橋', includes: ['難波/道頓堀', '天王寺/阿倍野', '松原', '藤井寺', '八尾'] },
  'umeda': { name: '梅田・北新地', includes: ['新大阪/西中島', '豊中', '茨木', '高槻', '守口', '門真'] },
  'sakai': { name: '堺・泉州', includes: ['岸和田', '貝塚', '高石', '泉大津', '和泉', '泉佐野'] },
  'higashi-osaka': { name: '東大阪・八尾', includes: ['東大阪', '大東', '四條畷'] },
  'juso': { name: '十三・新大阪', includes: ['十三/塚本'] },
};

for (const [targetSlug, config] of Object.entries(OSAKA_MERGE)) {
  const target = db.prepare("SELECT id FROM areas WHERE slug = ? OR name = ?").get(targetSlug, config.name);
  if (!target) continue;

  for (const srcName of config.includes) {
    const src = db.prepare("SELECT id, name FROM areas WHERE name LIKE ? AND prefecture = 'osaka'").get(`%${srcName}%`);
    if (!src || src.id === target.id) continue;

    const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(src.id).c;
    if (shopCount > 0) {
      moveShops.run(target.id, src.id);
      console.log(`  大阪統合: ${src.name} (${shopCount}店) → ${config.name}`);
    }
    // 空になったら削除
    const remaining = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(src.id).c;
    if (remaining === 0) {
      db.prepare('DELETE FROM areas WHERE id = ?').run(src.id);
    }
  }
}

// 5. 外部口コミを全削除（ユーザー投稿のみ残す）
console.log('\n=== 外部口コミ削除 ===');
const extReviewCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-%' OR browser_id LIKE 'x-import-%' OR browser_id LIKE 'trend-%' OR browser_id LIKE 'fujoho-%'").get().c;
db.prepare("DELETE FROM reviews WHERE browser_id LIKE 'ext-%' OR browser_id LIKE 'x-import-%' OR browser_id LIKE 'trend-%' OR browser_id LIKE 'fujoho-%'").run();
console.log(`  ${extReviewCount}件の外部口コミを削除`);
const remainingReviews = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
console.log(`  残りユーザー口コミ: ${remainingReviews}件`);

// review集計カラムのリセット（shop/girlのreview_count等）
// shops テーブルの口コミ集計を再計算
try {
  db.prepare(`UPDATE shops SET
    review_count = (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = shops.id),
    panel_match_count = (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = shops.id AND r.panel_rating = 'panel_match'),
    panel_diff_count = (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = shops.id AND r.panel_rating = 'panel_diff'),
    jirai_count = (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = shops.id AND r.panel_rating = 'jirai')
    WHERE is_active = 1
  `).run();
  console.log('  shops口コミ集計を再計算');
} catch(e) { console.log('  shops集計更新スキップ: ' + e.message); }

// 6. 最終統計
console.log('\n=== 最終統計 ===');
const finalAreas = db.prepare('SELECT COUNT(*) as c FROM areas').get().c;
const finalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get().c;
const finalGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get().c;
const finalCats = db.prepare('SELECT category, COUNT(*) as c FROM shops WHERE is_active = 1 GROUP BY category ORDER BY c DESC').all();

console.log(`エリア: ${finalAreas}`);
console.log(`店舗: ${finalShops}`);
console.log(`嬢: ${finalGirls}`);
console.log('カテゴリ:');
finalCats.forEach(c => console.log(`  ${c.category}: ${c.c}店`));

// 都道府県別エリア数
console.log('\n=== 都道府県別エリア数 ===');
const prefAreas = db.prepare(`
  SELECT a.prefecture, COUNT(DISTINCT a.id) as area_count
  FROM areas a
  JOIN shops s ON s.area_id = a.id AND s.is_active = 1
  WHERE a.prefecture IS NOT NULL
  GROUP BY a.prefecture
  ORDER BY a.prefecture
`).all();
prefAreas.forEach(p => console.log(`${p.prefecture}: ${p.area_count}エリア`));

db.pragma('foreign_keys = ON');
db.close();
console.log('\n✅ 正規化完了');
