#!/usr/bin/env node
/**
 * 風俗じゃぱん (fuzoku.jp) スクレイピングスクリプト
 *
 * 使い方:
 *   node scripts/scrape-fuzoku-japan.mjs shops --pref tokyo          # 東京の店舗一覧を取得
 *   node scripts/scrape-fuzoku-japan.mjs shops --pref tokyo --dry-run # DB書き込みせずに確認
 *   node scripts/scrape-fuzoku-japan.mjs girls --pref tokyo          # 東京の嬢一覧を取得
 *   node scripts/scrape-fuzoku-japan.mjs girls --resume              # 中断から再開
 *   node scripts/scrape-fuzoku-japan.mjs trends --pref tokyo         # 写真信頼度スコア取得
 *   node scripts/scrape-fuzoku-japan.mjs all --pref tokyo            # 全フェーズ順次実行
 *
 * fuzoku.jp 構造:
 *   エリア一覧:  https://fuzoku.jp/{pref}/
 *   店舗一覧:    https://fuzoku.jp/{pref}/{area_code}/biz_4/  (デリヘル)
 *   嬢一覧:      https://fuzoku.jp/{shopslug}/girllist/
 *   口コミ:      https://fuzoku.jp/{shopslug}/review/
 *   嬢プロフ:    https://fuzoku.jp/{shopslug}/girl/{girl_id}/
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pickArea } from './lib/unified-areas.mjs';
import { cleanShopName } from './lib/clean-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_FILE = path.join(PROJECT_ROOT, 'fuzoku-japan-progress.json');

const BASE = 'https://fuzoku.jp';
const DELAY_MIN = 1500;
const DELAY_JITTER = 800;
const MAX_RETRIES = 3;
const ITEMS_PER_PAGE = 50;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

// ─── 全47都道府県コード ───────────────────────────────
const PREFECTURES = {
  hokkaido:  { name: '北海道', region: '北海道' },
  aomori:    { name: '青森県', region: '東北' },
  iwate:     { name: '岩手県', region: '東北' },
  miyagi:    { name: '宮城県', region: '東北' },
  akita:     { name: '秋田県', region: '東北' },
  yamagata:  { name: '山形県', region: '東北' },
  fukushima: { name: '福島県', region: '東北' },
  ibaraki:   { name: '茨城県', region: '関東' },
  tochigi:   { name: '栃木県', region: '関東' },
  gunma:     { name: '群馬県', region: '関東' },
  saitama:   { name: '埼玉県', region: '関東' },
  chiba:     { name: '千葉県', region: '関東' },
  tokyo:     { name: '東京都', region: '関東' },
  kanagawa:  { name: '神奈川県', region: '関東' },
  niigata:   { name: '新潟県', region: '中部' },
  toyama:    { name: '富山県', region: '中部' },
  ishikawa:  { name: '石川県', region: '中部' },
  fukui:     { name: '福井県', region: '中部' },
  yamanashi: { name: '山梨県', region: '中部' },
  nagano:    { name: '長野県', region: '中部' },
  gifu:      { name: '岐阜県', region: '中部' },
  shizuoka:  { name: '静岡県', region: '中部' },
  aichi:     { name: '愛知県', region: '中部' },
  mie:       { name: '三重県', region: '近畿' },
  shiga:     { name: '滋賀県', region: '近畿' },
  kyoto:     { name: '京都府', region: '近畿' },
  osaka:     { name: '大阪府', region: '近畿' },
  hyogo:     { name: '兵庫県', region: '近畿' },
  nara:      { name: '奈良県', region: '近畿' },
  wakayama:  { name: '和歌山県', region: '近畿' },
  tottori:   { name: '鳥取県', region: '中国' },
  shimane:   { name: '島根県', region: '中国' },
  okayama:   { name: '岡山県', region: '中国' },
  hiroshima: { name: '広島県', region: '中国' },
  yamaguchi: { name: '山口県', region: '中国' },
  tokushima: { name: '徳島県', region: '四国' },
  kagawa:    { name: '香川県', region: '四国' },
  ehime:     { name: '愛媛県', region: '四国' },
  kochi:     { name: '高知県', region: '四国' },
  fukuoka:   { name: '福岡県', region: '九州' },
  saga:      { name: '佐賀県', region: '九州' },
  nagasaki:  { name: '長崎県', region: '九州' },
  kumamoto:  { name: '熊本県', region: '九州' },
  oita:      { name: '大分県', region: '九州' },
  miyazaki:  { name: '宮崎県', region: '九州' },
  kagoshima: { name: '鹿児島県', region: '九州' },
  okinawa:   { name: '沖縄県', region: '九州' },
};

// ─── CLI引数パース ──────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  return {
    command,
    pref: args.find((a, i) => args[i - 1] === '--pref') || null,
    region: args.find((a, i) => args[i - 1] === '--region') || null,
    resume: args.includes('--resume'),
    dryRun: args.includes('--dry-run'),
  };
}

// ─── DB ─────────────────────────────────────────────
function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      prefecture TEXT
    );
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area_id INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'デリヘル',
      description TEXT,
      source_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (area_id) REFERENCES areas(id)
    );
    CREATE TABLE IF NOT EXISTS girls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shop_id INTEGER NOT NULL,
      age INTEGER,
      height INTEGER,
      bust INTEGER,
      waist INTEGER,
      hip INTEGER,
      cup TEXT,
      image_url TEXT,
      source_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_girls_source_id ON girls(source_id) WHERE source_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      girl_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL,
      panel_rating TEXT NOT NULL CHECK(panel_rating IN ('panel_match','panel_diff','jirai')),
      comment TEXT,
      browser_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (girl_id) REFERENCES girls(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique ON reviews(girl_id, browser_id);
  `);

  const addColIfMissing = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    }
  };
  addColIfMissing('areas', 'prefecture', 'TEXT');
  addColIfMissing('shops', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('shops', 'last_seen_at', 'TEXT');
  addColIfMissing('girls', 'source_id', 'TEXT');
  addColIfMissing('girls', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  addColIfMissing('girls', 'last_seen_at', 'TEXT');
  addColIfMissing('girls', 'image_url', 'TEXT');

  return db;
}

// ─── 進捗管理 ───────────────────────────────────────
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { completedPrefs: [], currentPref: null, currentShopId: 0, phase: null };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function clearProgress() {
  try { fs.unlinkSync(PROGRESS_FILE); } catch {}
}

// ─── Puppeteer ──────────────────────────────────────
async function setupBrowser() {
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 800 });
  return { browser, page };
}

async function fetchPage(page, url) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);
      return await page.content();
    } catch (e) {
      if (attempt === MAX_RETRIES - 1) throw e;
      console.log(`  Retry ${attempt + 1}: ${e.message}`);
      await sleep(3000 * (attempt + 1));
    }
  }
}

// ─── ヘルパー ────────────────────────────────────────
function normalizeName(name) {
  return name.normalize('NFKC').replace(/[\s　]+/g, '').replace(/[☆★♡♥～〜・]/g, '').trim();
}

/**
 * 写真信頼度スコア (5点満点) をパネマジの3段階評価に変換
 *   1.0〜2.5 → jirai (パネマジ)
 *   2.6〜3.5 → panel_diff (普通)
 *   3.6〜5.0 → panel_match (実物の方がいい / 一致)
 */
