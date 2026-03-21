#!/usr/bin/env node
/**
 * 全国デリヘル スクレイピングスクリプト（汎用版）
 *
 * 使い方:
 *   node scripts/scrape-prefecture.mjs osaka              # 大阪の店舗+女性データを取得
 *   node scripts/scrape-prefecture.mjs osaka shops        # 店舗一覧のみ
 *   node scripts/scrape-prefecture.mjs osaka girls        # 女性データのみ
 *   node scripts/scrape-prefecture.mjs osaka --resume     # 中断した続きから再開
 *   node scripts/scrape-prefecture.mjs --list             # 都道府県コード一覧
 *
 * 技術仕様:
 *   - puppeteer で年齢認証cookie設定
 *   - エリアコードは対象県ページから自動取得
 *   - source_url で重複チェック
 *   - 画像URLも同時に取得
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');

const BASE = 'https://www.cityheaven.net';
const DELAY_MIN = 1500;
const DELAY_JITTER = 800;

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

  // Add prefecture column if not exists
  const cols = db.prepare('PRAGMA table_info(areas)').all().map(c => c.name);
  if (!cols.includes('prefecture')) {
    db.exec('ALTER TABLE areas ADD COLUMN prefecture TEXT');
    console.log('  [DB] areas.prefecture カラム追加');
  }

  // Ensure shops/girls columns exist
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
function parseShopList(html) {
  const shops = [];
  const shopRegex = /<a[^>]*class="shop_title_shop"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const catRegex = /<[^>]*class="shop_title_gyousyu"[^>]*>([\s\S]*?)<\/(?:span|div|p|a)>/gi;
  const shopMatches = [...html.matchAll(shopRegex)];
  const catMatches = [...html.matchAll(catRegex)];

  for (let i = 0; i < shopMatches.length; i++) {
    const href = shopMatches[i][1];
    const rawName = shopMatches[i][2].replace(/<[^>]*>/g, '').split('\n').map(s => s.trim()).filter(s => s)[0] || '';
    if (!rawName) continue;

    let category = '';
    if (catMatches[i]) {
      const parts = catMatches[i][1].replace(/<[^>]*>/g, '').split('\n').map(s => s.trim()).filter(s => s);
      category = parts[0] || '';
    }

    const fullHref = href.startsWith('http') ? href : BASE + href;
    shops.push({ name: rawName, href: fullHref, category });
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

    const textMatch = liHtml.match(/<[^>]*class="girllisttext"[^>]*>([\s\S]*?)<\/div>/i);
    if (!textMatch) continue;

    const text = textMatch[1].replace(/<[^>]*>/g, '');
    const lines = text.split('\n').map(s => s.trim()).filter(s => s);
    if (lines.length < 1) continue;

    const name = lines[0].replace(/\s*(更新|NEW|新人).*$/, '').trim();
    const statsLine = lines[1] || '';
    const ageMatch = statsLine.match(/(\d+)歳/);
    const heightMatch = statsLine.match(/T(\d+)/);
    const sizeMatch = statsLine.match(/(\d+)\s*[（(](\w+)[）)]\s*[･・]\s*(\d+)\s*[･・]\s*(\d+)/);

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

// ─── エリア自動検出 ─────────────────────────────────
async function discoverAreas(page, prefCode) {
  console.log(`\n  エリアコード自動検出中...`);
  const html = await fetchPageWithPuppeteer(page, `${BASE}/${prefCode}/`);

  // Extract area codes like /osaka/A2701/
  const pattern = new RegExp(`/${prefCode}/(A\\d+)/`, 'g');
  const matches = html.match(pattern) || [];
  const uniqueCodes = [...new Set(matches.map(m => m.match(/A\d+/)[0]))].sort();

  // Try to get area names from links
  const areas = {};
  for (const code of uniqueCodes) {
    // Try to find the area name in the HTML
    const namePattern = new RegExp(`/${prefCode}/${code}/[^"]*"[^>]*>([^<]+)`, 'i');
    const nameMatch = html.match(namePattern);
    const name = nameMatch ? nameMatch[1].trim() : code;
    const slug = `${prefCode}-${code.toLowerCase()}`;
    areas[code] = { name, slug };
  }

  // If we didn't get names from HTML, use puppeteer evaluate
  if (uniqueCodes.length > 0) {
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
        if (areas[code] && name) {
          areas[code].name = name;
        }
      }
    } catch {}
  }

  console.log(`  発見: ${Object.keys(areas).length} エリア`);
  for (const [code, info] of Object.entries(areas)) {
    console.log(`    ${code}: ${info.name}`);
  }

  return areas;
}

// ─── Phase 1: 店舗スクレイピング ──────────────────────
async function scrapeShops(db, page, prefCode, areas) {
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 1: ${prefInfo.name} 店舗一覧スクレイピング ━━━\n`);

  const now = new Date().toISOString();
  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name, slug, prefecture) VALUES (?, ?, ?)');
  const updateAreaPref = db.prepare('UPDATE areas SET prefecture = ? WHERE slug = ? AND (prefecture IS NULL OR prefecture = \'\')');
  const getAreaBySlug = db.prepare('SELECT id FROM areas WHERE slug = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1, name = ?, category = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0;
  const seenHrefs = new Set();

  // Pre-create all areas with prefecture
  for (const [code, info] of Object.entries(areas)) {
    insertArea.run(info.name, info.slug, prefCode);
    updateAreaPref.run(prefCode, info.slug);
  }

  for (const [areaCode, areaInfo] of Object.entries(areas)) {
    try {
      process.stdout.write(`  ${areaInfo.name}... `);
      const url = `${BASE}/${prefCode}/${areaCode}/`;
      const html = await fetchPageWithPuppeteer(page, url);
      const shops = parseShopList(html);

      // Check for sub-areas
      const subAreaPattern = new RegExp(`/${prefCode}/${areaCode}/A\\d+/`, 'g');
      const subAreaMatches = html.match(subAreaPattern) || [];
      const subAreas = [...new Set(subAreaMatches)];
      let extraShops = [];

      if (shops.length >= 30 && subAreas.length > 0) {
        process.stdout.write(`(${shops.length}件, ${subAreas.length}sub) `);
        for (const subPath of subAreas) {
          try {
            await delay();
            const subHtml = await fetchPageWithPuppeteer(page, `${BASE}${subPath}`);
            extraShops.push(...parseShopList(subHtml));
          } catch {}
        }
      }

      // Also check page 2 if many results
      if (shops.length >= 30) {
        try {
          await delay();
          const html2 = await fetchPageWithPuppeteer(page, url + 'p2/');
          const page2Shops = parseShopList(html2);
          if (page2Shops.length > 0) {
            extraShops.push(...page2Shops);
            process.stdout.write(`(+p2:${page2Shops.length}) `);
          }
        } catch {}
      }

      const allShops = [...shops, ...extraShops];
      const areaRow = getAreaBySlug.get(areaInfo.slug);
      if (!areaRow) {
        console.log(`skip (area not found)`);
        continue;
      }
      const areaId = areaRow.id;
      let areaNew = 0, areaUpdated = 0;

      for (const shop of allShops) {
        if (seenHrefs.has(shop.href)) continue;
        seenHrefs.add(shop.href);

        // Filter to デリヘル only
        if (shop.category && !shop.category.includes('デリヘル')) continue;

        const existing = getShopByUrl.get(shop.href);
        if (existing) {
          updateShopSeen.run(now, shop.name, shop.category || 'デリヘル', existing.id);
          totalUpdated++;
          areaUpdated++;
          continue;
        }

        insertShop.run(shop.name, areaId, shop.category || 'デリヘル', shop.href, now);
        totalNew++;
        areaNew++;
      }

      console.log(`${allShops.length}件 (新規:${areaNew} 更新:${areaUpdated})`);
      await delay();
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }

  console.log(`\n  店舗スクレイピング完了: 新規 ${totalNew} | 更新 ${totalUpdated} | 合計 ${seenHrefs.size}`);
  return totalNew + totalUpdated;
}

// ─── Phase 2: 女性スクレイピング（画像URL同時取得）────
async function scrapeGirls(db, page, prefCode, areas, resume = false) {
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n━━━ Phase 2: ${prefInfo.name} 女性データスクレイピング ━━━\n`);

  const now = new Date().toISOString();
  const progressFile = path.join(PROJECT_ROOT, `scrape-progress-${prefCode}.json`);

  let lastShopId = 0;
  if (resume) {
    try {
      const p = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      if (p?.lastShopId) { lastShopId = p.lastShopId; console.log(`  再開 (shop_id > ${lastShopId})`); }
    } catch {}
  }

  // Get area IDs for this prefecture
  const areaSlugs = Object.values(areas).map(a => a.slug);
  const placeholders = areaSlugs.map(() => '?').join(',');
  const areaIds = db.prepare(`SELECT id FROM areas WHERE slug IN (${placeholders})`).all(...areaSlugs).map(r => r.id);

  if (areaIds.length === 0) {
    console.log('  エリアが見つかりません。先に shops を実行してください。');
    return;
  }

  const areaPlaceholders = areaIds.map(() => '?').join(',');
  const shops = db.prepare(
    `SELECT id, name, source_url FROM shops
     WHERE source_url IS NOT NULL AND is_active = 1
       AND area_id IN (${areaPlaceholders}) AND id > ?
     ORDER BY id`
  ).all(...areaIds, lastShopId);

  console.log(`  対象: ${shops.length} 店舗\n`);

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
            // Update image if missing
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
    fs.writeFileSync(progressFile, JSON.stringify({ prefCode, lastShopId: shop.id, timestamp: now, shopsDone, shopsTotal: shops.length }, null, 2));
    await delay();
  }

  // Clean up progress file
  try { fs.unlinkSync(progressFile); } catch {}

  const totalActive = db.prepare(`SELECT COUNT(*) as c FROM girls WHERE is_active = 1 AND shop_id IN (SELECT id FROM shops WHERE area_id IN (${areaPlaceholders}))`).get(...areaIds);
  console.log(`\n  女性スクレイピング完了`);
  console.log(`    新規: ${totalNew} | 更新: ${totalUpdated} | 照合: ${totalReconciled} | 画像: ${totalImages}`);
  if (errors.length > 0) console.log(`    エラー: ${errors.length} 店舗`);
  console.log(`    ${prefInfo.name} アクティブ女性数: ${totalActive.c}`);
}

// ─── メイン ─────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // --list: 都道府県一覧を表示
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
    console.log('\n使い方: node scripts/scrape-prefecture.mjs <code> [shops|girls] [--resume]');
    return;
  }

  const prefCode = args[0];
  if (!prefCode || !PREFECTURES[prefCode]) {
    console.error(`不明な都道府県コード: ${prefCode}`);
    console.error('node scripts/scrape-prefecture.mjs --list で一覧を確認');
    process.exit(1);
  }

  const command = args.find(a => ['shops', 'girls'].includes(a)) || 'all';
  const resume = args.includes('--resume');
  const prefInfo = PREFECTURES[prefCode];

  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  ${prefInfo.name} デリヘル スクレイパー`.padEnd(42) + '║');
  console.log('╚══════════════════════════════════════════╝');

  const db = openDb();
  const { browser, page } = await setupBrowser();

  try {
    // Step 1: Discover areas
    const areas = await discoverAreas(page, prefCode);

    if (Object.keys(areas).length === 0) {
      console.log('\n  エリアが見つかりませんでした。');
      return;
    }

    await delay();

    // Step 2: Scrape shops
    if (command === 'shops' || command === 'all') {
      await scrapeShops(db, page, prefCode, areas);
    }

    // Step 3: Scrape girls (with images)
    if (command === 'girls' || command === 'all') {
      await scrapeGirls(db, page, prefCode, areas, resume || command === 'all');
    }

    // Summary
    console.log('\n━━━ 全体サマリー ━━━');
    const totalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get();
    const totalGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
    const totalWithImages = db.prepare("SELECT COUNT(*) as c FROM girls WHERE is_active = 1 AND image_url IS NOT NULL AND image_url != ''").get();
    console.log(`  全アクティブ店舗: ${totalShops.c}`);
    console.log(`  全アクティブ女性: ${totalGirls.c}`);
    console.log(`  画像あり: ${totalWithImages.c} (${Math.round(totalWithImages.c / totalGirls.c * 100)}%)`);
  } finally {
    await browser.close();
    db.close();
  }
}

main().catch(e => { console.error('\nerror:', e.message); process.exit(1); });
