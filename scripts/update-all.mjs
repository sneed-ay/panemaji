#!/usr/bin/env node
/**
 * 全国データ定期更新スクリプト
 *
 * 全47都道府県のデリヘルデータを自動更新する。
 * GitHub Actions の週次ジョブから呼び出されることを想定。
 *
 * 処理フロー:
 *   1. 各都道府県のエリア・店舗一覧をスクレイピング
 *   2. 新規店舗を追加、既存店舗の last_seen_at を更新
 *   3. 各店舗の女性一覧を取得し、差分更新（新規追加・スペック更新・退店処理）
 *   4. 画像URLを同時に更新
 *   5. DB統計を出力
 *
 * 差分更新ロジック:
 *   - last_seen_at が7日以内の店舗はスキップ可能（--force で強制再取得）
 *   - 新規店舗は即座にスクレイピング
 *   - 進捗はファイルに保存し、中断時に --resume で再開可能
 *
 * 使い方:
 *   node scripts/update-all.mjs                # 全都道府県を差分更新
 *   node scripts/update-all.mjs --force        # 全店舗を強制再取得
 *   node scripts/update-all.mjs --resume       # 中断から再開
 *   node scripts/update-all.mjs --region 関東  # 特定リージョンのみ
 *   node scripts/update-all.mjs --pref tokyo   # 特定都道府県のみ
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_FILE = path.join(PROJECT_ROOT, 'update-progress.json');

const BASE = 'https://www.cityheaven.net';
const DELAY_MIN = 1500;
const DELAY_JITTER = 800;
const SKIP_THRESHOLD_DAYS = 7; // この日数以内に見た店舗はスキップ

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
  return {
    force: args.includes('--force'),
    resume: args.includes('--resume'),
    region: args.find((a, i) => args[i - 1] === '--region') || null,
    pref: args.find((a, i) => args[i - 1] === '--pref') || null,
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

  // カラムの存在確認と追加
  const addColIfMissing = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      console.log(`  [DB] ${table}.${col} カラム追加`);
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
    return { completedPrefs: [], currentPref: null, currentShopId: 0, phase: 'shops' };
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

  // GitHub Actions では PUPPETEER_EXECUTABLE_PATH が設定される場合がある
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
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
  const html = await fetchPageWithPuppeteer(page, `${BASE}/${prefCode}/`);
  const pattern = new RegExp(`/${prefCode}/(A\\d+)/`, 'g');
  const matches = html.match(pattern) || [];
  const uniqueCodes = [...new Set(matches.map(m => m.match(/A\d+/)[0]))].sort();

  const areas = {};
  for (const code of uniqueCodes) {
    const namePattern = new RegExp(`/${prefCode}/${code}/[^"]*"[^>]*>([^<]+)`, 'i');
    const nameMatch = html.match(namePattern);
    const name = nameMatch ? nameMatch[1].trim() : code;
    const slug = `${prefCode}-${code.toLowerCase()}`;
    areas[code] = { name, slug };
  }

  // puppeteer でエリア名を補完
  if (uniqueCodes.length > 0) {
    try {
      const areaData = await page.evaluate((pref) => {
        const links = Array.from(document.querySelectorAll(`a[href*="/${pref}/A"]`));
        const result = {};
        for (const a of links) {
          const m = a.href.match(new RegExp(`/${pref}/(A\\d+)/`));
          if (m) {
            const text = a.textContent.trim();
            if (text && text.length < 50 && !result[m[1]]) result[m[1]] = text;
          }
        }
        return result;
      }, prefCode);
      for (const [code, name] of Object.entries(areaData)) {
        if (areas[code] && name) areas[code].name = name;
      }
    } catch {}
  }

  return areas;
}

// ─── Phase 1: 店舗スクレイピング ──────────────────────
async function scrapeShops(db, page, prefCode, areas) {
  const prefInfo = PREFECTURES[prefCode];
  console.log(`\n  [shops] ${prefInfo.name}: エリア ${Object.keys(areas).length}件`);

  const now = new Date().toISOString();
  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name, slug, prefecture) VALUES (?, ?, ?)');
  const updateAreaPref = db.prepare("UPDATE areas SET prefecture = ? WHERE slug = ? AND (prefecture IS NULL OR prefecture = '')");
  const getAreaBySlug = db.prepare('SELECT id FROM areas WHERE slug = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1, name = ?, category = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0;
  const seenHrefs = new Set();

  for (const [code, info] of Object.entries(areas)) {
    insertArea.run(info.name, info.slug, prefCode);
    updateAreaPref.run(prefCode, info.slug);
  }

  for (const [areaCode, areaInfo] of Object.entries(areas)) {
    try {
      const url = `${BASE}/${prefCode}/${areaCode}/`;
      const html = await fetchPageWithPuppeteer(page, url);
      const shops = parseShopList(html);

      // サブエリア・ページネーション
      const subAreaPattern = new RegExp(`/${prefCode}/${areaCode}/A\\d+/`, 'g');
      const subAreaMatches = html.match(subAreaPattern) || [];
      const subAreas = [...new Set(subAreaMatches)];
      let extraShops = [];

      // 全ページネーション取得（30件以上なら次ページがある可能性）
      if (shops.length >= 30) {
        for (let pageNum = 2; pageNum <= 20; pageNum++) {
          try {
            await delay();
            const htmlN = await fetchPageWithPuppeteer(page, url + `p${pageNum}/`);
            const pageShops = parseShopList(htmlN);
            if (pageShops.length === 0) break;
            extraShops.push(...pageShops);
            if (pageShops.length < 30) break;
          } catch { break; }
        }
      }

      if (subAreas.length > 0) {
        for (const subPath of subAreas) {
          try {
            await delay();
            const subHtml = await fetchPageWithPuppeteer(page, `${BASE}${subPath}`);
            const subShops = parseShopList(subHtml);
            for (const s of subShops) {
              if (!seenHrefsArea.has(s.href)) {
                seenHrefsArea.add(s.href);
                extraShops.push(s);
              }
            }
          } catch {}
        }
      }

      const allShops = [...shops, ...extraShops];
      const areaRow = getAreaBySlug.get(areaInfo.slug);
      if (!areaRow) continue;

      for (const shop of allShops) {
        if (seenHrefs.has(shop.href)) continue;
        seenHrefs.add(shop.href);
        // 全カテゴリ（デリヘル、ソープ、ヘルス、エステ、ホテヘル等）を取り込む
        // 明らかに無関係なカテゴリのみ除外
        const excludeCats = ['ライブチャット', '出会い系', 'アダルトグッズ'];
        if (shop.category && excludeCats.some(ex => shop.category.includes(ex))) continue;

        const existing = getShopByUrl.get(shop.href);
        if (existing) {
          updateShopSeen.run(now, shop.name, shop.category || 'デリヘル', existing.id);
          totalUpdated++;
        } else {
          insertShop.run(shop.name, areaRow.id, shop.category || 'デリヘル', shop.href, now);
          totalNew++;
        }
      }

      await delay();
    } catch (e) {
      console.log(`    [warn] ${areaInfo.name}: ${e.message}`);
    }
  }

  console.log(`    => 新規: ${totalNew} | 更新: ${totalUpdated}`);
  return { newShops: totalNew, updatedShops: totalUpdated };
}

// ─── Phase 2: 女性スクレイピング ──────────────────────
async function scrapeGirls(db, page, prefCode, areas, opts = {}) {
  const prefInfo = PREFECTURES[prefCode];
  const now = new Date().toISOString();
  const skipThreshold = opts.force ? null : new Date(Date.now() - SKIP_THRESHOLD_DAYS * 86400000).toISOString();

  // エリアIDを取得
  const areaSlugs = Object.values(areas).map(a => a.slug);
  if (areaSlugs.length === 0) return { newGirls: 0, updatedGirls: 0, deactivated: 0, images: 0 };

  const placeholders = areaSlugs.map(() => '?').join(',');
  const areaIds = db.prepare(`SELECT id FROM areas WHERE slug IN (${placeholders})`).all(...areaSlugs).map(r => r.id);
  if (areaIds.length === 0) return { newGirls: 0, updatedGirls: 0, deactivated: 0, images: 0 };

  const areaPlaceholders = areaIds.map(() => '?').join(',');

  // 対象店舗を取得（差分更新: last_seen_at が閾値より古い、またはNULLの店舗）
  let shopQuery = `
    SELECT id, name, source_url, last_seen_at FROM shops
    WHERE source_url IS NOT NULL AND is_active = 1
      AND area_id IN (${areaPlaceholders})`;
  const queryParams = [...areaIds];

  if (skipThreshold) {
    // 差分更新: last_seen_atが古い店舗 OR 嬢が0人の店舗は常に対象
    shopQuery += ` AND (last_seen_at IS NULL OR last_seen_at < ? OR NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id = shops.id AND g.is_active = 1))`;
    queryParams.push(skipThreshold);
  }

  if (opts.resumeShopId) {
    shopQuery += ` AND id > ?`;
    queryParams.push(opts.resumeShopId);
  }

  shopQuery += ` ORDER BY id`;
  const shops = db.prepare(shopQuery).all(...queryParams);

  const totalShopsInPref = db.prepare(
    `SELECT COUNT(*) as c FROM shops WHERE source_url IS NOT NULL AND is_active = 1 AND area_id IN (${areaPlaceholders})`
  ).get(...areaIds).c;

  const skippedCount = totalShopsInPref - shops.length;
  console.log(`  [girls] ${prefInfo.name}: 対象 ${shops.length} 店舗` +
    (skippedCount > 0 ? ` (最近更新済み ${skippedCount} 件スキップ)` : ''));

  if (shops.length === 0) return { newGirls: 0, updatedGirls: 0, deactivated: 0, images: 0 };

  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare(
    'INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, image_url, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
  );
  const updateGirl = db.prepare(
    'UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?'
  );
  const updateGirlImage = db.prepare("UPDATE girls SET image_url = ? WHERE source_id = ? AND (image_url IS NULL OR image_url = '')");
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalDeactivated = 0, totalImages = 0;
  let shopsDone = 0;

  for (const shop of shops) {
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      const html = await fetchPageWithPuppeteer(page, girlListUrl);
      let allScraped = parseGirlList(html);
      let allImages = {};
      if (allScraped.length > 0) {
        allImages = await parseImageUrls(page);
      }

      // 全ページ取得 — ページあたり件数が不定（30,50,100等）なので
      // 「前のページで1人以上取得できた」限り次ページを試行する
      {
        const firstPageCount = allScraped.length;
        if (firstPageCount > 0) {
          let pageNum = 2;
          let consecutiveEmpty = 0;
          while (pageNum <= 50) { // 最大50ページ（5000人程度まで対応）
            try {
              await delay();
              const pageUrl = girlListUrl.replace(/\/$/, '') + `/p${pageNum}/`;
              const htmlN = await fetchPageWithPuppeteer(page, pageUrl);
              const girlsN = parseGirlList(htmlN);
              if (girlsN.length === 0) {
                consecutiveEmpty++;
                if (consecutiveEmpty >= 2) break; // 2連続空なら終了
                pageNum++;
                continue;
              }
              consecutiveEmpty = 0;
              allScraped = [...allScraped, ...girlsN];
              Object.assign(allImages, await parseImageUrls(page));
              pageNum++;
            } catch { break; }
          }
        }
      }

      if (allScraped.length === 0) {
        shopsDone++;
        await delay();
        continue;
      }

      const seenIds = new Set();
      let sNew = 0, sUpd = 0, sImg = 0;

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
            sUpd++;
            continue;
          }

          const seed = getGirlByNameShop.get(girl.name, shop.id);
          if (seed) {
            db.prepare(
              'UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, image_url = COALESCE(image_url, ?), is_active = 1, last_seen_at = ? WHERE id = ?'
            ).run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, imageUrl, now, seed.id);
            sUpd++;
            continue;
          }

          insertGirl.run(girl.name, shop.id, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, imageUrl, girl.sourceId, now);
          if (imageUrl) sImg++;
          sNew++;
        }

        // 退店処理: この店舗にいたがスクレイピング結果に含まれない女性を非アクティブ化
        let deactivated = 0;
        if (seenIds.size > 0) {
          const ph = [...seenIds].map(() => '?').join(',');
          deactivated = db.prepare(
            `UPDATE girls SET is_active = 0 WHERE shop_id = ? AND source_id IS NOT NULL AND is_active = 1 AND source_id NOT IN (${ph})`
          ).run(shop.id, ...seenIds).changes;
        }
        return deactivated;
      });

      const deact = tx();
      totalNew += sNew;
      totalUpdated += sUpd;
      totalDeactivated += deact;
      totalImages += sImg;
    } catch (e) {
      // 店舗単位のエラーはスキップして続行
      if (shopsDone % 50 === 0) console.log(`    [warn] ${shop.name}: ${e.message}`);
    }

    shopsDone++;
    // 100店舗ごとに進捗表示
    if (shopsDone % 100 === 0) {
      console.log(`    ... ${shopsDone}/${shops.length} (new:${totalNew} upd:${totalUpdated} deact:${totalDeactivated})`);
    }

    // 進捗保存（後でresumeできるように）
    saveProgress({
      ...loadProgress(),
      currentPref: prefCode,
      currentShopId: shop.id,
      phase: 'girls',
    });

    await delay();
  }

  console.log(`    => 新規: ${totalNew} | 更新: ${totalUpdated} | 退店: ${totalDeactivated} | 画像: ${totalImages}`);
  return { newGirls: totalNew, updatedGirls: totalUpdated, deactivated: totalDeactivated, images: totalImages };
}

// ─── 30日以上見ていない店舗の非アクティブ化 ──────────
function deactivateStaleShops(db) {
  const threshold = new Date(Date.now() - 30 * 86400000).toISOString();
  const result = db.prepare(
    'UPDATE shops SET is_active = 0 WHERE is_active = 1 AND last_seen_at IS NOT NULL AND last_seen_at < ?'
  ).run(threshold);
  if (result.changes > 0) {
    console.log(`\n  [cleanup] 30日以上未確認の店舗を非アクティブ化: ${result.changes} 件`);
  }

  // その店舗の女性も非アクティブ化
  const girlResult = db.prepare(
    'UPDATE girls SET is_active = 0 WHERE is_active = 1 AND shop_id IN (SELECT id FROM shops WHERE is_active = 0)'
  ).run();
  if (girlResult.changes > 0) {
    console.log(`  [cleanup] 関連する女性を非アクティブ化: ${girlResult.changes} 件`);
  }
}

// ─── DB統計出力 ──────────────────────────────────────
function printStats(db) {
  console.log('\n' + '='.repeat(50));
  console.log('  DB統計サマリー');
  console.log('='.repeat(50));

  const prefs = db.prepare('SELECT COUNT(DISTINCT prefecture) as c FROM areas WHERE prefecture IS NOT NULL').get();
  const areas = db.prepare('SELECT COUNT(*) as c FROM areas').get();
  const activeShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get();
  const totalShops = db.prepare('SELECT COUNT(*) as c FROM shops').get();
  const activeGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
  const totalGirls = db.prepare('SELECT COUNT(*) as c FROM girls').get();
  const withImages = db.prepare("SELECT COUNT(*) as c FROM girls WHERE is_active = 1 AND image_url IS NOT NULL AND image_url != ''").get();
  const reviews = db.prepare('SELECT COUNT(*) as c FROM reviews').get();

  console.log(`  都道府県: ${prefs.c}`);
  console.log(`  エリア:   ${areas.c}`);
  console.log(`  店舗:     ${activeShops.c} アクティブ / ${totalShops.c} 合計`);
  console.log(`  女性:     ${activeGirls.c} アクティブ / ${totalGirls.c} 合計`);
  console.log(`  画像あり: ${withImages.c} (${activeGirls.c > 0 ? Math.round(withImages.c / activeGirls.c * 100) : 0}%)`);
  console.log(`  口コミ:   ${reviews.c}`);
  console.log('='.repeat(50));

  // GitHub Actions 用のサマリー出力
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      '## Data Update Summary',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Prefectures | ${prefs.c} |`,
      `| Active Shops | ${activeShops.c} |`,
      `| Active Girls | ${activeGirls.c} |`,
      `| With Images | ${withImages.c} (${activeGirls.c > 0 ? Math.round(withImages.c / activeGirls.c * 100) : 0}%) |`,
      `| Reviews | ${reviews.c} |`,
    ].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }

  return { prefs: prefs.c, activeShops: activeShops.c, activeGirls: activeGirls.c, reviews: reviews.c };
}

// ─── メイン ─────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const startTime = Date.now();

  console.log('==================================================');
  console.log('  panemaji - 全国データ定期更新');
  console.log(`  ${new Date().toISOString()}`);
  console.log('==================================================');

  // 対象都道府県を決定
  let targetPrefs = Object.entries(PREFECTURES);
  if (opts.region) {
    targetPrefs = targetPrefs.filter(([, info]) => info.region === opts.region);
    console.log(`\nリージョン: ${opts.region} (${targetPrefs.length} 都道府県)`);
  }
  if (opts.pref) {
    targetPrefs = targetPrefs.filter(([code]) => code === opts.pref);
    if (targetPrefs.length === 0) {
      console.error(`不明な都道府県コード: ${opts.pref}`);
      process.exit(1);
    }
  }
  if (opts.force) console.log('モード: 強制再取得 (--force)');

  // 進捗から再開
  let progress = opts.resume ? loadProgress() : { completedPrefs: [], currentPref: null, currentShopId: 0 };
  if (opts.resume && progress.completedPrefs.length > 0) {
    console.log(`再開モード: ${progress.completedPrefs.length} 都道府県完了済み`);
    targetPrefs = targetPrefs.filter(([code]) => !progress.completedPrefs.includes(code));
  }

  console.log(`対象: ${targetPrefs.length} 都道府県\n`);

  const db = openDb();
  const { browser, page } = await setupBrowser();

  const totals = {
    newShops: 0, updatedShops: 0,
    newGirls: 0, updatedGirls: 0, deactivated: 0, images: 0,
    errors: [],
  };

  try {
    for (const [prefCode, prefInfo] of targetPrefs) {
      const prefStart = Date.now();
      console.log(`\n--- ${prefInfo.name} (${prefInfo.region}) ---`);

      try {
        // エリア検出
        const areas = await discoverAreas(page, prefCode);
        if (Object.keys(areas).length === 0) {
          console.log('  エリアなし、スキップ');
          continue;
        }
        await delay();

        // Phase 1: 店舗
        const shopResult = await scrapeShops(db, page, prefCode, areas);
        totals.newShops += shopResult.newShops;
        totals.updatedShops += shopResult.updatedShops;

        // Phase 2: 女性 + 画像
        const resumeShopId = (opts.resume && progress.currentPref === prefCode) ? progress.currentShopId : 0;
        const girlResult = await scrapeGirls(db, page, prefCode, areas, {
          force: opts.force,
          resumeShopId,
        });
        totals.newGirls += girlResult.newGirls;
        totals.updatedGirls += girlResult.updatedGirls;
        totals.deactivated += girlResult.deactivated;
        totals.images += girlResult.images;

        // 完了を記録
        progress.completedPrefs.push(prefCode);
        progress.currentPref = null;
        progress.currentShopId = 0;
        saveProgress(progress);

        const elapsed = ((Date.now() - prefStart) / 1000).toFixed(0);
        console.log(`  完了 (${elapsed}s)`);
      } catch (e) {
        console.error(`  [ERROR] ${prefInfo.name}: ${e.message}`);
        totals.errors.push({ pref: prefCode, error: e.message });

        // ブラウザがクラッシュした場合は再起動を試みる
        try {
          await page.goto('about:blank');
        } catch {
          console.log('  ブラウザを再起動中...');
          try { await browser.close(); } catch {}
          const newBrowser = await setupBrowser();
          Object.assign(page, newBrowser.page);
        }
      }
    }

    // 古い店舗の非アクティブ化
    deactivateStaleShops(db);

    // DB統計
    printStats(db);

    // 合計サマリー
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n--- 更新サマリー (${elapsed}分) ---`);
    console.log(`  店舗: 新規 ${totals.newShops} | 更新 ${totals.updatedShops}`);
    console.log(`  女性: 新規 ${totals.newGirls} | 更新 ${totals.updatedGirls} | 退店 ${totals.deactivated}`);
    console.log(`  画像: ${totals.images}`);
    if (totals.errors.length > 0) {
      console.log(`  エラー: ${totals.errors.length} 都道府県`);
      for (const err of totals.errors) console.log(`    - ${err.pref}: ${err.error}`);
    }

    // 進捗ファイルをクリーンアップ
    clearProgress();
  } finally {
    await browser.close();
    db.close();
  }

  // エラーが多すぎる場合は失敗扱い
  if (totals.errors.length > 10) {
    console.error(`\nエラーが多すぎます (${totals.errors.length}/47)。処理を失敗として終了します。`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('\n致命的エラー:', e.message);
  console.error(e.stack);
  process.exit(1);
});
