#!/usr/bin/env node
/**
 * エリア正規化 v2 — 全都道府県の重複エリアを主エリアに統合
 *
 * 方針:
 * 1. 各都道府県で「主エリア」を定義（パネマジ独自定義）
 * 2. 重複・類似エリアの店舗を主エリアに移動
 * 3. 空になったエリアを削除
 * 4. エリア名から「(風俗じゃぱん)」「風俗」等のソース名を除去
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

// ─── 全都道府県のMECEエリア定義 ──────────────────────
// key = 統合先slug, value = { name: 正規名, merge: [統合元slugの配列] }
const AREA_DEFINITIONS = {
  // === 北海道 ===
  'sapporo': { name: '札幌・すすきの', merge: ['hokkaido-a0101'] },
  'asahikawa': { name: '旭川', merge: ['hokkaido-a0102'] },
  'hakodate': { name: '函館', merge: ['hokkaido-a0103'] },
  'obihiro': { name: '帯広・十勝', merge: [] },
  'tomakomai': { name: '苫小牧・室蘭・千歳', merge: ['hokkaido-a0105', 'hokkaido-a0104'] },
  'kushiro': { name: '釧路・北見・網走', merge: ['hokkaido-a0109'] },
  'hokkaido-other': { name: '北海道その他', merge: [] },

  // === 東北 ===
  'aomori-city': { name: '青森・弘前', merge: [] },
  'hachinohe': { name: '八戸・三沢', merge: [] },
  'aomori-other': { name: '青森その他', merge: [] },
  'morioka': { name: '盛岡', merge: ['iwate-a0301'] },
  'kitakami': { name: '北上・花巻・一関', merge: [] },
  'iwate-other': { name: '岩手その他', merge: [] },
  'sendai': { name: '仙台', merge: ['miyagi-a0402', 'miyagi-fj-a_1054'] },
  'ishinomaki': { name: '石巻・塩釜・松島', merge: ['miyagi-a0404', 'miyagi-a0405'] },
  'osaki': { name: '大崎・古川', merge: [] },
  'miyagi-other': { name: '宮城その他', merge: [] },
  'akita-city': { name: '秋田市', merge: ['akita-a0501'] },
  'akita-other': { name: '秋田その他', merge: [] },
  'yamagata-city': { name: '山形・天童', merge: ['yamagata-a0601'] },
  'yonezawa': { name: '米沢', merge: ['yamagata-a0602'] },
  'sakata': { name: '酒田・鶴岡・庄内', merge: ['yamagata-a0603'] },
  'shinjo': { name: '新庄・最上', merge: [] },
  'koriyama': { name: '郡山', merge: ['fukushima-a0702'] },
  'fukushima-city': { name: '福島・二本松', merge: [] },
  'iwaki': { name: 'いわき・小名浜', merge: ['fukushima-a0704'] },
  'aizu': { name: '会津若松', merge: [] },
  'shirakawa': { name: '白河', merge: [] },
  'fukushima-other': { name: '福島その他', merge: [] },

  // === 関東 ===
  'mito': { name: '水戸', merge: [] },
  'tsuchiura': { name: '土浦・つくば', merge: [] },
  'kashima': { name: '神栖・鹿嶋', merge: [] },
  'ibaraki-other': { name: '茨城その他', merge: [] },
  'utsunomiya': { name: '宇都宮', merge: ['tochigi-a0901'] },
  'oyama': { name: '小山・栃木・佐野', merge: ['tochigi-a0902', 'tochigi-a0904'] },
  'nasu': { name: '那須塩原・日光', merge: [] },
  'takasaki': { name: '高崎・前橋', merge: ['gunma-a1001'] },
  'ota': { name: '太田・伊勢崎・桐生', merge: ['gunma-a1002'] },
  'omiya': { name: '大宮・さいたま', merge: ['saitama-a1101', 'saitama-a1108'] },
  'kawaguchi': { name: '西川口・蕨・川口', merge: ['saitama-a1102', 'saitama-fj-a_2069'] },
  'kawagoe': { name: '川越', merge: ['saitama-a1103'] },
  'tokorozawa': { name: '所沢・入間', merge: [] },
  'koshigaya': { name: '越谷・草加・春日部', merge: ['saitama-a1104', 'saitama-a1115', 'saitama-a1117'] },
  'kumagaya': { name: '熊谷・深谷・本庄', merge: ['saitama-a1105'] },
  'kuki': { name: '久喜・蓮田', merge: [] },
  'saitama-other': { name: '埼玉その他', merge: ['saitama-a1108'] },
  'funabashi': { name: '船橋・西船橋・津田沼', merge: ['chiba-a1202'] },
  'kashiwa': { name: '柏・松戸', merge: ['chiba-a1210'] },
  'chiba-city': { name: '千葉・栄町', merge: ['chiba-a1201', 'chiba-a1208'] },
  'ichikawa': { name: '市川・浦安', merge: [] },
  'narita': { name: '成田・印西', merge: [] },
  'togane': { name: '東金・茂原', merge: [] },
  'kisarazu': { name: '木更津・市原', merge: ['chiba-a1211'] },
  'chiba-other': { name: '千葉その他', merge: [] },
  // 東京は既に統合済み
  'shinjuku': { name: '新宿・歌舞伎町', merge: [] },
  'ikebukuro': { name: '池袋', merge: [] },
  'shibuya': { name: '渋谷・恵比寿', merge: [] },
  'gotanda': { name: '五反田・目黒', merge: [] },
  'shinagawa': { name: '品川・田町', merge: [] },
  'kamata': { name: '蒲田・大井町', merge: [] },
  'ueno': { name: '上野・鶯谷・浅草', merge: [] },
  'kinshicho': { name: '錦糸町・亀戸・小岩', merge: [] },
  'shinbashi': { name: '新橋・銀座', merge: [] },
  'roppongi': { name: '六本木・赤坂', merge: [] },
  'akihabara': { name: '秋葉原・神田', merge: [] },
  'iidabashi': { name: '飯田橋・市ヶ谷', merge: [] },
  'otsuka': { name: '大塚・巣鴨・赤羽', merge: [] },
  'nakano': { name: '中野・高円寺・荻窪', merge: [] },
  'kitasenju': { name: '北千住・足立', merge: [] },
  'kichijoji': { name: '吉祥寺・三鷹・府中', merge: [] },
  'tachikawa': { name: '立川・八王子・町田', merge: [] },
  'tokyo-other': { name: '東京その他', merge: [] },
  'yokohama': { name: '横浜・関内', merge: ['kanagawa-a1401'] },
  'kawasaki': { name: '川崎', merge: [] },
  'yokosuka': { name: '横須賀・三浦', merge: [] },
  'fujisawa': { name: '藤沢・湘南', merge: [] },
  'atsugi': { name: '厚木・海老名・大和', merge: ['kanagawa-a1406'] },
  'sagamihara': { name: '相模原・橋本', merge: ['kanagawa-a1405'] },
  'odawara': { name: '小田原・箱根', merge: ['kanagawa-a1407'] },

  // === 中部 ===
  'niigata-city': { name: '新潟市', merge: [] },
  'nagaoka': { name: '長岡・三条', merge: [] },
  'joetsu': { name: '上越', merge: [] },
  'toyama-city': { name: '富山市', merge: [] },
  'takaoka': { name: '高岡・射水', merge: ['toyama-a1604', 'toyama-a1605'] },
  'toyama-other': { name: '富山その他', merge: [] },
  'kanazawa': { name: '金沢', merge: [] },
  'ishikawa-other': { name: '石川その他', merge: ['ishikawa-a1702', 'ishikawa-a1704'] },
  'fukui-city': { name: '福井', merge: ['fukui-a1801'] },
  'yamanashi': { name: '山梨', merge: ['yamanashi-a1901'] },
  'nagano-city': { name: '長野市・千曲', merge: ['nagano-a2001'] },
  'matsumoto': { name: '松本・安曇野', merge: [] },
  'ueda': { name: '上田・佐久・軽井沢', merge: [] },
  'suwa': { name: '諏訪・伊那・飯田', merge: [] },
  'gifu-city': { name: '岐阜・金津園', merge: ['gifu-a2101'] },
  'gifu-other': { name: '岐阜その他', merge: ['gifu-a2102'] },
  'shizuoka-city': { name: '静岡・焼津', merge: ['shizuoka-a2201', 'shizuoka-fj-a_3045', 'shizuoka-fj-a_3057', 'shizuoka-fj-a_3063'] },
  'hamamatsu': { name: '浜松・磐田', merge: ['shizuoka-a2202', 'shizuoka-fj-a_3043', 'shizuoka-fj-a_3062', 'shizuoka-fj-a_3060'] },
  'numazu': { name: '沼津・富士・伊豆', merge: ['shizuoka-a2203', 'shizuoka-fj-a_3054', 'shizuoka-fj-a_3210', 'shizuoka-fj-a_3209', 'shizuoka-fj-a_3208', 'shizuoka-fj-a_3206'] },
  'nagoya': { name: '名古屋', merge: ['aichi-fj-a_3003', 'aichi-fj-a_3198', 'aichi-fj-a_3178', 'aichi-fj-a_3196', 'aichi-fj-a_3004', 'aichi-fj-a_3175', 'aichi-fj-a_3171', 'aichi-fj-a_3176', 'aichi-fj-a_3195', 'aichi-fj-a_3005', 'aichi-fj-a_3002', 'aichi-a2302'] },
  'ichinomiya': { name: '一宮・稲沢', merge: ['aichi-fj-a_3007'] },
  'toyota': { name: '豊田・岡崎・刈谷', merge: ['aichi-a2305'] },
  'toyohashi': { name: '豊橋・豊川', merge: ['aichi-a2306'] },
  'aichi-other': { name: '愛知その他', merge: ['aichi-fj-a_3039', 'aichi-fj-a_3016', 'aichi-a2304'] },

  // === 近畿 ===
  'yokkaichi': { name: '四日市・桑名・鈴鹿', merge: [] },
  'tsu': { name: '津・松阪', merge: [] },
  'mie-other': { name: '三重その他', merge: ['mie-a2405'] },
  'shiga': { name: '滋賀', merge: ['shiga-a2502', 'shiga-a2503'] },
  'shiga-a2501': { name: '雄琴', merge: [] },
  'kyoto-city': { name: '京都', merge: ['kyoto-a2601', 'kyoto-a2602'] },
  'umeda': { name: '梅田・キタ・京橋', merge: ['osaka-a2701', 'osaka-fj-umeda_area', 'osaka-fj-a_4003', 'osaka-fj-a_4158', 'osaka-fj-a_4159', 'osaka-fj-a_4160', 'osaka-fj-a_4007', 'osaka-fj-a_4161', 'osaka-fj-a_4008', 'osaka-fj-a_4029'] },
  'namba': { name: '難波・日本橋・天王寺', merge: ['osaka-a2702', 'osaka-fj-a_4162', 'osaka-fj-a_4011', 'osaka-fj-a_4016', 'osaka-fj-a_4018', 'osaka-fj-a_4013', 'osaka-fj-a_4163', 'osaka-fj-a_4015', 'osaka-fj-a_4164'] },
  'sakai': { name: '堺・南大阪', merge: ['osaka-fj-a_4025', 'osaka-fj-minamiosaka_area', 'osaka-fj-a_4044'] },
  'osaka-a2708': { name: '東大阪・八尾', merge: ['osaka-fj-a_4169', 'osaka-fj-a_4032'] },
  'osaka-fj-a_4024': { name: '大阪その他', merge: [] },
  'kobe': { name: '神戸・阪神', merge: ['hyogo-a2802', 'hyogo-a2803'] },
  'hyogo-a2801': { name: '福原', merge: [] },
  'himeji': { name: '姫路・加古川・明石', merge: [] },
  'hyogo-other': { name: '兵庫その他', merge: [] },
  'nara-city': { name: '奈良', merge: ['nara-a2901'] },
  'wakayama-city': { name: '和歌山', merge: ['wakayama-a3001'] },

  // === 中国 ===
  'hiroshima-city': { name: '広島市', merge: ['hiroshima-fj-a_5097', 'hiroshima-fj-a_5016', 'hiroshima-fj-a_5003', 'hiroshima-a3402', 'hiroshima-fj-a_5005'] },
  'fukuyama': { name: '福山・尾道', merge: ['hiroshima-fj-a_5007'] },
  'hiroshima-other': { name: '広島その他', merge: [] },
  'okayama-city': { name: '岡山市', merge: ['okayama-a3301'] },
  'kurashiki': { name: '倉敷', merge: ['okayama-a3302'] },
  'okayama-other': { name: '岡山その他', merge: [] },
  'yamaguchi-city': { name: '山口・防府・周南', merge: ['yamaguchi-a3501', 'yamaguchi-a3505'] },
  'ube': { name: '宇部・小野田', merge: [] },
  'yamaguchi-other': { name: '山口その他', merge: [] },
  'shimane': { name: '島根', merge: ['shimane-a3201'] },

  // === 四国 ===
  'tokushima-city': { name: '徳島', merge: [] },
  'tokushima-other': { name: '徳島その他', merge: [] },
  'takamatsu': { name: '高松', merge: [] },
  'kagawa-other': { name: '香川その他', merge: ['kagawa-a3702', 'kagawa-a3703', 'kagawa-a3704'] },
  'matsuyama': { name: '松山', merge: ['ehime-a3801'] },
  'ehime-other': { name: '愛媛その他', merge: [] },
  'kochi-city': { name: '高知', merge: ['kochi-a3901'] },

  // === 九州 ===
  'fukuoka-city': { name: '福岡・中洲', merge: ['fukuoka-fj-hakata_area', 'fukuoka-fj-a_6003', 'fukuoka-fj-a_6111', 'fukuoka-fj-a_6117'] },
  'kitakyushu': { name: '北九州・筑豊', merge: ['fukuoka-fj-kitakyusyu_area', 'fukuoka-fj-a_6019'] },
  'kurume': { name: '久留米・筑後', merge: ['fukuoka-fj-a_6007', 'fukuoka-fj-a_6012', 'fukuoka-fj-a_6118', 'fukuoka-fj-a_6116'] },
  'shimonoseki': { name: '下関', merge: [] },
  'saga-city': { name: '佐賀', merge: ['saga-a4101', 'saga-a4102', 'saga-a4103'] },
  'nagasaki-city': { name: '長崎', merge: ['nagasaki-a4202'] },
  'sasebo': { name: '佐世保', merge: [] },
  'kumamoto-city': { name: '熊本市', merge: ['kumamoto-a4302'] },
  'kumamoto-other': { name: '熊本その他', merge: [] },
  'oita-city': { name: '大分市', merge: [] },
  'oita-other': { name: '大分その他', merge: ['oita-a4402', 'oita-a4403', 'oita-a4404'] },
  'miyazaki-city': { name: '宮崎', merge: ['miyazaki-a4501'] },
  'miyazaki-other': { name: '宮崎その他', merge: ['miyazaki-a4502'] },
  'kagoshima-city': { name: '鹿児島市', merge: ['kagoshima-a4602'] },
  'kagoshima-other': { name: '鹿児島その他', merge: [] },
  'naha': { name: '那覇', merge: ['okinawa-a4703'] },
  'okinawa-other': { name: '沖縄その他', merge: [] },
};

// ─── 実行 ─────────────────────────────────────────────

const getAreaBySlug = db.prepare('SELECT id, name FROM areas WHERE slug = ?');
const moveShops = db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?');
const updateAreaName = db.prepare('UPDATE areas SET name = ? WHERE id = ?');
const deleteArea = db.prepare('DELETE FROM areas WHERE id = ?');

console.log('=== エリア統合 ===');

let totalMerged = 0;
for (const [targetSlug, config] of Object.entries(AREA_DEFINITIONS)) {
  const target = getAreaBySlug.get(targetSlug);
  if (!target) continue;

  // 名前を正規化
  if (target.name !== config.name) {
    updateAreaName.run(config.name, target.id);
  }

  // 統合元を移動
  for (const srcSlug of config.merge) {
    const src = getAreaBySlug.get(srcSlug);
    if (!src) continue;
    const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(src.id).c;
    if (shopCount > 0) {
      moveShops.run(target.id, src.id);
      console.log(`  ${src.name} (${shopCount}店) → ${config.name}`);
      totalMerged += shopCount;
    }
    // 空になったら削除
    const remaining = db.prepare('SELECT COUNT(*) as c FROM shops WHERE area_id = ?').get(src.id).c;
    if (remaining === 0) deleteArea.run(src.id);
  }
}
console.log(`  合計 ${totalMerged} 店を統合\n`);

// ─── 残った空エリアを全削除 ──────────────────────────
console.log('=== 空エリア削除 ===');
const emptyAreas = db.prepare(`
  SELECT a.id, a.name, a.slug, a.prefecture
  FROM areas a
  WHERE NOT EXISTS (SELECT 1 FROM shops s WHERE s.area_id = a.id)
`).all();
for (const area of emptyAreas) {
  deleteArea.run(area.id);
}
console.log(`  ${emptyAreas.length}件の空エリアを削除\n`);

// ─── エリア名のクリーンアップ ────────────────────────
console.log('=== エリア名クリーンアップ ===');
const allAreas = db.prepare('SELECT id, name FROM areas').all();
let cleanedCount = 0;
for (const area of allAreas) {
  let newName = area.name;
  // ソース名を除去
  newName = newName.replace(/\(風俗じゃぱん\)/g, '').trim();
  newName = newName.replace(/風俗\(風俗じゃぱん\)/g, '').trim();
  newName = newName.replace(/ 風俗$/g, '').trim();
  newName = newName.replace(/風俗$/g, '').trim();
  newName = newName.replace(/\(ソープ ヘルス街\)/g, '').trim();
  // 重複スペース
  newName = newName.replace(/\s+/g, ' ').trim();
  if (newName !== area.name) {
    updateAreaName.run(newName, area.id);
    console.log(`  「${area.name}」→「${newName}」`);
    cleanedCount++;
  }
}
console.log(`  ${cleanedCount}件のエリア名をクリーンアップ\n`);

// ─── 最終統計 ────────────────────────────────────────
console.log('=== 最終統計 ===');
const finalAreas = db.prepare(`
  SELECT a.prefecture, COUNT(DISTINCT a.id) as area_count, COUNT(DISTINCT s.id) as shop_count
  FROM areas a
  LEFT JOIN shops s ON s.area_id = a.id AND s.is_active = 1
  WHERE a.prefecture IS NOT NULL
  GROUP BY a.prefecture
  ORDER BY a.prefecture
`).all();
let totalAreas = 0, totalShops = 0;
for (const p of finalAreas) {
  console.log(`${p.prefecture}: ${p.area_count}エリア, ${p.shop_count}店`);
  totalAreas += p.area_count;
  totalShops += p.shop_count;
}
console.log(`\n合計: ${totalAreas}エリア, ${totalShops}店`);

db.pragma('foreign_keys = ON');
db.close();
console.log('\n✅ 正規化v2完了');
