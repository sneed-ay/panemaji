#!/usr/bin/env node
/**
 * 業種別スクレイピングスクリプト
 *
 * 使い方:
 *   node scripts/scrape-category.mjs tokyo soap          # 東京のソープ
 *   node scripts/scrape-category.mjs tokyo health        # 東京のヘルス
 *   node scripts/scrape-category.mjs tokyo esthe         # 東京のエステ
 *   node scripts/scrape-category.mjs tokyo soap shops    # 店舗一覧のみ
 *   node scripts/scrape-category.mjs tokyo soap girls    # 女性データのみ
 *   node scripts/scrape-category.mjs tokyo soap --resume # 中断した続きから再開
 *   node scripts/scrape-category.mjs tokyo all           # 全カテゴリ (ソープ+ヘルス+エステ)
 *   node scripts/scrape-category.mjs --list              # 都道府県コード一覧
 *
 * カテゴリ:
 *   soap   / ソープ    -> biz4
 *   health / ヘルス    -> biz1
 *   esthe  / エステ    -> biz7
 *   hotel  / ホテヘル  -> biz5
 *   deli   / デリヘル  -> biz6
 *   all                -> soap + health + esthe を順に実行
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

const BASE = 'https://www.cityheaven.net';
const DELAY_MIN = 1500;
const DELAY_JITTER = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

// ─── カテゴリ定義 ────────────────────────────────────
const CATEGORIES = {
  soap:   { biz: 'biz4', label: 'ソープ',       aliases: ['soap', 'ソープ'] },
  health: { biz: 'biz1', label: 'ヘルス',       aliases: ['health', 'ヘルス', 'ファッションヘルス'] },
  esthe:  { biz: 'biz7', label: 'エステ',       aliases: ['esthe', 'エステ', 'メンズエステ', 'エステ・アロマ'] },
  hotel:  { biz: 'biz5', label: 'ホテヘル',     aliases: ['hotel', 'ホテヘル'] },
  deli:   { biz: 'biz6', label: 'デリヘル',     aliases: ['deli', 'デリヘル'] },
};

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
  `);

  // Add columns if not exist
  const cols = db.prepare('PRAGMA table_info(areas)').all().map(c => c.name);
  if (!cols.includes('prefecture')) {
    db.exec('ALTER TABLE areas ADD COLUMN prefecture TEXT');
  }
  const sc = db.prepare('PRAGMA table_info(shops)').all().map(c => c.name);
  if (!sc.includes('is_active')) db.exec('ALTER TABLE shops ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!sc.includes('last_seen_at')) db.exec('ALTER TABLE shops ADD COLUMN last_seen_at TEXT');
  const gc = db.prepare('PRAGMA table_info(girls)').all().map(c => c.name);
  if (!gc.includes('source_id')) db.exec('ALTER TABLE girls ADD COLUMN source_id TEXT');
  if (!gc.includes('is_active')) db.exec('ALTER TABLE girls ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!gc.includes('last_seen_at')) db.exec('ALTER TABLE girls ADD COLUMN last_seen_at TEXT');
  if (!gc.includes('image_url')) db.exec('ALTER TABLE girls ADD COLUMN image_url TEXT');

  return db;
}

// ─── Puppeteer ──────────────────────────────────────
async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setCookie({
    name: 'nenrei',
    value: 'y',
    domain: '.cityheaven.net',
  });
  await page.setViewport({ width: 1280, height: 800 });
  return { browser, page };
}

async function fetchPageWithPuppeteer(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);
      const content = await page.content();
      if (content.length < 5000 && content.includes('nenrei')) {
        throw new Error('Age verification page');
      }
      return content;
    } catch (e) {
      if (attempt === 2) throw e;
      console.log(`  Retry ${attempt + 1}: ${e.message}`);
      await sleep(3000 * (attempt + 1));
    }
  }
}

// ─── パーサー ───────────────────────────────────────
function parseShopListFromBizPage(html, prefCode) {
  const shops = [];
  // Match shop links with shop_title_shop class
  const shopRegex = /<a[^>]*class="shop_title_shop"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const catRegex = /<[^>]*class="shop_title_gyousyu"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/gi;
  const shopMatches = [...html.matchAll(shopRegex)];
  const catMatches = [...html.matchAll(catRegex)];

  for (let i = 0; i < shopMatches.length; i++) {
    const href = shopMatches[i][1];
    const rawName = shopMatches[i][2].replace(/<[^>]*>/g, '').split('\n').map(s => s.trim()).filter(s => s)[0] || '';
    if (!rawName) continue;

    // Extract area code from href like /tokyo/A1311/A131101/shopname/
    const areaMatch = href.match(new RegExp(`/${prefCode}/(A\\d+)/(A\\d+)/`));
    const areaCode = areaMatch ? areaMatch[1] : null;
    const subAreaCode = areaMatch ? areaMatch[2] : null;

    // Parse category from page
    let category = '';
    if (catMatches[i]) {
      const parts = catMatches[i][1].replace(/<[^>]*>/g, '').split('\n').map(s => s.trim()).filter(s => s);
      category = parts[0] || '';
    }

    const fullHref = href.startsWith('http') ? href : BASE + href;
    shops.push({ name: rawName, href: fullHref, category, areaCode, subAreaCode });
  }
  return shops;
}

function parseGirlList(html) {
  const girls = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(liRegex)) {
    const liHtml = match[1];
    const girlIdMatch = liHtml.match(/girlid-(\d+)/);
    if (!girlIdMatch) continue;

    // 旧形式: class="girllisttext" / 新形式: class="girl_caption"
    let textBlock = liHtml.match(/<[^>]*class="girllisttext"[^>]*>([\s\S]*?)<\/div>/i);
    if (!textBlock) textBlock = liHtml.match(/<div[^>]*class="girl_caption"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (!textBlock) textBlock = liHtml.match(/<div[^>]*class="girl_caption"[^>]*>([\s\S]*)/i);

    const text = textBlock ? textBlock[1].replace(/<[^>]*>/g, '') : liHtml.replace(/<[^>]*>/g, '');
    const lines = text.split('\n').map(s => s.trim()).filter(s => s && s.length < 100);
    if (lines.length < 1) continue;

    let name = '';
    const titleMatch = liHtml.match(/title="([^"]+)"/);
    const altMatch = liHtml.match(/<img[^>]*alt="([^"]+)"/);
    if (titleMatch && titleMatch[1].length < 20) {
      name = titleMatch[1].trim();
    } else {
      for (const line of lines) {
        const cleaned = line.replace(/\s*(更新|NEW|新人|現在待機中|✨[^✨]*✨|💥[^💥]*💥|ご新規[^\s]*).*$/, '').trim();
        if (cleaned && cleaned.length >= 1 && cleaned.length <= 15
            && !cleaned.includes('歳') && !cleaned.match(/^T\d/) && !cleaned.match(/^\d/)
            && !cleaned.includes('・') && !cleaned.includes('No.')
            && !cleaned.includes('写メ') && !cleaned.includes('口コミ')) {
          name = cleaned;
          break;
        }
      }
    }
    if (!name && altMatch) name = altMatch[1].trim();
    if (!name || name.length > 20) continue;

    const fullText = liHtml.replace(/<[^>]*>/g, ' ').replace(/[\t\n\r]+/g, ' ').replace(/\s+/g, ' ');
    const ageMatch = fullText.match(/[\[〔(]?(\d{2})歳[\]〕)]?/);
    const heightMatch = fullText.match(/T(\d{3})/);
    const sizeMatch = fullText.match(/(\d{2,3})\s*[（(]\s*(\w+)\s*[）)]\s*[･・]\s*(\d{2,3})\s*[･・]\s*(\d{2,3})/);

    girls.push({
      name, sourceId: girlIdMatch[1],
      age: ageMatch ? parseInt(ageMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1]) : null,
      bust: sizeMatch ? parseInt(sizeMatch[1]) : null,
      cup: sizeMatch ? sizeMatch[2] : null,
      waist: sizeMatch ? parseInt(sizeMatch[3]) : null,
      hip: sizeMatch ? parseInt(sizeMatch[4]) : null,
    });
  }
  return girls;
}

async function parseImageUrls(page) {
  try {
    return await page.evaluate(() => {
      const results = {};
      const links = document.querySelectorAll('a[href*="girlid-"]');
      for (const link of links) {
        const match = link.href.match(/girlid-(\d+)/);
        if (!match) continue;
        const girlId = match[1];
        const img = link.querySelector('img.no_login') || link.querySelector('img[alt]');
        if (img) {
          const src = img.src || img.getAttribute('data-original') || img.getAttribute('data-src') || '';
          if (src.includes('img2.cityheaven.net/img/girls')) {
            results[girlId] = src.split('?')[0];
          }
        }
      }
      return results;
    });
  } catch {
    return {};
  }
}

// ─── エリア名取得 ────────────────────────────────────
async function discoverAreaNames(page, prefCode) {
  console.log(`  エリア名取得中...`);
  const html = await fetchPageWithPuppeteer(page, `${BASE}/${prefCode}/`);

  const areas = {};
  try {
    const areaData = await page.evaluate((pref) => {
      const links = Array.from(document.querySelectorAll(`a[href*="/${pref}/A"]`));
      const result = {};
      for (const a of links) {
        const m = a.href.match(new RegExp(`/${pref}/(A\\d+)/`));
        if (m) {
          const text = a.textContent.trim();
          if (text && text.length < 50 && !result[m[1]]) {
            result[m[1]] = text;
          }
        }
      }
      return result;
    }, prefCode);

    for (const [code, name] of Object.entries(areaData)) {
      areas[code] = name;
    }
  } catch {}

  console.log(`  ${Object.keys(areas).length} エリア名を取得`);
  return areas;
}

// ─── Phase 1: カテゴリ別 店舗スクレイピング ──────────
async function scrapeShopsByCategory(db, page, prefCode, catKey) {
  const catDef = CATEGORIES[catKey];
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 1: ${prefInfo.name} ${catDef.label} 店舗一覧スクレイピング ━━━\n`);

  const now = new Date().toISOString();

  // Get general area names
  const areaNames = await discoverAreaNames(page, prefCode);
  await delay();

  // [MECE厳守] レガシー area は作らない。 必ず unified-areas (159固定) の正規slug にマップする
  const getAreaBySlug = db.prepare('SELECT id FROM areas WHERE slug = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1, name = ?, category = ? WHERE id = ?');

  // 正規エリアid解決
  const resolveAreaId = (shopName, sourceUrl, oldAreaName) => {
    const target = pickArea(prefCode, shopName, sourceUrl, oldAreaName);
    if (!target) return null;
    const row = getAreaBySlug.get(target.slug);
    return row ? row.id : null;
  };

  let totalNew = 0, totalUpdated = 0;
  const seenHrefs = new Set();

  // Helper to process a list of shops
  function processShops(shops, defaultAreaCode) {
    let pNew = 0, pUpdated = 0;
    for (const shop of shops) {
      if (seenHrefs.has(shop.href)) continue;

      // Determine category label
      const mainCat = shop.category ? shop.category.replace(/\s*[\(（].*$/, '').trim() : '';
      const categoryLabel = mainCat || catDef.label;

      // Filter: only accept shops matching the target category
      const isMatch = catDef.aliases.some(alias =>
        categoryLabel.includes(alias) || alias.includes(categoryLabel)
      ) || categoryLabel === catDef.label;

      if (!isMatch && mainCat) continue;

      seenHrefs.add(shop.href);

      // [MECE厳守] cleanShopName + pickArea で正規 slug 解決 (レガシー area 作らない)
      const cleanedName = cleanShopName(shop.name);
      if (!cleanedName || cleanedName.length < 2) continue;

      const oldAreaName = areaNames[shop.areaCode || defaultAreaCode || ''] || '';
      const areaId = resolveAreaId(cleanedName, shop.href, oldAreaName);
      if (!areaId) continue;

      const existing = getShopByUrl.get(shop.href);
      if (existing) {
        updateShopSeen.run(now, cleanedName, categoryLabel, existing.id);
        totalUpdated++;
        pUpdated++;
      } else {
        insertShop.run(cleanedName, areaId, categoryLabel, shop.href, now);
        totalNew++;
        pNew++;
      }
    }
    return { pNew, pUpdated };
  }

  // Step 1: Flat category listing (correctly filtered, up to 30 shops)
  console.log(`  フラットリスト取得...`);
  const flatUrl = `${BASE}/${prefCode}/shop-list/${catDef.biz}/`;
  const flatHtml = await fetchPageWithPuppeteer(page, flatUrl);
  const flatShops = parseShopListFromBizPage(flatHtml, prefCode);
  const flatResult = processShops(flatShops);
  console.log(`  フラットリスト: ${flatShops.length}件 (新規:${flatResult.pNew} 更新:${flatResult.pUpdated})`);
  await delay();

  // Step 2: Discover which areas actually have this category from the flat listing
  const areasWithCategory = new Set();
  for (const shop of flatShops) {
    if (shop.areaCode) areasWithCategory.add(shop.areaCode);
  }

  // Also get area links from the flat listing page
  try {
    const areaLinksFromPage = await page.evaluate((pref, biz) => {
      const links = document.querySelectorAll(`a[href*="/shop-list/${biz}/"]`);
      const result = {};
      for (const a of links) {
        const href = a.getAttribute('href');
        const m = href.match(new RegExp(`/${pref}/(A\\d+)/shop-list/`));
        if (m) result[m[1]] = a.textContent.trim();
      }
      return result;
    }, prefCode, catDef.biz);

    for (const code of Object.keys(areaLinksFromPage)) {
      areasWithCategory.add(code);
    }
  } catch {}

  console.log(`  ${areasWithCategory.size} エリアで${catDef.label}を検索...\n`);

  // Step 3: For each area, fetch the area-specific category page
  const areaList = [...areasWithCategory].sort();
  for (let ai = 0; ai < areaList.length; ai++) {
    const areaCode = areaList[ai];
    const areaName = areaNames[areaCode] || areaCode;

    try {
      process.stdout.write(`  [${ai+1}/${areaList.length}] ${areaName}... `);
      const url = `${BASE}/${prefCode}/${areaCode}/shop-list/${catDef.biz}/`;
      const html = await fetchPageWithPuppeteer(page, url);
      let shops = parseShopListFromBizPage(html, prefCode);

      // Check if the biz filter is working
      const totalMatch = html.match(/対象の店舗数[\s\S]*?(\d+)/);
      const declaredTotal = totalMatch ? parseInt(totalMatch[1]) : -1;

      if (declaredTotal === 0 && shops.length > 0) {
        console.log(`skip (${catDef.label}なし)`);
        await delay();
        continue;
      }

      // If we got 30+ shops and there are more, try sub-areas
      if (shops.length >= 30 && declaredTotal > shops.length) {
        const subAreaPattern = new RegExp(`/${prefCode}/${areaCode}/(A\\d+)/shop-list/${catDef.biz}/`, 'g');
        const subAreaMatches = html.match(subAreaPattern) || [];
        const subAreaCodes = [...new Set(subAreaMatches.map(m => m.match(/(A\d+)\/shop-list/)[1]))];

        if (subAreaCodes.length > 0) {
          process.stdout.write(`(${shops.length}/${declaredTotal}件, ${subAreaCodes.length}sub) `);
          for (const subCode of subAreaCodes) {
            try {
              await delay();
              const subUrl = `${BASE}/${prefCode}/${areaCode}/${subCode}/shop-list/${catDef.biz}/`;
              const subHtml = await fetchPageWithPuppeteer(page, subUrl);
              shops = [...shops, ...parseShopListFromBizPage(subHtml, prefCode)];
            } catch {}
          }
        }
      }

      const { pNew, pUpdated } = processShops(shops, areaCode);
      const catShopCount = shops.filter(s => {
        const mc = s.category ? s.category.replace(/\s*[\(（].*$/, '').trim() : '';
        return !mc || catDef.aliases.some(a => mc.includes(a) || a.includes(mc));
      }).length;
      console.log(`${catShopCount}件 (新規:${pNew} 更新:${pUpdated})`);
      await delay();
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }

  console.log(`\n  ${catDef.label} 店舗スクレイピング完了: 新規 ${totalNew} | 更新 ${totalUpdated} | 合計 ${seenHrefs.size}`);
  return totalNew + totalUpdated;
}

// ─── Phase 2: 女性スクレイピング（画像URL同時取得）────
async function scrapeGirlsByCategory(db, page, prefCode, catKey, resume = false) {
  const catDef = CATEGORIES[catKey];
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 2: ${prefInfo.name} ${catDef.label} 女性データスクレイピング ━━━\n`);

  const now = new Date().toISOString();
  const progressFile = path.join(PROJECT_ROOT, `scrape-progress-${prefCode}-${catKey}.json`);

  let lastShopId = 0;
  if (resume) {
    try {
      const p = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      if (p?.lastShopId) { lastShopId = p.lastShopId; console.log(`  再開 (shop_id > ${lastShopId})`); }
    } catch {}
  }

  // Find shops for this category in this prefecture
  const categoryLabels = [catDef.label, ...catDef.aliases];
  const placeholders = categoryLabels.map(() => '?').join(',');

  const shops = db.prepare(`
    SELECT s.id, s.name, s.source_url FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.source_url IS NOT NULL AND s.is_active = 1
      AND a.prefecture = ?
      AND s.category IN (${placeholders})
      AND s.id > ?
    ORDER BY s.id
  `).all(prefCode, ...categoryLabels, lastShopId);

  console.log(`  対象: ${shops.length} 店舗\n`);

  if (shops.length === 0) {
    console.log('  店舗が見つかりません。先に shops を実行してください。');
    return;
  }

  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, image_url, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const updateGirlImage = db.prepare("UPDATE girls SET image_url = ? WHERE source_id = ? AND (image_url IS NULL OR image_url = '')");
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalReconciled = 0, totalImages = 0;
  let shopsDone = 0;
  const errors = [];

  for (const shop of shops) {
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      process.stdout.write(`  [${shopsDone + 1}/${shops.length}] ${shop.name}... `);
      const html = await fetchPageWithPuppeteer(page, girlListUrl);
      let allScraped = parseGirlList(html);
      let allImages = await parseImageUrls(page);

      // Check for page 2 if 100+ girls
      if (allScraped.length >= 100) {
        try {
          await delay();
          const html2 = await fetchPageWithPuppeteer(page, girlListUrl.replace(/\/$/, '') + '/p2/');
          allScraped = [...allScraped, ...parseGirlList(html2)];
          Object.assign(allImages, await parseImageUrls(page));
        } catch {}
      }

      const seenIds = new Set();
      let sNew = 0, sUpd = 0, sRec = 0, sImg = 0;

      const tx = db.transaction(() => {
        for (const girl of allScraped) {
          seenIds.add(girl.sourceId);
          const imageUrl = allImages[girl.sourceId] || null;

          const ex = getGirlBySourceId.get(girl.sourceId);
          if (ex) {
            const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height ||
              ex.bust !== girl.bust || ex.cup !== girl.cup || ex.waist !== girl.waist || ex.hip !== girl.hip;
            if (changed) updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, ex.id);
            else markSeen.run(now, ex.id);
            if (imageUrl) {
              const r = updateGirlImage.run(imageUrl, girl.sourceId);
              if (r.changes > 0) sImg++;
            }
            sUpd++; continue;
          }

          const seed = getGirlByNameShop.get(girl.name, shop.id);
          if (seed) {
            db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, image_url = COALESCE(image_url, ?), is_active = 1, last_seen_at = ? WHERE id = ?')
              .run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, imageUrl, now, seed.id);
            sRec++; continue;
          }

          insertGirl.run(girl.name, shop.id, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, imageUrl, girl.sourceId, now);
          if (imageUrl) sImg++;
          sNew++;
        }

        // Deactivate unseen
        if (seenIds.size > 0) {
          const ph = [...seenIds].map(() => '?').join(',');
          return db.prepare(`UPDATE girls SET is_active = 0 WHERE shop_id = ? AND source_id IS NOT NULL AND is_active = 1 AND source_id NOT IN (${ph})`).run(shop.id, ...seenIds).changes;
        }
        return 0;
      });

      const deact = tx();
      console.log(`${allScraped.length}人 (新:${sNew} 更新:${sUpd} 照合:${sRec} 退店:${deact} 画像:${sImg})`);
      totalNew += sNew; totalUpdated += sUpd; totalReconciled += sRec; totalImages += sImg;
    } catch (e) {
      console.log(`error: ${e.message}`);
      errors.push({ shopId: shop.id, name: shop.name, error: e.message });
    }

    shopsDone++;
    fs.writeFileSync(progressFile, JSON.stringify({ prefCode, catKey, lastShopId: shop.id, timestamp: now, shopsDone, shopsTotal: shops.length }, null, 2));
    await delay();
  }

  // Clean up progress file
  try { fs.unlinkSync(progressFile); } catch {}

  console.log(`\n  ${catDef.label} 女性スクレイピング完了`);
  console.log(`    新規: ${totalNew} | 更新: ${totalUpdated} | 照合: ${totalReconciled} | 画像: ${totalImages}`);
  if (errors.length > 0) console.log(`    エラー: ${errors.length} 店舗`);
}

// ─── メイン ─────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // --list
  if (args.includes('--list')) {
    console.log('\n都道府県コード一覧:');
    console.log('─'.repeat(40));
    let currentRegion = '';
    for (const [code, info] of Object.entries(PREFECTURES)) {
      if (info.region !== currentRegion) {
        currentRegion = info.region;
        console.log(`\n【${currentRegion}】`);
      }
      console.log(`  ${code.padEnd(12)} ${info.name}`);
    }
    console.log('\nカテゴリ:');
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      console.log(`  ${key.padEnd(10)} ${cat.label} (${cat.biz})`);
    }
    console.log('\n使い方: node scripts/scrape-category.mjs <都道府県> <カテゴリ> [shops|girls] [--resume]');
    return;
  }

  const prefCode = args[0];
  if (!prefCode || !PREFECTURES[prefCode]) {
    console.error(`不明な都道府県コード: ${prefCode}`);
    console.error('node scripts/scrape-category.mjs --list で一覧を確認');
    process.exit(1);
  }

  const catArg = args[1] || 'all';
  const catKeys = catArg === 'all'
    ? ['soap', 'health', 'esthe']
    : [catArg];

  for (const key of catKeys) {
    if (!CATEGORIES[key]) {
      console.error(`不明なカテゴリ: ${key}`);
      console.error('利用可能: ' + Object.keys(CATEGORIES).join(', ') + ', all');
      process.exit(1);
    }
  }

  const command = args.find(a => ['shops', 'girls'].includes(a)) || 'all';
  const resume = args.includes('--resume');
  const prefInfo = PREFECTURES[prefCode];

  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  ${prefInfo.name} ${catKeys.map(k => CATEGORIES[k].label).join('+')} スクレイパー`.padEnd(42) + '║');
  console.log('╚══════════════════════════════════════════╝');

  const db = openDb();
  const { browser, page } = await setupBrowser();

  try {
    for (const catKey of catKeys) {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`  カテゴリ: ${CATEGORIES[catKey].label}`);
      console.log(`${'═'.repeat(50)}`);

      if (command === 'shops' || command === 'all') {
        await scrapeShopsByCategory(db, page, prefCode, catKey);
      }

      if (command === 'girls' || command === 'all') {
        await scrapeGirlsByCategory(db, page, prefCode, catKey, resume || command === 'all');
      }
    }

    // Summary
    console.log('\n━━━ 全体サマリー ━━━');
    const totalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get();
    const totalGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
    const totalWithImages = db.prepare("SELECT COUNT(*) as c FROM girls WHERE is_active = 1 AND image_url IS NOT NULL AND image_url != ''").get();

    console.log(`  全アクティブ店舗: ${totalShops.c}`);
    console.log(`  全アクティブ女性: ${totalGirls.c}`);
    if (totalGirls.c > 0) {
      console.log(`  画像あり: ${totalWithImages.c} (${Math.round(totalWithImages.c / totalGirls.c * 100)}%)`);
    }

    console.log('\n  カテゴリ別:');
    const catStats = db.prepare('SELECT category, COUNT(*) as shops, (SELECT COUNT(*) FROM girls WHERE shop_id IN (SELECT id FROM shops WHERE category = s.category AND is_active = 1) AND is_active = 1) as girls FROM shops s WHERE is_active = 1 GROUP BY category ORDER BY shops DESC').all();
    for (const row of catStats) {
      console.log(`    ${row.category.padEnd(12)} ${row.shops} 店舗 / ${row.girls} 人`);
    }
  } finally {
    await browser.close();
    db.close();
  }
}

main().catch(e => { console.error('\nerror:', e.message); process.exit(1); });
