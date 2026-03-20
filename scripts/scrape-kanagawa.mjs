#!/usr/bin/env node
/**
 * 神奈川県デリヘル スクレイピングスクリプト
 * puppeteer + better-sqlite3 を使用
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');

const BASE = 'https://www.cityheaven.net';
const DELAY_MIN = 1500;
const DELAY_JITTER = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

// ─── 神奈川エリア定義 ───
const KANAGAWA_AREAS = {
  'A1401': { name: '横浜・関内・日ノ出町', slug: 'yokohama-kannai' },
  'A1402': { name: '川崎', slug: 'kawasaki' },
  'A1403': { name: '横須賀・三浦', slug: 'yokosuka' },
  'A1404': { name: '藤沢・湘南', slug: 'fujisawa' },
  'A1405': { name: '厚木・海老名', slug: 'atsugi' },
  'A1406': { name: '相模原・橋本', slug: 'sagamihara' },
  'A1407': { name: '小田原・箱根', slug: 'odawara' },
  'A1408': { name: '溝の口・たまプラーザ', slug: 'mizonokuchi' },
  'A1409': { name: '武蔵小杉・新丸子', slug: 'musashikosugi' },
  'A1410': { name: '大和・座間', slug: 'yamato' },
  'A1411': { name: '平塚・秦野', slug: 'hiratsuka' },
};

// ─── DB ───
function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS shops (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, area_id INTEGER NOT NULL, category TEXT NOT NULL DEFAULT 'デリヘル', description TEXT, source_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (area_id) REFERENCES areas(id));
    CREATE TABLE IF NOT EXISTS girls (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, shop_id INTEGER NOT NULL, age INTEGER, height INTEGER, bust INTEGER, waist INTEGER, hip INTEGER, cup TEXT, image_url TEXT, source_id TEXT, is_active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (shop_id) REFERENCES shops(id));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_girls_source_id ON girls(source_id) WHERE source_id IS NOT NULL;
  `);

  return db;
}

// ─── Puppeteer helpers ───
async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  // Set age verification cookie
  await page.setCookie({
    name: 'nenrei',
    value: 'y',
    domain: '.cityheaven.net',
  });
  await page.setViewport({ width: 1280, height: 800 });
  return page;
}

async function fetchPageWithPuppeteer(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Wait a bit for JS to settle
      await sleep(1000);
      const content = await page.content();
      if (content.length < 5000 && content.includes('nenrei')) {
        throw new Error('Age verification page');
      }
      return content;
    } catch (e) {
      console.log(`  Retry ${attempt + 1}: ${e.message}`);
      if (attempt === 2) throw e;
      await sleep(3000 * (attempt + 1));
    }
  }
}

// ─── Parsers (reuse from scrape.mjs logic) ───
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

// ─── Phase 1: 店舗スクレイピング ───
async function scrapeShops(db, page) {
  console.log('\n━━━ Phase 1: 神奈川 店舗一覧スクレイピング ━━━\n');

  const now = new Date().toISOString();
  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name, slug) VALUES (?, ?)');
  const getAreaByName = db.prepare('SELECT id FROM areas WHERE name = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1, name = ?, category = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0;
  const seenHrefs = new Set();

  // Pre-create all areas
  for (const [code, info] of Object.entries(KANAGAWA_AREAS)) {
    insertArea.run(info.name, info.slug);
  }

  for (const [areaCode, areaInfo] of Object.entries(KANAGAWA_AREAS)) {
    try {
      process.stdout.write(`📍 ${areaInfo.name}... `);
      const url = `${BASE}/kanagawa/${areaCode}/`;
      const html = await fetchPageWithPuppeteer(page, url);
      const shops = parseShopList(html);

      // Check for sub-areas
      const subAreaPattern = new RegExp(`/kanagawa/${areaCode}/A\\d+/`, 'g');
      const subAreaMatches = html.match(subAreaPattern) || [];
      const subAreas = [...new Set(subAreaMatches)];
      let extraShops = [];

      if (shops.length >= 30 && subAreas.length > 0) {
        process.stdout.write(`(${shops.length}件, ${subAreas.length}サブエリア) `);
        for (const subPath of subAreas) {
          try {
            await delay();
            const subHtml = await fetchPageWithPuppeteer(page, `${BASE}${subPath}`);
            const sub = parseShopList(subHtml);
            extraShops.push(...sub);
          } catch (e) {
            console.log(`  サブエリアエラー: ${e.message}`);
          }
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
      const areaRow = getAreaByName.get(areaInfo.name);
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

      console.log(`${allShops.length}件 → デリヘル (新規:${areaNew} 更新:${areaUpdated})`);
      await delay();
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n✅ 神奈川 店舗スクレイピング完了`);
  console.log(`   新規: ${totalNew} | 更新: ${totalUpdated}`);
  console.log(`   ユニーク店舗数: ${seenHrefs.size}`);
  return totalNew + totalUpdated;
}

// ─── Phase 2: 女性スクレイピング ───
async function scrapeGirls(db, page) {
  console.log('\n━━━ Phase 2: 神奈川 女性データスクレイピング ━━━\n');

  const now = new Date().toISOString();

  // Get all kanagawa area IDs
  const kanagawaAreaSlugs = Object.values(KANAGAWA_AREAS).map(a => a.slug);
  const placeholders = kanagawaAreaSlugs.map(() => '?').join(',');
  const kanagawaAreaIds = db.prepare(`SELECT id FROM areas WHERE slug IN (${placeholders})`).all(...kanagawaAreaSlugs).map(r => r.id);

  if (kanagawaAreaIds.length === 0) {
    console.log('❌ 神奈川エリアが見つかりません');
    return;
  }

  const areaPlaceholders = kanagawaAreaIds.map(() => '?').join(',');
  const shops = db.prepare(`SELECT id, name, source_url FROM shops WHERE source_url IS NOT NULL AND is_active = 1 AND area_id IN (${areaPlaceholders}) ORDER BY id`).all(...kanagawaAreaIds);
  console.log(`📋 対象: ${shops.length} 店舗\n`);

  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalReconciled = 0;
  let shopsDone = 0;
  const errors = [];

  for (const shop of shops) {
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      process.stdout.write(`[${shopsDone + 1}/${shops.length}] ${shop.name}... `);
      const html = await fetchPageWithPuppeteer(page, girlListUrl);
      let allScraped = parseGirlList(html);

      // Check for page 2 if 100+ girls
      if (allScraped.length >= 100) {
        try {
          await delay();
          const html2 = await fetchPageWithPuppeteer(page, girlListUrl.replace(/\/$/, '') + '/p2/');
          allScraped = [...allScraped, ...parseGirlList(html2)];
        } catch {}
      }

      const seenIds = new Set();
      let sNew = 0, sUpd = 0, sRec = 0;

      const tx = db.transaction(() => {
        for (const girl of allScraped) {
          seenIds.add(girl.sourceId);
          const ex = getGirlBySourceId.get(girl.sourceId);
          if (ex) {
            const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height ||
              ex.bust !== girl.bust || ex.cup !== girl.cup || ex.waist !== girl.waist || ex.hip !== girl.hip;
            if (changed) updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, ex.id);
            else markSeen.run(now, ex.id);
            sUpd++; continue;
          }
          const seed = getGirlByNameShop.get(girl.name, shop.id);
          if (seed) {
            db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?')
              .run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, seed.id);
            sRec++; continue;
          }
          insertGirl.run(girl.name, shop.id, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.sourceId, now);
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
      console.log(`${allScraped.length}人 (新:${sNew} 更新:${sUpd} 照合:${sRec} 退店:${deact})`);
      totalNew += sNew; totalUpdated += sUpd; totalReconciled += sRec;
    } catch (e) {
      console.log(`❌ ${e.message}`);
      errors.push({ shopId: shop.id, name: shop.name, error: e.message });
    }

    shopsDone++;
    await delay();
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM girls WHERE is_active = 1 AND shop_id IN (SELECT id FROM shops WHERE area_id IN (${areaPlaceholders}))`).get(...kanagawaAreaIds);
  console.log(`\n✅ 神奈川 女性スクレイピング完了`);
  console.log(`   新規: ${totalNew} | 更新: ${totalUpdated} | 照合: ${totalReconciled}`);
  if (errors.length > 0) console.log(`   エラー: ${errors.length} 店舗`);
  console.log(`   神奈川アクティブ女性数: ${total.c}`);
}

// ─── メイン ───
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   神奈川県デリヘル スクレイパー       ║');
  console.log('╚══════════════════════════════════════╝');

  const db = openDb();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await setupPage(browser);

    // First, let's discover actual area codes from the main kanagawa page
    console.log('\n📍 神奈川県エリア一覧を確認中...');
    const mainHtml = await fetchPageWithPuppeteer(page, `${BASE}/kanagawa/`);

    // Extract area codes from the page
    const areaLinks = mainHtml.match(/\/kanagawa\/A\d+\//g) || [];
    const uniqueAreaCodes = [...new Set(areaLinks.map(l => l.match(/A\d+/)[0]))];
    console.log(`  発見エリアコード: ${uniqueAreaCodes.join(', ')}`);

    // Add any codes we didn't have
    for (const code of uniqueAreaCodes) {
      if (!KANAGAWA_AREAS[code]) {
        console.log(`  ⚠ 未定義エリアコード: ${code}`);
      }
    }

    await delay();
    await scrapeShops(db, page);
    await scrapeGirls(db, page);
  } finally {
    await browser.close();
    db.close();
  }
}

main().catch(e => { console.error('\n💀 エラー:', e.message); process.exit(1); });