function convertPhotoScore(score) {
  if (score <= 2.5) return 'jirai';
  if (score <= 3.5) return 'panel_diff';
  return 'panel_match';
}

// ─── パーサー ───────────────────────────────────────

/**
 * 都道府県トップページからエリアリンクを抽出
 * URL形式: /tokyo/a_2001/ or /tokyo/ikebukuro_area/
 */
function parseAreaLinks(html, prefCode) {
  const areas = [];
  // エリアリンクを抽出: /prefCode/area_slug/ 形式
  // 地理的エリアのみ: a_XXXX (数値コード) or XXX_area (名前付きエリア)
  const pattern = new RegExp(
    `<a[^>]*href="(?:https?://fuzoku\\.jp)?/${prefCode}/((?:a_\\d+|[a-z]+_area))/"[^>]*>([^<]+)</a>`,
    'gi'
  );
  const seen = new Set();
  for (const match of html.matchAll(pattern)) {
    const slug = match[1];
    const name = match[2].trim();
    if (name.length > 30 || name.length < 1) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    areas.push({ slug, name });
  }
  return areas;
}

/**
 * 店舗一覧ページから店舗リンクを抽出
 * URL形式: https://fuzoku.jp/{shopslug}/
 */
function parseShopList(html) {
  const shops = [];
  const seen = new Set();
  // 店舗リンク: fuzoku.jp直下のスラッグ（都道府県やシステムページを除外）
  const systemSlugs = new Set([
    'tokyo', 'osaka', 'kanagawa', 'saitama', 'chiba', 'hokkaido', 'aichi', 'fukuoka',
    'kyoto', 'hyogo', 'miyagi', 'hiroshima', 'niigata', 'nagano', 'shizuoka', 'ibaraki',
    'tochigi', 'gunma', 'mie', 'shiga', 'nara', 'wakayama', 'okayama', 'yamaguchi',
    'tottori', 'shimane', 'tokushima', 'kagawa', 'ehime', 'kochi', 'saga', 'nagasaki',
    'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa', 'aomori', 'iwate', 'akita',
    'yamagata', 'fukushima', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'gifu',
    'assets', 'api', 'help', 'info', 'about', 'contact', 'terms', 'privacy',
    'login', 'register', 'mypage', 'search', 'ranking', 'faq', 'ikenbako',
    'otoiawase', 'sitemap', 'guide', 'news', 'blog', 'column',
    ...Object.keys(PREFECTURES),
  ]);

  // <a href="https://fuzoku.jp/{shopslug}/">...<h3>shopname</h3> or <h4>shopname</h4>
  // Also match: <a href="/shopslug/">
  const linkRegex = /<a[^>]*href="(?:https?:\/\/fuzoku\.jp)?\/([a-zA-Z0-9_-]+)\/"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const slug = match[1];
    const inner = match[2];
    if (systemSlugs.has(slug) || slug.startsWith('a_') || slug.endsWith('_area') ||
        slug.startsWith('biz_') || seen.has(slug)) continue;

    // 店名をh3/h4タグまたはリンクテキストから抽出
    const nameMatch = inner.match(/<h[34][^>]*>([\s\S]*?)<\/h[34]>/i);
    let name = nameMatch
      ? nameMatch[1].replace(/<[^>]*>/g, '').trim()
      : inner.replace(/<[^>]*>/g, '').trim().split('\n')[0].trim();

    if (!name || name.length < 2 || name.length > 50) continue;

    seen.add(slug);
    shops.push({
      name,
      slug,
      href: `${BASE}/${slug}/`,
    });
  }
  return shops;
}

