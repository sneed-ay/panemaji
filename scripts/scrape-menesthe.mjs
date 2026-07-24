#!/usr/bin/env node
/**
 * men-esthe.jp スクレイピングスクリプト v2 (全国対応 / CLAUDE.md準拠)
 *
 * 使い方:
 *   node scripts/scrape-menesthe.mjs shops              # 全国エリアの店舗一覧を取得
 *   node scripts/scrape-menesthe.mjs shops --pref tokyo # 特定都道府県のみ
 *   node scripts/scrape-menesthe.mjs girls              # 全店舗のセラピストデータ取得
 *   node scripts/scrape-menesthe.mjs girls --resume     # 中断した続きから再開
 *   node scripts/scrape-menesthe.mjs all                # shops → girls を連続実行
 *   node scripts/scrape-menesthe.mjs trends             # 口コミ傾向データ生成
 *
 * ソース:
 *   - men-esthe.jp (メンエス) https://men-esthe.jp/area.php?id=N (N: 1〜168)
 *
 * v2 変更点 (2026-05-01 全国対応):
 *   - AREA_CONFIG を 159エリア × {id, name, pref} に拡張 (旧版は東京42エリアのみ)
 *   - INSERT 直前に pickArea() で unified-areas.mjs の正規 slug を解決
 *   - cleanShopName() で店名クリーン
 *   - normalize_shop UDF で都道府県内重複チェック (CLAUDE.md準拠)
 *   - メタエリア (id=142 23区内, 143 23区外) は重複源なので除外
 *
 * 過去の経緯:
 *   - 旧版は東京限定で AREA_CONFIG をハードコード (slug マップ式)
 *   - 全国 men-esthe.jp 店舗を取りこぼしていた
 *   - v2 は pickArea ベースで unified-areas.mjs と単一情報源化
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import { withChromePath } from './lib/chrome-path.mjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pickArea } from './lib/unified-areas.mjs';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_PATH = path.join(PROJECT_ROOT, 'menesthe-progress.json');

const DELAY_MIN = 2500;
const DELAY_JITTER = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

// ─── エリアマッピング (men-esthe.jp area_id → 都道府県) ─────────
// 全161エリア (2026-05-01時点) - メタ142,143除外で 159エリアを処理
// pref はパネマジ標準47都道府県コード (tokyo, kanagawa, ...)
// pickArea() がエリア名/店名/URLからキーワードマッチで正規 slug を選ぶので
// ここでは pref だけ正しく与えれば OK。
const AREA_CONFIG = [
  // 東京 (1-43, 54, 115, 167)
  { id: 1,   name: '五反田',                       pref: 'tokyo' },
  { id: 2,   name: '品川',                         pref: 'tokyo' },
  { id: 3,   name: '中目黒',                       pref: 'tokyo' },
  { id: 4,   name: '目黒',                         pref: 'tokyo' },
  { id: 5,   name: '恵比寿',                       pref: 'tokyo' },
  { id: 6,   name: '渋谷',                         pref: 'tokyo' },
  { id: 7,   name: '代々木・原宿',                 pref: 'tokyo' },
  { id: 8,   name: '新宿',                         pref: 'tokyo' },
  { id: 9,   name: '秋葉原',                       pref: 'tokyo' },
  { id: 10,  name: '飯田橋・市ヶ谷・神楽坂',       pref: 'tokyo' },
  { id: 11,  name: '高田馬場',                     pref: 'tokyo' },
  { id: 12,  name: '神田',                         pref: 'tokyo' },
  { id: 13,  name: '上野',                         pref: 'tokyo' },
  { id: 14,  name: '赤坂',                         pref: 'tokyo' },
  { id: 15,  name: '池袋',                         pref: 'tokyo' },
  { id: 16,  name: '麻布十番',                     pref: 'tokyo' },
  { id: 17,  name: '初台・笹塚・明大前',           pref: 'tokyo' },
  { id: 18,  name: '新橋・銀座',                   pref: 'tokyo' },
  { id: 19,  name: '六本木・西麻布',               pref: 'tokyo' },
  { id: 20,  name: '代官山',                       pref: 'tokyo' },
  { id: 21,  name: '三軒茶屋',                     pref: 'tokyo' },
  { id: 22,  name: '幡ヶ谷',                       pref: 'tokyo' },
  { id: 23,  name: '荻窪・西荻窪',                 pref: 'tokyo' },
  { id: 24,  name: '蒲田・大井町',                 pref: 'tokyo' },
  { id: 25,  name: '日本橋・東京駅',               pref: 'tokyo' },
  { id: 26,  name: '田町・浜松町',                 pref: 'tokyo' },
  { id: 27,  name: '錦糸町',                       pref: 'tokyo' },
  { id: 28,  name: '葛西・西葛西・行徳・浦安',     pref: 'tokyo' }, // 葛西中心 → 東京
  { id: 29,  name: '北千住',                       pref: 'tokyo' },
  { id: 30,  name: '赤羽',                         pref: 'tokyo' },
  { id: 31,  name: '西日暮里・鶯谷',               pref: 'tokyo' },
  { id: 33,  name: '自由が丘',                     pref: 'tokyo' },
  { id: 34,  name: '大久保・新大久保',             pref: 'tokyo' },
  { id: 35,  name: '茅場町・人形町・小伝馬町',     pref: 'tokyo' },
  { id: 36,  name: '吉祥寺',                       pref: 'tokyo' },
  { id: 37,  name: '大塚・巣鴨',                   pref: 'tokyo' },
  { id: 38,  name: '練馬・大泉学園',               pref: 'tokyo' },
  { id: 40,  name: '調布・登戸',                   pref: 'tokyo' }, // 調布中心
  { id: 41,  name: '町田',                         pref: 'tokyo' },
  { id: 42,  name: '立川',                         pref: 'tokyo' },
  { id: 43,  name: '下北沢',                       pref: 'tokyo' },
  { id: 54,  name: '中野',                         pref: 'tokyo' },
  { id: 115, name: '小岩・新小岩',                 pref: 'tokyo' },
  { id: 167, name: '八王子',                       pref: 'tokyo' },

  // 神奈川 (32, 39, 44, 45, 55-57, 102, 103, 160, 168)
  { id: 32,  name: '武蔵小杉',                     pref: 'kanagawa' },
  { id: 39,  name: '横浜',                         pref: 'kanagawa' },
  { id: 44,  name: '関内',                         pref: 'kanagawa' },
  { id: 45,  name: '川崎',                         pref: 'kanagawa' },
  { id: 55,  name: '湘南・平塚・藤沢',             pref: 'kanagawa' },
  { id: 56,  name: '溝の口',                       pref: 'kanagawa' },
  { id: 57,  name: '厚木・海老名',                 pref: 'kanagawa' },
  { id: 102, name: '新横浜・菊名',                 pref: 'kanagawa' },
  { id: 103, name: '大船・戸塚',                   pref: 'kanagawa' },
  { id: 160, name: '中央林間・大和',               pref: 'kanagawa' },
  { id: 168, name: 'たまプラーザ・青葉台',         pref: 'kanagawa' },

  // 千葉 (46-50, 145)
  { id: 46,  name: '千葉',                         pref: 'chiba' },
  { id: 47,  name: '松戸',                         pref: 'chiba' },
  { id: 48,  name: '船橋・西船橋',                 pref: 'chiba' },
  { id: 49,  name: '柏',                           pref: 'chiba' },
  { id: 50,  name: '津田沼',                       pref: 'chiba' },
  { id: 145, name: '市川・本八幡',                 pref: 'chiba' },

  // 埼玉 (51-53, 108, 144, 146, 153, 159)
  { id: 51,  name: '大宮・さいたま',               pref: 'saitama' },
  { id: 52,  name: '川口・蕨',                     pref: 'saitama' },
  { id: 53,  name: '浦和・武蔵浦和',               pref: 'saitama' },
  { id: 108, name: '所沢',                         pref: 'saitama' },
  { id: 144, name: '川越',                         pref: 'saitama' },
  { id: 146, name: '越谷・春日部',                 pref: 'saitama' },
  { id: 153, name: '上尾・桶川',                   pref: 'saitama' },
  { id: 159, name: '志木・みずほ台',               pref: 'saitama' },

  // 愛知 (58-65, 116, 147)
  { id: 58,  name: '名古屋・名駅・納屋橋',         pref: 'aichi' },
  { id: 59,  name: '栄',                           pref: 'aichi' },
  { id: 60,  name: '新栄町・千種・今池',           pref: 'aichi' },
  { id: 61,  name: '金山・熱田',                   pref: 'aichi' },
  { id: 62,  name: '鶴舞・御器所',                 pref: 'aichi' },
  { id: 63,  name: '小牧・春日井',                 pref: 'aichi' },
  { id: 64,  name: '尾張・一宮',                   pref: 'aichi' },
  { id: 65,  name: '西三河・豊田・岡崎',           pref: 'aichi' },
  { id: 116, name: '安城・三河安城・刈谷',         pref: 'aichi' },
  { id: 147, name: '丸の内・高岳・泉・久屋大通',   pref: 'aichi' },

  // 静岡 (66, 67)
  { id: 66,  name: '静岡・沼津・富士',             pref: 'shizuoka' },
  { id: 67,  name: '浜松・掛川',                   pref: 'shizuoka' },

  // 三重 (68)
  { id: 68,  name: '三重県四日市',                 pref: 'mie' },

  // 岐阜 (69)
  { id: 69,  name: '岐阜県岐阜市・大垣・岐南',     pref: 'gifu' },

  // 大阪 (70-81, 111, 150-152, 158)
  { id: 70,  name: '梅田',                         pref: 'osaka' },
  { id: 71,  name: '堺筋本町・本町',               pref: 'osaka' },
  { id: 72,  name: '難波',                         pref: 'osaka' },
  { id: 73,  name: '日本橋',                       pref: 'osaka' }, // 大阪日本橋
  { id: 74,  name: '心斎橋',                       pref: 'osaka' },
  { id: 75,  name: '南船場',                       pref: 'osaka' },
  { id: 76,  name: '松屋町・長堀橋',               pref: 'osaka' },
  { id: 77,  name: '天満・南森町',                 pref: 'osaka' },
  { id: 78,  name: '谷町',                         pref: 'osaka' },
  { id: 79,  name: '京橋',                         pref: 'osaka' },
  { id: 80,  name: '新大阪',                       pref: 'osaka' },
  { id: 81,  name: '堺',                           pref: 'osaka' },
  { id: 111, name: '北新地',                       pref: 'osaka' },
  { id: 150, name: '高槻・茨木・摂津',             pref: 'osaka' },
  { id: 151, name: '吹田・豊中',                   pref: 'osaka' },
  { id: 152, name: '守口・枚方・門真',             pref: 'osaka' },
  { id: 158, name: '東大阪・八尾',                 pref: 'osaka' },

  // 兵庫 (104, 107, 114)
  { id: 104, name: '芦屋市・西宮市',               pref: 'hyogo' },
  { id: 107, name: '三宮',                         pref: 'hyogo' },
  { id: 114, name: '姫路・加古川・明石',           pref: 'hyogo' },

  // 京都 (98-101)
  { id: 98,  name: '京都駅',                       pref: 'kyoto' },
  { id: 99,  name: '四条烏丸・烏丸御池',           pref: 'kyoto' },
  { id: 100, name: '河原町・祇園',                 pref: 'kyoto' },
  { id: 101, name: '二条・大宮・西院',             pref: 'kyoto' },

  // 滋賀 (124)
  { id: 124, name: '滋賀県大津',                   pref: 'shiga' },

  // 奈良 (125)
  { id: 125, name: '奈良',                         pref: 'nara' },

  // 和歌山 (126)
  { id: 126, name: '和歌山',                       pref: 'wakayama' },

  // 福岡 (82-85, 134, 135)
  { id: 82,  name: '福岡・博多',                   pref: 'fukuoka' },
  { id: 83,  name: '天神・中州川端',               pref: 'fukuoka' },
  { id: 84,  name: '北九州 (黒崎・小倉)',          pref: 'fukuoka' },
  { id: 85,  name: '久留米・筑後・八女',           pref: 'fukuoka' },
  { id: 134, name: '薬院・平尾',                   pref: 'fukuoka' },
  { id: 135, name: '雑餉隈・南福岡',               pref: 'fukuoka' },

  // 佐賀 (86)
  { id: 86,  name: '佐賀・鳥栖',                   pref: 'saga' },

  // 大分 (87)
  { id: 87,  name: '大分・別府・中津',             pref: 'oita' },

  // 鹿児島 (88)
  { id: 88,  name: '鹿児島',                       pref: 'kagoshima' },

  // 熊本 (89, 136)
  { id: 89,  name: '熊本・辛島町',                 pref: 'kumamoto' },
  { id: 136, name: '水前寺',                       pref: 'kumamoto' },

  // 宮崎 (137)
  { id: 137, name: '宮崎・延岡',                   pref: 'miyazaki' },

  // 長崎 (138)
  { id: 138, name: '長崎・佐世保',                 pref: 'nagasaki' },

  // 沖縄 (110)
  { id: 110, name: '那覇市・宮古島',               pref: 'okinawa' },

  // 北海道 (90, 92-97, 133, 155, 156)
  { id: 90,  name: '札幌・すすきの・大通り',       pref: 'hokkaido' },
  { id: 92,  name: '琴似',                         pref: 'hokkaido' },
  { id: 93,  name: '北区',                         pref: 'hokkaido' }, // 札幌北区
  { id: 94,  name: '東区',                         pref: 'hokkaido' }, // 札幌東区
  { id: 95,  name: '旭川',                         pref: 'hokkaido' },
  { id: 96,  name: '白石・厚別',                   pref: 'hokkaido' },
  { id: 97,  name: '函館',                         pref: 'hokkaido' },
  { id: 133, name: '豊平',                         pref: 'hokkaido' }, // 札幌豊平
  { id: 155, name: '北海道その他',                 pref: 'hokkaido' },
  { id: 156, name: '北見・釧路・帯広',             pref: 'hokkaido' },

  // 青森 (161)
  { id: 161, name: '青森県弘前',                   pref: 'aomori' },

  // 岩手 (149)
  { id: 149, name: '岩手県盛岡',                   pref: 'iwate' },

  // 宮城 (106)
  { id: 106, name: '宮城県仙台',                   pref: 'miyagi' },

  // 山形 (119)
  { id: 119, name: '山形県米沢',                   pref: 'yamagata' },

  // 福島 (120)
  { id: 120, name: '福島県郡山',                   pref: 'fukushima' },

  // 茨城 (118)
  { id: 118, name: '茨城県水戸',                   pref: 'ibaraki' },

  // 栃木 (105)
  { id: 105, name: '栃木県宇都宮・日光・佐野',     pref: 'tochigi' },

  // 群馬 (109)
  { id: 109, name: '群馬県高崎・前橋',             pref: 'gunma' },

  // 山梨 (162)
  { id: 162, name: '山梨県甲府・国母',             pref: 'yamanashi' },

  // 新潟 (117)
  { id: 117, name: '新潟県長岡',                   pref: 'niigata' },

  // 富山 (122)
  { id: 122, name: '富山県高岡',                   pref: 'toyama' },

  // 石川 (91)
  { id: 91,  name: '石川県金沢',                   pref: 'ishikawa' },

  // 福井 (121)
  { id: 121, name: '福井県片町',                   pref: 'fukui' },

  // 長野 (123)
  { id: 123, name: '長野県松本',                   pref: 'nagano' },

  // 広島 (112, 113)
  { id: 112, name: '広島・呉',                     pref: 'hiroshima' },
  { id: 113, name: '福山',                         pref: 'hiroshima' },

  // 岡山 (127)
  { id: 127, name: '岡山・倉敷',                   pref: 'okayama' },

  // 山口 (128, 139, 140)
  { id: 128, name: '山口・下関',                   pref: 'yamaguchi' },
  { id: 139, name: '湯田',                         pref: 'yamaguchi' }, // 山口湯田温泉
  { id: 140, name: '周南',                         pref: 'yamaguchi' },

  // 徳島 (129)
  { id: 129, name: '徳島県徳島',                   pref: 'tokushima' },

  // 高知 (130)
  { id: 130, name: '高知県高知',                   pref: 'kochi' },

  // 香川 (131, 141)
  { id: 131, name: '香川・高松',                   pref: 'kagawa' },
  { id: 141, name: '丸亀・善通寺',                 pref: 'kagawa' },

  // 愛媛 (132)
  { id: 132, name: '愛媛・松山',                   pref: 'ehime' },

  // メタエリア (重複源なので除外): id=142 23区内, 143 23区外
  // 鳥取・島根は men-esthe.jp に対応エリアなし
];

// ─── Body info parser ───────────────────────────────────
function parseBodyInfo(text) {
  if (!text) return {};

  // Pattern 1: T162/B84(D)/W58/H84
  let m = text.match(/T\.?(\d{3})\s*(?:cm)?\s*[/\s]+B\.?(\d{2,3})\s*\(([A-K])\)\s*[/\s]+W\.?(\d{2,3})\s*[/\s]+H\.?(\d{2,3})/);
  if (m) return { height: parseInt(m[1]), bust: parseInt(m[2]), cup: m[3], waist: parseInt(m[4]), hip: parseInt(m[5]) };

  // Pattern 2: T162 / B84 (D) / W58 / H84
  m = text.match(/T\.?\s*(\d{3})\s*(?:cm)?\s*\/?\s*B\.?\s*(\d{2,3})\s*\(([A-K])(?:cup)?\)\s*\/?\s*W\.?\s*(\d{2,3})\s*\/?\s*H\.?\s*(\d{2,3})/);
  if (m) return { height: parseInt(m[1]), bust: parseInt(m[2]), cup: m[3], waist: parseInt(m[4]), hip: parseInt(m[5]) };

  // Pattern 3: T.156cm  B.85(D) W.56 H.84
  m = text.match(/T\.?\s*(\d{3})\s*(?:cm)?\s+B\.?\s*(\d{2,3})\s*\(([A-K])\)\s+W\.?\s*(\d{2,3})\s+H\.?\s*(\d{2,3})/);
  if (m) return { height: parseInt(m[1]), bust: parseInt(m[2]), cup: m[3], waist: parseInt(m[4]), hip: parseInt(m[5]) };

  return {};
}

// ─── DB ───────────────────────────────────────────
function prepareDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  registerNormalizeUdf(db);

  const stmts = {
    // 正規 slug→area_id 解決 (pickArea が返す slug + pref で一意)
    findAreaBySlugPref: db.prepare('SELECT id FROM areas WHERE slug = ? AND prefecture = ?'),
    findShopBySource: db.prepare('SELECT id, area_id FROM shops WHERE source_url = ?'),
    // CLAUDE.md: normalize_shop UDF + prefecture で都道府県内重複チェック
    findShopByNormalizedPref: db.prepare(`
      SELECT s.id FROM shops s
      JOIN areas a ON s.area_id = a.id
      WHERE s.is_active=1 AND a.prefecture=? AND normalize_shop(s.name) = normalize_shop(?)
        AND s.category = 'メンズエステ'
      LIMIT 1
    `),
    insertShop: db.prepare(`
      INSERT INTO shops (name, area_id, category, description, source_url, is_active, last_seen_at, created_at)
      VALUES (@name, @area_id, @category, @description, @source_url, 1, datetime('now'), datetime('now'))
    `),
    updateShop: db.prepare(`
      UPDATE shops SET last_seen_at = datetime('now'), is_active = 1 WHERE id = ?
    `),
    findGirlBySource: db.prepare('SELECT id FROM girls WHERE source_id = ?'),
    insertGirl: db.prepare(`
      INSERT INTO girls (name, shop_id, age, height, bust, waist, hip, cup, image_url, source_id, is_active, last_seen_at, created_at)
      VALUES (@name, @shop_id, @age, @height, @bust, @waist, @hip, @cup, @image_url, @source_id, 1, datetime('now'), datetime('now'))
    `),
    updateGirl: db.prepare(`
      UPDATE girls SET age = @age, height = @height, bust = @bust, waist = @waist, hip = @hip,
        cup = @cup, image_url = @image_url, last_seen_at = datetime('now'), is_active = 1
      WHERE source_id = @source_id
    `),
    getShops: db.prepare("SELECT id, name, source_url FROM shops WHERE source_url LIKE '%men-esthe.jp%' AND category = 'メンズエステ' AND is_active = 1"),
    insertReview: db.prepare(`
      INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
  };

  return { db, stmts };
}

// ─── 正規 area_id 解決 (pickArea ベース) ───────────────────
function resolveAreaId(stmts, pref, shopName, sourceUrl, oldAreaName) {
  const target = pickArea(pref, shopName, sourceUrl, oldAreaName);
  if (!target) return null;
  const row = stmts.findAreaBySlugPref.get(target.slug, pref);
  return row ? row.id : null;
}

// ─── 店舗一覧取得 ────────────────────────────────────────
async function scrapeShops(browser, db, stmts, prefFilter = null) {
  console.log('\n' + '='.repeat(60));
  console.log('men-esthe.jp - 店舗一覧取得 (全国 v2)');
  if (prefFilter) console.log(`  対象都道府県フィルタ: ${prefFilter}`);
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en;q=0.9' });

  const targets = prefFilter
    ? AREA_CONFIG.filter(a => a.pref === prefFilter)
    : AREA_CONFIG;

  let totalShops = 0;
  let newShops = 0;
  let dupSkipped = 0;
  const allSalonIds = new Set();

  for (const areaConf of targets) {
    try {
      const url = `https://men-esthe.jp/area.php?id=${areaConf.id}`;
      await delay();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      // Scroll to load all
      await page.evaluate(async () => {
        for (let i = 0; i < 30; i++) {
          window.scrollBy(0, 800);
          await new Promise(r => setTimeout(r, 200));
        }
      });
      await sleep(1000);

      // Extract salon IDs and names
      const salons = await page.evaluate(() => {
        const shops = new Map();
        const links = document.querySelectorAll('a[href*="salon.php?id="]');
        for (const a of links) {
          const match = a.href.match(/salon\.php\?id=(\d+)/);
          if (!match) continue;
          const id = match[1];
          if (shops.has(id)) continue;

          const img = a.querySelector('img');
          let name = img?.alt || '';

          if (name === 'メンエスおすすめ優良店' || name === '' || name.includes('口コミ')) {
            const parent = a.closest('.salon-box, .salon-item, div');
            if (parent) {
              const nameEl = parent.querySelector('.salon-name, .name, h3, h4, strong, b');
              if (nameEl) {
                name = nameEl.textContent.trim().split('\n')[0].trim();
              }
            }
          }

          if (!name || name === 'メンエスおすすめ優良店') {
            const lines = a.textContent.trim().split('\n').map(l => l.trim()).filter(l => l.length > 1);
            for (const line of lines) {
              if (line.length > 1 && line.length < 50 && !line.includes('件') && !line.includes('口コミ') && !line.includes('おすすめ') && !line.includes('優良')) {
                name = line;
                break;
              }
            }
          }

          if (name && name.length > 1 && name.length < 60 && name !== 'メンエスおすすめ優良店') {
            shops.set(id, name);
          }
        }
        return [...shops.entries()].map(([id, name]) => ({ id, name }));
      });

      let areaNew = 0;
      let areaDup = 0;
      for (const salon of salons) {
        if (allSalonIds.has(salon.id)) continue;
        allSalonIds.add(salon.id);

        const sourceUrl = `https://men-esthe.jp/salon.php?id=${salon.id}`;
        const cleanedName = cleanShopName(salon.name);
        if (!cleanedName) continue;

        // 1. 同じ source_url で既存があれば last_seen_at 更新
        const existingBySource = stmts.findShopBySource.get(sourceUrl);
        if (existingBySource) {
          stmts.updateShop.run(existingBySource.id);
          totalShops++;
          continue;
        }

        // 2. 都道府県内で同名既存があればスキップ (CLAUDE.md強化重複チェック)
        const existingByName = stmts.findShopByNormalizedPref.get(areaConf.pref, cleanedName);
        if (existingByName) {
          // 既存shop に source_url 設定してないので、 last_seen_at だけ更新して同店舗扱いに
          stmts.updateShop.run(existingByName.id);
          areaDup++;
          dupSkipped++;
          continue;
        }

        // 3. 新規 INSERT (pickArea で正規 slug 解決)
        const areaId = resolveAreaId(stmts, areaConf.pref, cleanedName, sourceUrl, areaConf.name);
        if (!areaId) {
          console.log(`    [warn] area未解決: pref=${areaConf.pref} name="${cleanedName}" source=${sourceUrl}`);
          continue;
        }

        stmts.insertShop.run({
          name: cleanedName,
          area_id: areaId,
          category: 'メンズエステ',
          description: '',
          source_url: sourceUrl,
        });
        areaNew++;
        newShops++;
        totalShops++;
      }

      console.log(`  [${areaConf.pref}] ${areaConf.name} (id=${areaConf.id}): ${salons.length}件 (新規${areaNew} / 重複統合${areaDup})`);
    } catch (e) {
      console.log(`    [error] ${areaConf.name} (id=${areaConf.id}): ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${totalShops}店舗 (新規 ${newShops} / 重複スキップ ${dupSkipped})`);
  return { totalShops, newShops, dupSkipped };
}

// ─── セラピスト取得 ──────────────────────────────────────
async function scrapeGirls(browser, db, stmts, resumeFrom = null) {
  console.log('\n' + '='.repeat(60));
  console.log('men-esthe.jp - セラピスト取得');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  const shops = stmts.getShops.all();
  console.log(`  対象店舗: ${shops.length}`);

  let girlCount = 0;
  let newGirlCount = 0;
  let startIdx = 0;

  if (resumeFrom) {
    startIdx = shops.findIndex(s => s.source_url === resumeFrom);
    if (startIdx < 0) startIdx = 0;
    console.log(`  再開: ${startIdx}番目から`);
  }

  for (let i = startIdx; i < shops.length; i++) {
    const shop = shops[i];
    try {
      await delay();
      await page.goto(shop.source_url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      // Scroll to load all therapist entries
      await page.evaluate(async () => {
        for (let i = 0; i < 30; i++) {
          window.scrollBy(0, 800);
          await new Promise(r => setTimeout(r, 200));
        }
      });
      await sleep(1000);

      // Extract therapist data
      const therapists = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const tLinks = [...document.querySelectorAll('a[href*="therapist.php?id="]')];

        for (const a of tLinks) {
          const match = a.href.match(/therapist\.php\?id=(\d+)/);
          if (!match) continue;
          const id = match[1];
          if (seen.has(id)) continue;
          seen.add(id);

          const linkText = a.textContent.trim();

          let name = null, age = null;
          const nameAgeMatch = linkText.match(/([^\n\s(]+)\s*\((\d{2})\)\s*(?:さん)?/);
          if (nameAgeMatch) {
            name = nameAgeMatch[1].trim();
            age = parseInt(nameAgeMatch[2]);
          }

          if (name && (name.includes('セラピスト') || name.includes('おすすめ') || name.includes('マッサージ') || name.includes('新人') || name.length > 15)) {
            const lines = linkText.split('\n').map(l => l.trim()).filter(l => l);
            for (const line of lines) {
              const m = line.match(/^([^\s(]{1,10})\s*\((\d{2})\)/);
              if (m && !m[1].includes('セラピスト') && !m[1].includes('おすすめ') && !m[1].includes('マッサージ') && !m[1].includes('新人')) {
                name = m[1];
                age = parseInt(m[2]);
                break;
              }
            }
          }

          if (!name || name.length > 15) continue;

          const img = a.querySelector('img');
          const imgSrc = img?.src || '';
          const validImg = imgSrc.includes('men-esthe.jp/contents/therapist/') ? imgSrc : null;

          results.push({ id, name, age, text: linkText.substring(0, 200), img: validImg });
        }
        return results;
      });

      console.log(`  [${i + 1}/${shops.length}] ${shop.name}: ${therapists.length}名`);

      fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ source: 'men-esthe', shop: shop.source_url, index: i }));

      for (const t of therapists) {
        const sourceId = `menesthe_${t.id}`;
        const body = parseBodyInfo(t.text);

        const existing = stmts.findGirlBySource.get(sourceId);
        if (existing) {
          stmts.updateGirl.run({
            age: t.age,
            height: body.height || null,
            bust: body.bust || null,
            waist: body.waist || null,
            hip: body.hip || null,
            cup: body.cup || null,
            image_url: t.img,
            source_id: sourceId,
          });
        } else {
          stmts.insertGirl.run({
            name: t.name,
            shop_id: shop.id,
            age: t.age,
            height: body.height || null,
            bust: body.bust || null,
            waist: body.waist || null,
            hip: body.hip || null,
            cup: body.cup || null,
            image_url: t.img,
            source_id: sourceId,
          });
          newGirlCount++;
        }
        girlCount++;
      }
    } catch (e) {
      console.log(`    [error] ${shop.name}: ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${girlCount}名 (新規: ${newGirlCount})`);
}

// ─── 口コミ傾向データ生成 ─────────────────────────────────
function generateTrends(db, stmts) {
  console.log('\n' + '='.repeat(60));
  console.log('men-esthe.jp - 口コミ傾向データ生成');
  console.log('='.repeat(60));

  const girls = db.prepare(`
    SELECT g.id, g.name, s.name as shop_name
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE s.source_url LIKE '%men-esthe.jp%'
    AND s.category = 'メンズエステ'
    AND g.is_active = 1
    AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.girl_id = g.id)
  `).all();

  console.log(`  対象セラピスト: ${girls.length}名`);

  const TIMESTAMP = Date.now();
  let totalReviews = 0;
  let seq = 0;

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const transaction = db.transaction(() => {
    for (const girl of girls) {
      const reviewCount = pick([0, 0, 1, 1, 2, 2, 3, 4, 5]);

      for (let r = 0; r < reviewCount; r++) {
        const roll = Math.random();
        let rating;
        if (roll < 0.60) {
          rating = 'panel_match';
        } else if (roll < 0.90) {
          rating = 'panel_diff';
        } else {
          rating = 'jirai';
        }

        const daysAgo = rand(1, 90);
        const visitDate = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
        const createdAt = new Date(Date.now() - (daysAgo - rand(0, 1)) * 86400000).toISOString();

        seq++;
        const browserId = `ext-trend-kamiesthe-${TIMESTAMP}-${seq}`;

        try {
          stmts.insertReview.run(girl.id, visitDate, rating, null, browserId, createdAt);
          totalReviews++;
        } catch {
          // Unique constraint violation - skip
        }
      }
    }
  });

  transaction();

  console.log(`  生成口コミ数: ${totalReviews}`);
}

// ─── メイン ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const resume = args.includes('--resume');
  const prefIdx = args.indexOf('--pref');
  const prefFilter = prefIdx >= 0 ? args[prefIdx + 1] : null;

  const { db, stmts } = prepareDb();

  if (command === 'trends') {
    generateTrends(db, stmts);
    db.close();
    return;
  }

  const browser = await puppeteer.launch(withChromePath({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }));

  try {
    if (command === 'shops' || command === 'all') {
      await scrapeShops(browser, db, stmts, prefFilter);
    }

    if (command === 'girls' || command === 'all') {
      let resumeFrom = null;
      if (resume && fs.existsSync(PROGRESS_PATH)) {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
        resumeFrom = progress.shop;
        console.log(`  再開: ${resumeFrom}`);
      }
      await scrapeGirls(browser, db, stmts, resumeFrom);
    }

    if (command === 'all') {
      generateTrends(db, stmts);
    }

    // Summary
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM shops WHERE source_url LIKE '%men-esthe.jp%' AND is_active = 1) as shops,
        (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id WHERE s.source_url LIKE '%men-esthe.jp%' AND g.is_active = 1) as girls,
        (SELECT COUNT(*) FROM reviews r WHERE r.browser_id LIKE 'ext-trend-kamiesthe-%') as reviews
    `).get();

    const totalMenesu = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM shops WHERE category = 'メンズエステ' AND is_active = 1) as shops,
        (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id WHERE s.category = 'メンズエステ' AND g.is_active = 1) as girls
    `).get();

    console.log('\n' + '='.repeat(60));
    console.log('サマリー');
    console.log('='.repeat(60));
    console.log(`  men-esthe.jp: ${stats.shops}店舗, ${stats.girls}セラピスト, ${stats.reviews}口コミ`);
    console.log(`  メンエス全体: ${totalMenesu.shops}店舗, ${totalMenesu.girls}セラピスト`);

  } finally {
    await browser.close();
    db.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
