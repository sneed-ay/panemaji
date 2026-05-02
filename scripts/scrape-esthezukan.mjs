#!/usr/bin/env node
/**
 * エステ図鑑 (esthe-zukan.com) スクレイピングスクリプト (CLAUDE.md準拠)
 *
 * 使い方:
 *   node scripts/scrape-esthezukan.mjs shops              # 全国 shops 取得
 *   node scripts/scrape-esthezukan.mjs shops --pref tokyo # 都道府県フィルタ
 *   node scripts/scrape-esthezukan.mjs shops --dry-run    # DB書き込みなし
 *   node scripts/scrape-esthezukan.mjs cast               # 全国 cast (girls) 取得
 *   node scripts/scrape-esthezukan.mjs cast --dry-run     # cast の dry-run
 *   node scripts/scrape-esthezukan.mjs cast --limit 200   # 最初の N URL のみ
 *
 * sitemap_shop.xml に全店舗 URL があるので curl ベースで軽量実装。
 * 全店舗 URL ~1,915 (重複あり)、ユニーク ~1,000 程度。
 * sitemap_cast.xml には ~7,000 ユニーク cast URL (?stfid=N 形式)。
 *
 * URL 構造:
 *   https://esthe-zukan.com/{section}/{sectionArea}/{shopId}
 *   例: /tokyo/tokyoginza/3186, /tohoku/tohokufukushima/1678
 *
 * pref 推定:
 *   - URL の第2階層から決定 (例: tohokufukushima → fukushima)
 *   - tokyo/tokyosaitama → saitama (例外マッピング)
 *
 * CLAUDE.md準拠:
 *   - pickArea() で正規 slug 解決
 *   - cleanShopName() で店名クリーン
 *   - normalize_shop UDF で都道府県内重複チェック
 *   - レガシー area 一切作らない
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { pickArea } from './lib/unified-areas.mjs';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(PROJECT_ROOT, 'panemaji.db');

const SITEMAP_SHOP_URL = 'https://esthe-zukan.com/xml/sitemap_shop.xml';
const SITEMAP_CAST_URL = 'https://esthe-zukan.com/xml/sitemap_cast.xml';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DELAY_MIN = 400;
const DELAY_JITTER = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);

// ─── pref 推定 (URL → 都道府県) ─────────────────────
// 例外マッピング (URL に他県名を含む場合)
const URL_PATH_TO_PREF = {
  // tokyo/ 配下の例外
  'tokyo/tokyosaitama': 'saitama', // tokyo サイト構造だが店舗名 saitama → 埼玉

  // nagoya/ 配下の例外（愛知が中心、他県含む）
  'nagoya/nagoyaaichi': 'aichi',
  'nagoya/nagoyagifu': 'gifu',
  'nagoya/nagoyahoka': 'aichi',
  'nagoya/nagoyaichinomiya': 'aichi',
  'nagoya/nagoyamie': 'mie',
  'nagoya/nagoyanagoyashi': 'aichi',
  'nagoya/nagoyaokazaki': 'aichi',
  'nagoya/nagoyashizuoka': 'shizuoka',
  'nagoya/nagoyatoyokawa': 'aichi',
  'nagoya/nagoyatoyota': 'aichi',

  // tohoku/ 配下 (実際は中部・北陸を含む)
  'tohoku/tohokuaomori': 'aomori',
  'tohoku/tohokufukui': 'fukui',         // 中部・北陸だが tohoku セクション
  'tohoku/tohokufukushima': 'fukushima',
  'tohoku/tohokuishikawa': 'ishikawa',   // 中部・北陸
  'tohoku/tohokumiyagi': 'miyagi',
  'tohoku/tohokutoyama': 'toyama',       // 中部・北陸

  // chugoku/ 配下 (四国を含む)
  'chugoku/chugokuehime': 'ehime',       // 四国
  'chugoku/chugokuhiroshima': 'hiroshima',
  'chugoku/chugokukagawa': 'kagawa',     // 四国
  'chugoku/chugokukochi': 'kochi',       // 四国
  'chugoku/chugokuokayama': 'okayama',
  'chugoku/chugokutokushima': 'tokushima', // 四国
  'chugoku/chugokuyamaguchi': 'yamaguchi',

  // fukuoka/ 配下 (九州他県を含む)
  'fukuoka/fukuokahakata': 'fukuoka',
  'fukuoka/fukuokahoka': 'fukuoka',
  'fukuoka/fukuokakagoshima': 'kagoshima',
  'fukuoka/fukuokakitakyusyu': 'fukuoka',
  'fukuoka/fukuokakumamoto': 'kumamoto',
  'fukuoka/fukuokamiyazaki': 'miyazaki',
  'fukuoka/fukuokaoita': 'oita',
  'fukuoka/fukuokaokinawa': 'okinawa',
  'fukuoka/fukuokasaga': 'saga',
  'fukuoka/fukuokatenjin': 'fukuoka',

  // hokkaido/ 配下 → 全部 hokkaido
  'hokkaido/hokkaidoasahikawa': 'hokkaido',
  'hokkaido/hokkaidochitose': 'hokkaido',
  'hokkaido/hokkaidosapporo': 'hokkaido',

  // kansai/ 配下 (近畿)
  'kansai/kansainara': 'nara',
  'kansai/kansaishiga': 'shiga',
  'kansai/kansaiwakayama': 'wakayama',

  // kanto/ 配下 (東京・神奈川以外)
  'kanto/kantochiba': 'chiba',
  'kanto/kantogunma': 'gunma',
  'kanto/kantoibaraki': 'ibaraki',
  'kanto/kantotochigi': 'tochigi',
  'kanto/kantoyamanashi': 'yamanashi', // 中部だが kanto セクション

  // kobe/ 配下 → hyogo
  'kobe/kobeakashi': 'hyogo',
  'kobe/kobeamagasaki': 'hyogo',
  'kobe/kobeashiya': 'hyogo',
  'kobe/kobehimeji': 'hyogo',
  'kobe/kobehoka': 'hyogo',
  'kobe/kobehyogo': 'hyogo',
  'kobe/kobenishinomiya': 'hyogo',
  'kobe/kobesannomiya': 'hyogo',
  'kobe/kobetakaraduka': 'hyogo',

  // yokohama/ 配下 → kanagawa
  'yokohama/yokohamakawasakishi': 'kanagawa',
  'yokohama/yokohamasonota': 'kanagawa',
  'yokohama/yokohamayokohamashi': 'kanagawa',
};

function inferPrefFromUrl(url) {
  // URL から area path 部分を抽出
  // https://esthe-zukan.com/{a}/{b}/{shopId} → "a/b"
  const m = url.match(/esthe-zukan\.com\/([^/]+)\/([^/]+)\/\d+/);
  if (!m) return null;
  const areaPath = `${m[1]}/${m[2]}`;

  // 例外マップ優先
  if (URL_PATH_TO_PREF[areaPath]) return URL_PATH_TO_PREF[areaPath];

  // 一般ルール (第1階層がそのまま pref)
  const section = m[1];
  if (section === 'tokyo') return 'tokyo';
  if (section === 'osaka') return 'osaka';
  if (section === 'kyoto') return 'kyoto';
  if (section === 'hokkaido') return 'hokkaido';
  return null;
}

// ─── HTML fetch (curl ベース) ────────────────────────
async function fetchHtml(url) {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const exec = promisify(execFile);
  try {
    const { stdout } = await exec('curl', [
      '-s',
      '-A', UA,
      '--max-time', '15',
      url,
    ], { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (e) {
    throw new Error(`curl failed for ${url}: ${e.message}`);
  }
}

// 店舗名抽出
// 注: shop ページの <h2> は店舗によってはキャッチコピーが入っているため使えない
// 例: nara/100 は h2 = 「身体と心の深部より『真の癒し』をお届け致します。」
// → og:title を最優先 (常に「店名｜エリア【エステ図鑑XX】」の形式)
function extractShopName(html) {
  // 1. og:title 最優先 (常に正しい店名)
  let m = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/);
  if (m) {
    let t = m[1].trim();
    t = t.split('｜')[0].split('|')[0].trim();
    return t;
  }

  // 2. <title> フォールバック (og:title 同等のフォーマット)
  m = html.match(/<title>([^<]+)<\/title>/);
  if (m) {
    let t = m[1].trim();
    t = t.split('｜')[0].split('|')[0].trim();
    return t;
  }

  // 3. h2 最終手段 (キャッチコピー判定で除外)
  m = html.match(/<h2[^>]*class="[^"]*bg-sky[^"]*"[^>]*>([^<]+)<\/h2>/);
  if (m) {
    const t = m[1].trim();
    if (!t.match(/[。！]|致します|お届け|ご提供|ロイヤル.*揉み|サロン$|店舗型|間もなく|『.*』/)) {
      return t;
    }
  }

  return null;
}

// ─── DB ─────────────────────────────────────────────
function prepareDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  registerNormalizeUdf(db);

  return {
    db,
    findAreaBySlugPref: db.prepare('SELECT id FROM areas WHERE slug = ? AND prefecture = ?'),
    findShopBySource: db.prepare('SELECT id FROM shops WHERE source_url = ?'),
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
  };
}

function resolveAreaId(stmts, pref, shopName, sourceUrl, oldAreaName) {
  const target = pickArea(pref, shopName, sourceUrl, oldAreaName);
  if (!target) return null;
  const row = stmts.findAreaBySlugPref.get(target.slug, pref);
  return row ? row.id : null;
}

// ─── メイン: shops 取得 ───────────────────────────────
async function scrapeShops(prefFilter, dryRun) {
  console.log('\n' + '='.repeat(60));
  console.log('エステ図鑑 (esthe-zukan.com) - 店舗一覧取得');
  if (prefFilter) console.log(`  対象都道府県フィルタ: ${prefFilter}`);
  if (dryRun) console.log('  [DRY-RUN] DB書き込みなし');
  console.log('='.repeat(60));

  // 1. sitemap から全 shop URL 取得
  const sitemapXml = await fetchHtml(SITEMAP_SHOP_URL);
  const allUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  // ユニーク化 (同 URL が重複する sitemap)
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`  sitemap URL: 合計 ${allUrls.length}, ユニーク ${uniqueUrls.length}`);

  // 2. pref filter
  const targetUrls = prefFilter
    ? uniqueUrls.filter(u => inferPrefFromUrl(u) === prefFilter)
    : uniqueUrls;
  console.log(`  処理対象: ${targetUrls.length}`);

  const stmts = dryRun ? null : prepareDb();

  let processed = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  let totalDup = 0;
  let totalSkipped = 0;
  const prefStats = {};

  for (const url of targetUrls) {
    processed++;
    const pref = inferPrefFromUrl(url);
    if (!pref) {
      console.log(`    [warn] pref 未推定: ${url}`);
      totalSkipped++;
      continue;
    }
    if (!prefStats[pref]) prefStats[pref] = { processed: 0, new: 0, updated: 0, dup: 0 };
    prefStats[pref].processed++;

    try {
      await delay();
      const html = await fetchHtml(url);
      const rawName = extractShopName(html);
      if (!rawName) {
        console.log(`    [warn] 店名抽出失敗: ${url}`);
        totalSkipped++;
        continue;
      }
      const cleanedName = cleanShopName(rawName);
      if (!cleanedName) {
        totalSkipped++;
        continue;
      }

      if (dryRun) {
        if (processed <= 20) console.log(`    [dry] ${pref} | ${cleanedName} | ${url}`);
        totalNew++;
        prefStats[pref].new++;
        continue;
      }

      const { findShopBySource, findShopByNormalizedPref, insertShop, updateShop, db } = stmts;

      // 1. source_url で既存check
      const existingBySource = findShopBySource.get(url);
      if (existingBySource) {
        updateShop.run(existingBySource.id);
        totalUpdated++;
        prefStats[pref].updated++;
        continue;
      }

      // 2. 同pref内 normalize_shop で重複check
      const existingByName = findShopByNormalizedPref.get(pref, cleanedName);
      if (existingByName) {
        updateShop.run(existingByName.id);
        totalDup++;
        prefStats[pref].dup++;
        continue;
      }

      // 3. 新規 INSERT
      const areaId = resolveAreaId(stmts, pref, cleanedName, url, null);
      if (!areaId) {
        console.log(`    [warn] area 未解決: pref=${pref} name="${cleanedName}" url=${url}`);
        totalSkipped++;
        continue;
      }

      insertShop.run({
        name: cleanedName,
        area_id: areaId,
        category: 'メンズエステ',
        description: '',
        source_url: url,
      });
      totalNew++;
      prefStats[pref].new++;
    } catch (e) {
      console.log(`    [error] ${url}: ${e.message}`);
      totalSkipped++;
    }

    if (processed % 50 === 0) {
      console.log(`    ... ${processed}/${targetUrls.length} (new ${totalNew}, dup ${totalDup}, upd ${totalUpdated}, skip ${totalSkipped})`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('サマリー (esthe-zukan)');
  console.log('='.repeat(60));
  console.log(`  処理: ${processed}, 新規: ${totalNew}, 重複統合: ${totalDup}, 更新: ${totalUpdated}, スキップ: ${totalSkipped}`);
  console.log('  pref別:');
  const sorted = Object.entries(prefStats).sort((a, b) => b[1].new - a[1].new);
  for (const [p, s] of sorted) {
    console.log(`    ${p}: 新規${s.new} 重複${s.dup} 更新${s.updated} (処理${s.processed})`);
  }
  if (!dryRun) stmts.db.close();
}

// ─── cast (girls) 取得 ─────────────────────────────────
// og:title 例: "cozy　コージー ゆい（20代後半）       （0）｜旭川・富良野【エステ図鑑北海道】"
// → shop名: "cozy　コージー" (shopId で DB から逆引きするので不要だが検証用)
// → cast名: "ゆい"
// → 年代: "20代後半" → age=27 などざっくりマッピング
function extractCastInfo(html) {
  const m = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/);
  if (!m) return null;
  let title = m[1].trim();
  // 「店名 cast名（年代） （口コミ数）｜エリア【...】」
  // 末尾の「｜...」を除去
  title = title.split('｜')[0].split('|')[0].trim();
  // 末尾の「（数値）」(口コミ数) を除去
  title = title.replace(/\s*[（(]\d+[)）]\s*$/, '').trim();
  // 「（年代）」マッチ
  const ageMatch = title.match(/[（(](\d{2})代(前半|後半|半ば)?[)）]/);
  let age = null;
  if (ageMatch) {
    const decade = parseInt(ageMatch[1]);
    const half = ageMatch[2];
    if (half === '前半') age = decade + 2;
    else if (half === '後半') age = decade + 7;
    else age = decade + 5;
    // 年代部分を削除
    title = title.replace(/\s*[（(]\d{2}代(前半|後半|半ば)?[)）]\s*/, ' ').trim();
  }
  // 残った 「{shop名} {cast名}」 を space で分割。
  // 末尾を cast名 とみなす（shop名は複数語のことがある）
  const parts = title.split(/[\s　]+/).filter(p => p.length > 0);
  if (parts.length === 0) return null;
  const castName = parts[parts.length - 1];
  if (!castName || castName.length > 15) return null;
  return { name: castName, age };
}