/**
 * 店舗一覧ページから合計件数を取得
 * "全170件" のようなテキストを探す
 */
function parseTotalCount(html) {
  const match = html.match(/全(\d+)件/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 嬢一覧ページから嬢データを抽出
 * 形式: T164/B105(H)/W58/H107
 */
function parseGirlList(html, shopSlug) {
  const girls = [];
  // <a href="/shopslug/girl/{id}/">でマッチ
  const girlPattern = new RegExp(
    `<a[^>]*href="(?:https?://fuzoku\\.jp)?/${shopSlug}/girl/(\\d+)/"[^>]*>([\\s\\S]*?)</a>`,
    'gi'
  );

  for (const match of html.matchAll(girlPattern)) {
    const girlId = match[1];
    const inner = match[2];
    const text = inner.replace(/<[^>]*>/g, '\n');
    const lines = text.split('\n').map(s => s.trim()).filter(s => s);

    if (lines.length < 1) continue;

    // 名前: 最初の非空テキスト行（年齢が含まれる場合は分離）
    let name = '';
    let age = null;
    for (const line of lines) {
      const nameAge = line.match(/^(.+?)\s*[（(](\d+)[）)]$/);
      if (nameAge && !name) {
        name = nameAge[1].replace(/\*+/g, '').trim();
        age = parseInt(nameAge[2]);
        break;
      }
      if (!name && !line.match(/^T\d+/) && !line.match(/^\d+:\d+/) && line.length < 20) {
        name = line.replace(/\*+/g, '').trim();
      }
    }

    if (!name || name.length < 1) continue;

    // スペック: T164/B105(H)/W58/H107
    let height = null, bust = null, cup = null, waist = null, hip = null;
    for (const line of lines) {
      const statsMatch = line.match(/T(\d+)\/B(\d+)\((\w+)\)\/W(\d+)\/H(\d+)/);
      if (statsMatch) {
        height = parseInt(statsMatch[1]);
        bust = parseInt(statsMatch[2]);
        cup = statsMatch[3];
        waist = parseInt(statsMatch[4]);
        hip = parseInt(statsMatch[5]);
        break;
      }
    }

    // 年齢が名前行から取れなかった場合
    if (!age) {
      for (const line of lines) {
        const ageMatch = line.match(/[（(](\d+)[）)]/);
        if (ageMatch) { age = parseInt(ageMatch[1]); break; }
      }
    }

    // 画像URL
    const imgMatch = inner.match(/<img[^>]*src="([^"]*files\.fuzoku\.jp[^"]*)"/i);
    const imageUrl = imgMatch ? imgMatch[1].split('?')[0] : null;

    girls.push({
      sourceId: `fj-${shopSlug}-${girlId}`,
      girlId,
      name,
      age,
      height,
      bust,
      cup,
      waist,
      hip,
      imageUrl,
    });
  }

  return girls;
}

/**
 * 嬢一覧から合計人数を取得
 * "在籍中の女の子138人" パターン
 */
function parseGirlCount(html) {
  const match = html.match(/(\d+)人/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 口コミページから写真信頼度スコアを抽出
 * 形式: 写真信頼度 3.5 + 対象嬢名
 */
function parseReviews(html) {
  const reviews = [];
  // 写真信頼度スコアと嬢名を同一レビューブロックから取得
  // レビューは区切りごとに処理
  const blocks = html.split(/(?=<div[^>]*class="[^"]*review)/gi);

  for (const block of blocks) {
    // 写真信頼度を探す
    const scoreMatch = block.match(/写真信頼度[^\d]*?([\d.]+)/);
    if (!scoreMatch) continue;
    const score = parseFloat(scoreMatch[1]);
    if (isNaN(score) || score < 1 || score > 5) continue;

    // 対象嬢名を探す
    let girlName = null;
    // girl/数字/ リンクから名前を取得
    const girlLinkMatch = block.match(/girl\/(\d+)\/[^>]*>[^<]*<[^>]*>([^<]+)/i);
    if (girlLinkMatch) {
      girlName = girlLinkMatch[2].replace(/[（(]\d+[）)]/g, '').trim();
    }
    // フォールバック: テキストから嬢名を探す
    if (!girlName) {
      const nameMatch = block.match(/(?:名前|キャスト|女の子)[：:]?\s*([^\s<(（]+)/);
      if (nameMatch) girlName = nameMatch[1].trim();
    }

    if (!girlName) continue;

    reviews.push({
      girlName,
      photoScore: score,
      panelRating: convertPhotoScore(score),
    });
  }

  return reviews;
}

// ─── Phase 1: 店舗スクレイピング ──────────────────────
async function scrapeShops(db, page, prefCode, opts = {}) {
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 1: 店舗一覧 [${prefInfo.name}] ━━━\n`);

  // 1. エリア一覧を取得
  process.stdout.write(`📍 ${prefInfo.name} エリア取得中... `);
  const prefHtml = await fetchPage(page, `${BASE}/${prefCode}/`);
  const areas = parseAreaLinks(prefHtml, prefCode);
  console.log(`${areas.length} エリア検出`);

  if (areas.length === 0) {
    console.log('  エリアが見つかりません。スキップします。');
    return { newShops: 0, updatedShops: 0 };
  }

  const now = new Date().toISOString();
  // [MECE厳守] レガシー -fj- areas は作らない。 必ず unified-areas (159固定) の正規slug にマップする
  const getAreaBySlug = db.prepare('SELECT id FROM areas WHERE slug = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1 WHERE id = ?');

  // 正規エリア id解決 (slug→id)
  const resolveAreaId = (shopName, sourceUrl, oldAreaName) => {
    const target = pickArea(prefCode, shopName, sourceUrl, oldAreaName);
    if (!target) return null;
    const row = getAreaBySlug.get(target.slug);
    return row ? row.id : null;
  };

  let totalNew = 0, totalUpdated = 0, totalSkipped = 0;
  const seenSlugs = new Set();

  for (const area of areas) {
    // [MECE厳守] レガシー -fj- area は作らない。 shop INSERT時に pickArea で正規slug解決
    try {
      // デリヘル (biz_4) の店舗一覧を取得
      const listUrl = `${BASE}/${prefCode}/${area.slug}/biz_4/`;
      process.stdout.write(`  📂 ${area.name} (biz_4)... `);
      const html = await fetchPage(page, listUrl);
      const totalCount = parseTotalCount(html);
      let shops = parseShopList(html);

      // ページネーション
      if (totalCount > ITEMS_PER_PAGE) {
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
        for (let p = 2; p <= totalPages && p <= 10; p++) {
          try {
            await delay();
            const pageHtml = await fetchPage(page, `${listUrl}?page=${p}`);
            shops.push(...parseShopList(pageHtml));
          } catch (e) {
            console.log(`    [warn] page ${p}: ${e.message}`);
          }
        }
      }

      let areaNew = 0, areaUpdated = 0;

      for (const shop of shops) {
        if (seenSlugs.has(shop.slug)) { totalSkipped++; continue; }
        seenSlugs.add(shop.slug);

        // [MECEルール] 店名はクリーンに
        const cleanedName = cleanShopName(shop.name);
        if (!cleanedName || cleanedName.length < 2) { totalSkipped++; continue; }

        if (opts.dryRun) {
          console.log(`    [dry-run] ${cleanedName} → ${shop.href}`);
          areaNew++;
          totalNew++;
          continue;
        }

        // source_url で重複チェック
        const existing = getShopByUrl.get(shop.href);
        if (existing) {
          updateShopSeen.run(now, existing.id);
          areaUpdated++;
          totalUpdated++;
          continue;
        }

        // [MECEルール] pickArea で正規slug解決して area_id を取得 (レガシー作らない)
        const areaId = resolveAreaId(cleanedName, shop.href, area.name);
        if (!areaId) { totalSkipped++; continue; }

        insertShop.run(cleanedName, areaId, 'デリヘル', shop.href, now);
        areaNew++;
        totalNew++;
      }

      console.log(`${shops.length}件 (新規:${areaNew} 更新:${areaUpdated})`);
      await delay();
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n✅ 店舗スクレイピング完了 [${prefInfo.name}]`);
  console.log(`   新規: ${totalNew} | 更新: ${totalUpdated} | 重複スキップ: ${totalSkipped}`);
  return { newShops: totalNew, updatedShops: totalUpdated };
}

// ─── Phase 2: 嬢スクレイピング ──────────────────────
async function scrapeGirls(db, page, prefCode, opts = {}) {
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 2: 嬢データ [${prefInfo.name}] ━━━\n`);

  const now = new Date().toISOString();

  // fuzoku.jp由来の店舗を取得
  const areaSlugPattern = `${prefCode}-fj-%`;
  let shopQuery = `
    SELECT s.id, s.name, s.source_url FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.source_url LIKE '${BASE}/%'
      AND s.is_active = 1
      AND a.slug LIKE ?`;
  const queryParams = [areaSlugPattern];

  if (opts.resumeShopId) {
    shopQuery += ' AND s.id > ?';
    queryParams.push(opts.resumeShopId);
  }
  shopQuery += ' ORDER BY s.id';

  const shops = db.prepare(shopQuery).all(...queryParams);
  console.log(`📋 対象: ${shops.length} 店舗\n`);

  if (shops.length === 0) return { newGirls: 0, updatedGirls: 0, deactivated: 0 };

  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare(
    'INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, image_url, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
  );
  const updateGirl = db.prepare(
    'UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?'
  );
  const updateGirlImage = db.prepare("UPDATE girls SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '')");
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalDeactivated = 0;
  let shopsDone = 0;

  for (const shop of shops) {
    // source_urlからshopslugを抽出
    const slugMatch = shop.source_url.match(/fuzoku\.jp\/([^/]+)\//);
    if (!slugMatch) { shopsDone++; continue; }
    const shopSlug = slugMatch[1];
    const girlListUrl = `${BASE}/${shopSlug}/girllist/`;

    try {
      process.stdout.write(`[${shopsDone + 1}/${shops.length}] ${shop.name}... `);

      if (opts.dryRun) {
        const html = await fetchPage(page, girlListUrl);
        const girls = parseGirlList(html, shopSlug);
        const count = parseGirlCount(html);
        console.log(`${girls.length}人 (total: ${count}) [dry-run]`);
        for (const g of girls.slice(0, 3)) {
          console.log(`    ${g.name} (${g.age || '?'}歳) ${g.height || '?'}cm ${g.cup || '?'}cup`);
        }
        if (girls.length > 3) console.log(`    ... 他 ${girls.length - 3}人`);
        totalNew += girls.length;
        await delay();
        shopsDone++;
        continue;
      }

      const html = await fetchPage(page, girlListUrl);
      let allScraped = parseGirlList(html, shopSlug);
      const totalCount = parseGirlCount(html);

      // ページネーション
      if (totalCount > ITEMS_PER_PAGE && allScraped.length >= ITEMS_PER_PAGE - 5) {
        const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
        for (let p = 2; p <= totalPages && p <= 10; p++) {
          try {
            await delay();
            const pageHtml = await fetchPage(page, `${girlListUrl}?page=${p}`);
            allScraped.push(...parseGirlList(pageHtml, shopSlug));
          } catch {}
        }
      }

      const seenIds = new Set();
      let sNew = 0, sUpd = 0;

      const tx = db.transaction(() => {
        for (const girl of allScraped) {
          seenIds.add(girl.sourceId);
          const ex = getGirlBySourceId.get(girl.sourceId);
          if (ex) {
            const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height ||
              ex.bust !== girl.bust || ex.cup !== girl.cup || ex.waist !== girl.waist || ex.hip !== girl.hip;
            if (changed) {
              updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, ex.id);
            } else {
              markSeen.run(now, ex.id);
            }
            if (girl.imageUrl) updateGirlImage.run(girl.imageUrl, ex.id);
            sUpd++;
            continue;
          }

          // 名前マッチ (source_idなし = 他ソース由来)
          const seed = getGirlByNameShop.get(girl.name, shop.id);
          if (seed) {
            db.prepare(
              'UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, image_url = COALESCE(image_url, ?), is_active = 1, last_seen_at = ? WHERE id = ?'
            ).run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.imageUrl, now, seed.id);
            sUpd++;
            continue;
          }

          insertGirl.run(girl.name, shop.id, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.imageUrl, girl.sourceId, now);
          sNew++;
        }

        // 退店処理
        let deactivated = 0;
        if (seenIds.size > 0) {
          const fjPrefix = `fj-${shopSlug}-%`;
          deactivated = db.prepare(
            `UPDATE girls SET is_active = 0 WHERE shop_id = ? AND source_id LIKE ? AND is_active = 1 AND source_id NOT IN (${[...seenIds].map(() => '?').join(',')})`
          ).run(shop.id, fjPrefix, ...seenIds).changes;
        }
        return deactivated;
      });

      const deact = tx();
      console.log(`${allScraped.length}人 (新:${sNew} 更新:${sUpd} 退店:${deact})`);
      totalNew += sNew;
      totalUpdated += sUpd;
      totalDeactivated += deact;
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }

    shopsDone++;
    if (!opts.dryRun) {
      saveProgress({
        ...loadProgress(),
        currentPref: prefCode,
        currentShopId: shop.id,
        phase: 'girls',
      });
    }
    await delay();
  }

  if (!opts.dryRun) clearProgress();
  console.log(`\n✅ 嬢スクレイピング完了 [${prefInfo.name}]`);
  console.log(`   新規: ${totalNew} | 更新: ${totalUpdated} | 退店: ${totalDeactivated}`);
  return { newGirls: totalNew, updatedGirls: totalUpdated, deactivated: totalDeactivated };
}

// ─── Phase 3: 口コミ（写真信頼度）スクレイピング ──────
async function scrapeTrends(db, page, prefCode, opts = {}) {
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 3: 写真信頼度 [${prefInfo.name}] ━━━\n`);

  const now = new Date().toISOString();
  const areaSlugPattern = `${prefCode}-fj-%`;

  // fuzoku.jp由来の店舗を取得
  const shops = db.prepare(`
    SELECT s.id, s.name, s.source_url FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.source_url LIKE '${BASE}/%'
      AND s.is_active = 1
      AND a.slug LIKE ?
    ORDER BY s.id
  `).all(areaSlugPattern);

  console.log(`📋 対象: ${shops.length} 店舗\n`);

  if (shops.length === 0) return { totalReviews: 0 };

  let totalReviews = 0, totalMatched = 0, shopsDone = 0;

  for (const shop of shops) {
    const slugMatch = shop.source_url.match(/fuzoku\.jp\/([^/]+)\//);
    if (!slugMatch) { shopsDone++; continue; }
    const shopSlug = slugMatch[1];
    const reviewUrl = `${BASE}/${shopSlug}/review/`;

    try {
      process.stdout.write(`[${shopsDone + 1}/${shops.length}] ${shop.name}... `);
      const html = await fetchPage(page, reviewUrl);
      const reviews = parseReviews(html);

      if (reviews.length === 0) {
        console.log('口コミなし');
        shopsDone++;
        await delay();
        continue;
      }

      if (opts.dryRun) {
        console.log(`${reviews.length}件 [dry-run]`);
        for (const r of reviews.slice(0, 3)) {
          console.log(`    ${r.girlName}: 写真信頼度 ${r.photoScore} → ${r.panelRating}`);
        }
        totalReviews += reviews.length;
        shopsDone++;
        await delay();
        continue;
      }

      // 嬢名で口コミをマッチングしてDB保存
      let matched = 0;
      for (const review of reviews) {
        // 嬢を名前で検索
        const girl = db.prepare(
          'SELECT id FROM girls WHERE name = ? AND shop_id = ? AND is_active = 1'
        ).get(review.girlName, shop.id);

        if (!girl) continue;

        // browser_id で重複防止 (fuzoku-japan-{shopSlug}-{girlName} 形式)
        const browserId = `fj-trend-${shopSlug}-${normalizeName(review.girlName)}`;
        const existing = db.prepare(
          'SELECT id FROM reviews WHERE girl_id = ? AND browser_id = ?'
        ).get(girl.id, browserId);

        if (existing) {
          // スコア更新
          db.prepare('UPDATE reviews SET panel_rating = ?, visit_date = ? WHERE id = ?')
            .run(review.panelRating, now, existing.id);
        } else {
          db.prepare(
            'INSERT INTO reviews (girl_id, panel_rating, visit_date, browser_id, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(girl.id, review.panelRating, now, browserId, `写真信頼度: ${review.photoScore}/5.0 (fuzoku.jp)`, now);
        }
        matched++;
      }

      console.log(`${reviews.length}件 (マッチ: ${matched})`);
      totalReviews += reviews.length;
      totalMatched += matched;
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }

    shopsDone++;
    await delay();
  }

  console.log(`\n✅ 写真信頼度スクレイピング完了 [${prefInfo.name}]`);
  console.log(`   口コミ総数: ${totalReviews} | マッチ成功: ${totalMatched}`);
  return { totalReviews, totalMatched };
}

// ─── メイン ─────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const { command } = opts;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   パネマジ掲示板 風俗じゃぱんスクレイパー  ║');
  console.log('╚══════════════════════════════════════════╝');
  if (opts.dryRun) console.log('🔍 DRY-RUN モード (DB書き込みなし)\n');

  if (!['shops', 'girls', 'trends', 'all'].includes(command)) {
    console.log('使い方:');
    console.log('  node scripts/scrape-fuzoku-japan.mjs shops --pref tokyo');
    console.log('  node scripts/scrape-fuzoku-japan.mjs girls --pref tokyo');
    console.log('  node scripts/scrape-fuzoku-japan.mjs trends --pref tokyo');
    console.log('  node scripts/scrape-fuzoku-japan.mjs all --pref tokyo');
    console.log('\nオプション:');
    console.log('  --pref <code>   都道府県コード (tokyo, osaka 等)');
    console.log('  --region <name> リージョン (関東, 近畿 等)');
    console.log('  --resume        中断から再開');
    console.log('  --dry-run       DB書き込みせずに確認');
    process.exit(0);
  }

  // 対象都道府県を決定
  let targetPrefs = Object.entries(PREFECTURES);
  if (opts.region) {
    targetPrefs = targetPrefs.filter(([, info]) => info.region === opts.region);
    console.log(`リージョン: ${opts.region} (${targetPrefs.length} 都道府県)`);
  }
  if (opts.pref) {
    targetPrefs = targetPrefs.filter(([code]) => code === opts.pref);
    if (targetPrefs.length === 0) {
      console.error(`不明な都道府県コード: ${opts.pref}`);
      process.exit(1);
    }
  }

  // 進捗から再開
  let progress = opts.resume ? loadProgress() : { completedPrefs: [], currentPref: null, currentShopId: 0 };
  if (opts.resume && progress.completedPrefs.length > 0) {
    console.log(`再開モード: ${progress.completedPrefs.length} 都道府県完了済み`);
    targetPrefs = targetPrefs.filter(([code]) => !progress.completedPrefs.includes(code));
  }

  console.log(`対象: ${targetPrefs.length} 都道府県\n`);

  const db = opts.dryRun ? null : openDb();
  const { browser, page } = await setupBrowser();

  try {
    for (const [prefCode, prefInfo] of targetPrefs) {
      console.log(`\n═══ ${prefInfo.name} (${prefInfo.region}) ═══`);

      const resumeShopId = (opts.resume && progress.currentPref === prefCode) ? progress.currentShopId : 0;

      try {
        if (opts.dryRun) {
          // dry-runモードではDBを開かずにスクレイピングのみ
          const dummyDb = openDb();
          try {
            if (command === 'shops' || command === 'all') {
              await scrapeShops(dummyDb, page, prefCode, { dryRun: true });
            }
            if (command === 'girls' || command === 'all') {
              await scrapeGirls(dummyDb, page, prefCode, { dryRun: true, resumeShopId });
            }
            if (command === 'trends' || command === 'all') {
              await scrapeTrends(dummyDb, page, prefCode, { dryRun: true });
            }
          } finally {
            dummyDb.close();
          }
        } else {
          if (command === 'shops' || command === 'all') {
            await scrapeShops(db, page, prefCode, {});
          }
          if (command === 'girls' || command === 'all') {
            await scrapeGirls(db, page, prefCode, { resumeShopId });
          }
          if (command === 'trends' || command === 'all') {
            await scrapeTrends(db, page, prefCode, {});
          }
        }

        // 都道府県完了を記録
        if (!opts.dryRun) {
          progress.completedPrefs.push(prefCode);
          progress.currentPref = null;
          progress.currentShopId = 0;
          saveProgress(progress);
        }
      } catch (e) {
        console.error(`\n❌ ${prefInfo.name} エラー: ${e.message}`);
        // ブラウザクラッシュ時はリスタート
        try {
          await page.goto('about:blank');
        } catch {
          console.log('  ブラウザ再起動中...');
          try { await browser.close(); } catch {}
          const restarted = await setupBrowser();
          Object.assign(page, restarted.page);
        }
      }
    }

    if (!opts.dryRun) {
      clearProgress();
      // DB統計出力
      const stats = {
        shops: db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get().c,
        girls: db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get().c,
        reviews: db.prepare('SELECT COUNT(*) as c FROM reviews').get().c,
      };
      console.log('\n' + '='.repeat(50));
      console.log(`  アクティブ店舗: ${stats.shops} | 嬢: ${stats.girls} | 口コミ: ${stats.reviews}`);
      console.log('='.repeat(50));
    }
  } finally {
    try { await browser.close(); } catch {}
    if (db) db.close();
  }

  console.log('\n✅ 完了');
}

main().catch(e => { console.error('\n💀 エラー:', e.message); process.exit(1); });