function extractShopIdFromCastUrl(url) {
  // /{section}/{sectionArea}/{shopId}?stfid={castId}
  const m = url.match(/esthe-zukan\.com\/[^/]+\/[^/]+\/(\d+)\?stfid=(\d+)/);
  if (!m) return null;
  return { shopId: m[1], castId: m[2] };
}

function buildShopSourceUrl(castUrl) {
  // cast URL から ?stfid 部分を除いた shop URL を構築
  return castUrl.split('?')[0];
}

function prepareCastDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  registerNormalizeUdf(db);
  return {
    db,
    findShopBySource: db.prepare('SELECT id FROM shops WHERE source_url = ? AND is_active=1'),
    findGirlBySource: db.prepare('SELECT id FROM girls WHERE source_id = ?'),
    insertGirl: db.prepare(`
      INSERT INTO girls (name, shop_id, age, source_id, is_active, last_seen_at, created_at)
      VALUES (@name, @shop_id, @age, @source_id, 1, datetime('now'), datetime('now'))
    `),
    updateGirl: db.prepare(`
      UPDATE girls SET name = @name, age = @age, last_seen_at = datetime('now'), is_active = 1
      WHERE source_id = @source_id
    `),
  };
}

async function scrapeCast(dryRun, limit) {
  console.log('\n' + '='.repeat(60));
  console.log('エステ図鑑 (esthe-zukan.com) - cast (girls) 取得');
  if (limit) console.log(`  最大 ${limit} 件`);
  if (dryRun) console.log('  [DRY-RUN] DB書き込みなし');
  console.log('='.repeat(60));

  const sitemapXml = await fetchHtml(SITEMAP_CAST_URL);
  const allUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`  cast sitemap: 合計 ${allUrls.length}, ユニーク ${uniqueUrls.length}`);

  const targetUrls = limit ? uniqueUrls.slice(0, limit) : uniqueUrls;
  console.log(`  処理対象: ${targetUrls.length}`);

  const stmts = dryRun ? null : prepareCastDb();

  let processed = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let shopMissing = 0;

  for (const url of targetUrls) {
    processed++;
    const ids = extractShopIdFromCastUrl(url);
    if (!ids) { totalSkipped++; continue; }
    const shopUrl = buildShopSourceUrl(url);

    try {
      await delay();
      const html = await fetchHtml(url);
      const info = extractCastInfo(html);
      if (!info) { totalSkipped++; continue; }

      if (dryRun) {
        if (processed <= 20) console.log(`    [dry] ${ids.shopId}/${ids.castId} | ${info.name} (${info.age}) | ${shopUrl}`);
        totalNew++;
        continue;
      }

      const shop = stmts.findShopBySource.get(shopUrl);
      if (!shop) {
        shopMissing++;
        totalSkipped++;
        continue;
      }

      const sourceId = `esthezukan_${ids.castId}`;
      const existing = stmts.findGirlBySource.get(sourceId);
      if (existing) {
        stmts.updateGirl.run({ name: info.name, age: info.age, source_id: sourceId });
        totalUpdated++;
      } else {
        stmts.insertGirl.run({
          name: info.name,
          shop_id: shop.id,
          age: info.age,
          source_id: sourceId,
        });
        totalNew++;
      }
    } catch (e) {
      if (processed % 100 === 0) console.log(`    [warn] ${url}: ${e.message}`);
      totalSkipped++;
    }

    if (processed % 100 === 0) {
      console.log(`    ... ${processed}/${targetUrls.length} (new ${totalNew}, upd ${totalUpdated}, skip ${totalSkipped}, shop missing ${shopMissing})`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('サマリー (esthe-zukan cast)');
  console.log('='.repeat(60));
  console.log(`  処理: ${processed}, 新規: ${totalNew}, 更新: ${totalUpdated}, スキップ: ${totalSkipped} (うち shop未取得: ${shopMissing})`);
  if (!dryRun) stmts.db.close();
}

// ─── CLI ────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'shops';
  const dryRun = args.includes('--dry-run');
  const prefIdx = args.indexOf('--pref');
  const prefFilter = prefIdx >= 0 ? args[prefIdx + 1] : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

  if (command === 'shops') {
    await scrapeShops(prefFilter, dryRun);
  } else if (command === 'cast') {
    await scrapeCast(dryRun, limit);
  } else {
    console.error('未対応コマンド:', command);
    console.error('使い方:');
    console.error('  node scripts/scrape-esthezukan.mjs shops [--pref tokyo] [--dry-run]');
    console.error('  node scripts/scrape-esthezukan.mjs cast [--dry-run] [--limit N]');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
