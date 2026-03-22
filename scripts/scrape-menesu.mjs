#!/usr/bin/env node
/**
 * メンエス専門サイト スクレイピングスクリプト
 *
 * 使い方:
 *   node scripts/scrape-menesu.mjs shops              # 店舗一覧を取得
 *   node scripts/scrape-menesu.mjs girls              # 全店舗の女性データ取得
 *   node scripts/scrape-menesu.mjs girls --resume     # 中断した続きから再開
 *   node scripts/scrape-menesu.mjs all                # shops → girls を連続実行
 *
 * ソース:
 *   - tokyo.aromaesthe.co.jp (アロマエステ案内所)
 *   - fues.jp (週刊エステ)
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_PATH = path.join(PROJECT_ROOT, 'menesu-progress.json');

const DELAY_MIN = 2000;
const DELAY_JITTER = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

// ─── エリアマッピング ───────────────────────────────────
// aromaesthe のエリア名 → パネマジDBのarea slug
const AREA_MAP = {
  '新宿': 'shinjuku',
  '西東京': 'nishi-tokyo',
  '新宿・西東京': 'shinjuku',
  '池袋': 'ikebukuro',
  '渋谷': 'shibuya',
  '恵比寿': 'shibuya',
  '中目黒': 'gotanda',
  '恵比寿・中目黒': 'shibuya',
  '目黒': 'gotanda',
  '麻布': 'roppongi',
  '品川': 'shinagawa',
  '目黒・麻布・品川': 'gotanda',
  '五反田': 'gotanda',
  '東京駅': 'tokyo-st',
  '銀座': 'shinbashi',
  '東京駅・銀座': 'shinbashi',
  '新橋': 'shinbashi',
  '神田': 'akihabara',
  '上野': 'ueno',
  '神田・上野': 'ueno',
  '吉祥寺': 'kichijoji',
  '赤羽': 'itabashi',
  '王子': 'itabashi',
  '板橋': 'itabashi',
  '赤羽・王子・板橋': 'itabashi',
  '大塚': 'otsuka',
  '巣鴨': 'otsuka',
  '蒲田': 'kamata',
  '六本木': 'roppongi',
  '赤坂': 'roppongi',
  '葛西': 'kinshicho',
  '小岩': 'kinshicho',
  '葛西・小岩・新小岩': 'kinshicho',
  '国分寺': 'kokubunji',
  '立川': 'tachikawa',
  '八王子': 'tachikawa',
  '国分寺・立川・八王子': 'tachikawa',
  '秋葉原': 'akihabara',
  '飯田橋': 'iidabashi',
  '錦糸町': 'kinshicho',
  '都内出張': 'shinjuku',
  'その他東京都近郊': 'nishi-tokyo',
};

// fues.jp エリア名 → パネマジDBのarea slug
const FUES_AREA_MAP = {
  '池袋': 'ikebukuro',
  '高田馬場・新大久保': 'shinjuku',
  '新宿': 'shinjuku',
  '渋谷・代々木': 'shibuya',
  '恵比寿・中目黒': 'shibuya',
  '麻布十番・赤坂・六本木': 'roppongi',
  '五反田・品川': 'gotanda',
  '蒲田': 'kamata',
  '新橋・東京・銀座': 'shinbashi',
  '茅場町・人形町': 'tokyo-st',
  '飯田橋・水道橋': 'iidabashi',
  '神田・秋葉原': 'akihabara',
  '上野': 'ueno',
  '日暮里・鶯谷': 'ueno',
  '大塚・巣鴨': 'otsuka',
  '北千住': 'kinshicho',
  '錦糸町': 'kinshicho',
  '葛西・西葛西': 'kinshicho',
  '赤羽・板橋': 'itabashi',
  '練馬': 'seibu',
  '中野・荻窪・吉祥寺': 'kichijoji',
  '立川・八王子': 'tachikawa',
  '東横・田園都市線': 'tokyu',
  '出張メンズエステ': 'shinjuku',
  '町田': 'nishi-tokyo',
};

function resolveAreaId(db, areaName) {
  // Try direct mapping
  for (const [key, slug] of Object.entries({ ...AREA_MAP, ...FUES_AREA_MAP })) {
    if (areaName.includes(key) || key.includes(areaName)) {
      const area = db.prepare("SELECT id FROM areas WHERE slug = ? AND prefecture = 'tokyo'").get(slug);
      if (area) return area.id;
    }
  }
  // Fallback to shinjuku
  const fallback = db.prepare("SELECT id FROM areas WHERE slug = 'shinjuku'").get();
  return fallback ? fallback.id : 1;
}

// ─── DB準備 ───────────────────────────────────────────
function prepareDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const stmts = {
    findShopBySource: db.prepare('SELECT id FROM shops WHERE source_url = ?'),
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
    getShops: db.prepare("SELECT id, name, source_url FROM shops WHERE category = 'メンズエステ' AND is_active = 1"),
  };

  return { db, stmts };
}

// ─── アロマエステ案内所 スクレイパー ────────────────────
async function scrapeAromaestheShops(browser, db, stmts) {
  console.log('\n' + '='.repeat(60));
  console.log('アロマエステ案内所 - 店舗一覧取得');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en;q=0.9' });

  let shopCount = 0;
  let newCount = 0;

  // Collect all shop URLs from paginated shop_list
  const allShopUrls = new Set();
  for (let pageNum = 1; pageNum <= 50; pageNum++) {
    const listUrl = `https://tokyo.aromaesthe.co.jp/shop_list/${pageNum}/`;
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    const shopUrls = await page.evaluate(() => {
      return [...new Set([...document.querySelectorAll('a[href*="/shop/"]')]
        .map(a => a.href)
        .filter(href => href.match(/\/shop\/[a-z0-9_-]+\/?$/i)))];
    });

    if (shopUrls.length === 0) break;
    shopUrls.forEach(u => allShopUrls.add(u));
    console.log(`  ページ${pageNum}: ${shopUrls.length}件 (累計: ${allShopUrls.size}件)`);
    await delay();
  }

  const shops = [...allShopUrls].map(href => ({ href, name: '', area: '' }));
  console.log(`  店舗リンク数: ${shops.length}`);

  // Visit each shop to get details
  for (const shop of shops) {
    try {
      await delay();
      await page.goto(shop.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1000);

      const detail = await page.evaluate(() => {
        const titleEl = document.querySelector('h1, h2, title');
        let name = titleEl?.textContent?.trim() || '';
        // Clean up title - remove suffix like "｜東京アロマエステ案内所"
        name = name.split('｜')[0].split('|')[0].split('：')[0].trim();
        // Remove leading dash
        if (name.startsWith('-')) name = name.substring(1).trim();

        const bodyText = document.body.innerText;

        // Extract area from breadcrumb or text
        let area = '';
        const areaMatch = bodyText.match(/(新宿|池袋|渋谷|恵比寿|中目黒|五反田|品川|東京駅|銀座|新橋|神田|上野|吉祥寺|赤羽|王子|板橋|大塚|巣鴨|蒲田|六本木|赤坂|葛西|小岩|国分寺|立川|八王子|秋葉原|飯田橋|錦糸町|麻布|目黒)/);
        if (areaMatch) area = areaMatch[1];

        // Try to get area from the title or page structure
        const titleText = document.title || '';
        const titleAreaMatch = titleText.match(/(新宿|池袋|渋谷|恵比寿|中目黒|五反田|品川|銀座|新橋|神田|上野|吉祥寺|赤羽|王子|板橋|大塚|蒲田|六本木|赤坂|葛西|国分寺|立川|八王子|秋葉原|飯田橋|錦糸町|麻布|目黒)/);
        if (titleAreaMatch) area = titleAreaMatch[1];

        // Get therapist count
        const ladyLinks = [...new Set([...document.querySelectorAll('a[href*="/lady/"]')].map(a => a.href))];

        return { name, area, ladyCount: ladyLinks.length };
      });

      const shopName = detail.name || shop.name;
      if (!shopName) continue;

      const existing = stmts.findShopBySource.get(shop.href);
      if (existing) {
        stmts.updateShop.run(existing.id);
        console.log(`  更新: ${shopName} (${detail.area})`);
      } else {
        const areaId = resolveAreaId(db, detail.area || shop.area);
        stmts.insertShop.run({
          name: shopName,
          area_id: areaId,
          category: 'メンズエステ',
          description: `セラピスト${detail.ladyCount}名在籍`,
          source_url: shop.href,
        });
        newCount++;
        console.log(`  新規: ${shopName} (${detail.area}) - ${detail.ladyCount}名`);
      }
      shopCount++;
    } catch (e) {
      console.log(`  エラー: ${shop.href} - ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${shopCount}店舗 (新規: ${newCount})`);
  return shopCount;
}

// ─── 週刊エステ スクレイパー ─────────────────────────────
async function scrapeFuesShops(browser, db, stmts) {
  console.log('\n' + '='.repeat(60));
  console.log('週刊エステ - 店舗一覧取得');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en;q=0.9' });

  let shopCount = 0;
  let newCount = 0;

  // Area pages with their area names
  const AREAS = [
    { url: 'https://www.fues.jp/tokyoto/ikebukuro/', area: '池袋' },
    { url: 'https://www.fues.jp/tokyoto/okubo/', area: '高田馬場・新大久保' },
    { url: 'https://www.fues.jp/tokyoto/shinjuku/', area: '新宿' },
    { url: 'https://www.fues.jp/tokyoto/shibuya/', area: '渋谷・代々木' },
    { url: 'https://www.fues.jp/tokyoto/ebisu/', area: '恵比寿・中目黒' },
    { url: 'https://www.fues.jp/tokyoto/akasaka/', area: '麻布十番・赤坂・六本木' },
    { url: 'https://www.fues.jp/tokyoto/gotanda/', area: '五反田・品川' },
    { url: 'https://www.fues.jp/tokyoto/shinagawa/', area: '蒲田' },
    { url: 'https://www.fues.jp/tokyoto/shinbashi/', area: '新橋・東京・銀座' },
    { url: 'https://www.fues.jp/tokyoto/kayabacho/', area: '茅場町・人形町' },
    { url: 'https://www.fues.jp/tokyoto/suidoubashi/', area: '飯田橋・水道橋' },
    { url: 'https://www.fues.jp/tokyoto/kanda/', area: '神田・秋葉原' },
    { url: 'https://www.fues.jp/tokyoto/ueno/', area: '上野' },
    { url: 'https://www.fues.jp/tokyoto/nippori/', area: '日暮里・鶯谷' },
    { url: 'https://www.fues.jp/tokyoto/otsuka/', area: '大塚・巣鴨' },
    { url: 'https://www.fues.jp/tokyoto/kameari/', area: '北千住' },
    { url: 'https://www.fues.jp/tokyoto/kinshicho/', area: '錦糸町' },
    { url: 'https://www.fues.jp/tokyoto/kasai/', area: '葛西・西葛西' },
    { url: 'https://www.fues.jp/tokyoto/akabane/', area: '赤羽・板橋' },
    { url: 'https://www.fues.jp/tokyoto/nishitokyo/', area: '練馬' },
    { url: 'https://www.fues.jp/tokyoto/nakano/', area: '中野・荻窪・吉祥寺' },
    { url: 'https://www.fues.jp/tokyoto/hachioji/', area: '立川・八王子' },
    { url: 'https://www.fues.jp/tokyoto/jiyugaoka/', area: '東横・田園都市線' },
  ];

  for (const areaInfo of AREAS) {
    try {
      await delay();
      await page.goto(areaInfo.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1000);

      // Get unique store URLs from the area page
      const shopUrls = await page.evaluate(() => {
        const storeLinks = [...document.querySelectorAll('a[href*="/store/"]')];
        return [...new Set(storeLinks.map(a => a.href))];
      });

      const areaId = resolveAreaId(db, areaInfo.area);

      for (const sourceUrl of shopUrls) {
        const existing = stmts.findShopBySource.get(sourceUrl);
        if (existing) {
          stmts.updateShop.run(existing.id);
          shopCount++;
          continue;
        }

        // Visit shop page to get the real name from title
        try {
          await delay();
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(800);

          const shopName = await page.evaluate(() => {
            // Title format: "SHOP_NAME｜超割引クーポン｜エリア"
            const title = document.title || '';
            const name = title.split('｜')[0].split('|')[0].trim();
            return name;
          });

          if (!shopName || shopName.length > 80 || shopName.length < 2) continue;

          stmts.insertShop.run({
            name: shopName,
            area_id: areaId,
            category: 'メンズエステ',
            description: '',
            source_url: sourceUrl,
          });
          newCount++;
          console.log(`  新規: ${shopName} (${areaInfo.area})`);
          shopCount++;
        } catch (e) {
          console.log(`    詳細取得エラー: ${sourceUrl} - ${e.message}`);
        }
      }

      console.log(`  ${areaInfo.area}: ${shopUrls.length}店舗`);
    } catch (e) {
      console.log(`  エラー: ${areaInfo.area} - ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${shopCount}店舗 (新規: ${newCount})`);
  return shopCount;
}

// ─── セラピスト取得 (アロマエステ案内所) ─────────────────
async function scrapeAromaestheGirls(browser, db, stmts, resumeFrom = null) {
  console.log('\n' + '='.repeat(60));
  console.log('アロマエステ案内所 - セラピスト取得');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  const shops = stmts.getShops.all().filter(s => s.source_url.includes('aromaesthe.co.jp'));
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
      await page.goto(shop.source_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1500);

      // Get lady links
      const ladyLinks = await page.evaluate(() => {
        return [...new Set([...document.querySelectorAll('a[href*="/lady/"]')].map(a => a.href))]
          .filter(href => href.match(/\/lady\/[a-z0-9_]+\/?$/i));
      });

      console.log(`  [${i+1}/${shops.length}] ${shop.name}: ${ladyLinks.length}名`);

      // Save progress
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ source: 'aromaesthe', shop: shop.source_url, index: i }));

      for (const ladyUrl of ladyLinks) {
        try {
          await delay();
          await page.goto(ladyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(1000);

          const girlData = await page.evaluate((shopId) => {
            const bodyText = document.body.innerText;
            const titleText = document.title || '';

            // Extract name from title: "名前｜店舗名｜"
            let name = titleText.split('｜')[0].replace(/^-/, '').trim();
            // Also try from h1/h2
            const h = document.querySelector('h1, h2');
            if (h) {
              let hName = h.textContent.trim().replace(/^-/, '').split('｜')[0].trim();
              if (hName && hName.length < 20) name = hName;
            }

            // Parse profile line: "T162   B86(Dcup)  W56  H84"
            const profileMatch = bodyText.match(/T(\d{3})\s+B(\d{2,3})\(([A-K])cup\)\s+W(\d{2,3})\s+H(\d{2,3})/);
            let height = null, bust = null, waist = null, hip = null, cup = null;
            if (profileMatch) {
              height = parseInt(profileMatch[1]);
              bust = parseInt(profileMatch[2]);
              cup = profileMatch[3];
              waist = parseInt(profileMatch[4]);
              hip = parseInt(profileMatch[5]);
            }

            // Extract age: "名前(25)"
            const ageMatch = bodyText.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\((\\d{2})\\)'));
            let age = null;
            if (ageMatch) {
              age = parseInt(ageMatch[1]);
            } else {
              // Try generic pattern
              const genericAge = bodyText.match(/\((\d{2})\)/);
              if (genericAge) age = parseInt(genericAge[1]);
            }

            // Get main image
            const images = [...document.querySelectorAll('img')]
              .filter(img => img.src.includes('aromaesthe.co.jp/photo/lady/'))
              .map(img => img.src);
            const imageUrl = images[0] || null;

            // Source ID from URL
            const urlParts = window.location.pathname.match(/\/lady\/([^/]+)/);
            const sourceId = urlParts ? 'aromaesthe_' + urlParts[1] : null;

            return { name, age, height, bust, waist, hip, cup, imageUrl, sourceId };
          }, shop.id);

          if (!girlData.name || !girlData.sourceId) continue;

          const existing = stmts.findGirlBySource.get(girlData.sourceId);
          if (existing) {
            stmts.updateGirl.run({
              age: girlData.age,
              height: girlData.height,
              bust: girlData.bust,
              waist: girlData.waist,
              hip: girlData.hip,
              cup: girlData.cup,
              image_url: girlData.imageUrl,
              source_id: girlData.sourceId,
            });
          } else {
            stmts.insertGirl.run({
              name: girlData.name,
              shop_id: shop.id,
              age: girlData.age,
              height: girlData.height,
              bust: girlData.bust,
              waist: girlData.waist,
              hip: girlData.hip,
              cup: girlData.cup,
              image_url: girlData.imageUrl,
              source_id: girlData.sourceId,
            });
            newGirlCount++;
          }
          girlCount++;
        } catch (e) {
          console.log(`    エラー: ${ladyUrl} - ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`  エラー: ${shop.name} - ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${girlCount}名 (新規: ${newGirlCount})`);
}

// ─── セラピスト取得 (週刊エステ) ────────────────────────
async function scrapeFuesGirls(browser, db, stmts, resumeFrom = null) {
  console.log('\n' + '='.repeat(60));
  console.log('週刊エステ - セラピスト取得');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  const shops = stmts.getShops.all().filter(s => s.source_url.includes('fues.jp'));
  console.log(`  対象店舗: ${shops.length}`);

  let girlCount = 0;
  let newGirlCount = 0;
  let startIdx = 0;

  if (resumeFrom) {
    startIdx = shops.findIndex(s => s.source_url === resumeFrom);
    if (startIdx < 0) startIdx = 0;
  }

  for (let i = startIdx; i < shops.length; i++) {
    const shop = shops[i];
    try {
      // Visit therapist list page
      const photoUrl = shop.source_url.replace(/\/?$/, '/photo.html');
      await delay();
      await page.goto(photoUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1500);

      // Parse therapist data from the list page directly
      const girls = await page.evaluate((shopId) => {
        const bodyText = document.body.innerText;
        const results = [];

        // Look for image elements with therapist photos
        const imgs = [...document.querySelectorAll('img[src*="upload"]')];

        // Also look for text blocks with therapist info
        // Pattern: "名前(年齢)\n T000 B00(Xcup) W00 H00" or similar
        const blocks = bodyText.split(/\n\n+/);
        for (const block of blocks) {
          const nameAge = block.match(/^([^\n(]+)\((\d{2})\)/m);
          if (!nameAge) continue;
          const name = nameAge[1].trim();
          const age = parseInt(nameAge[2]);
          if (name.length > 20 || name.length < 1) continue;

          const profile = block.match(/T(\d{3})\s+B(\d{2,3})\(([A-K])cup\)\s+W(\d{2,3})\s+H(\d{2,3})/);
          let height = null, bust = null, waist = null, hip = null, cup = null;
          if (profile) {
            height = parseInt(profile[1]);
            bust = parseInt(profile[2]);
            cup = profile[3];
            waist = parseInt(profile[4]);
            hip = parseInt(profile[5]);
          }

          // Alternative profile patterns
          if (!profile) {
            const altProfile = block.match(/(\d{3})cm\s+(\d{2,3})\(([A-K])\)\s+(\d{2,3})\s+(\d{2,3})/);
            if (altProfile) {
              height = parseInt(altProfile[1]);
              bust = parseInt(altProfile[2]);
              cup = altProfile[3];
              waist = parseInt(altProfile[4]);
              hip = parseInt(altProfile[5]);
            }
          }

          results.push({ name, age, height, bust, waist, hip, cup });
        }

        return results;
      }, shop.id);

      // Also try to get images by visiting individual therapist links
      const therapistImages = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')];
        const imageMap = {};
        for (const img of imgs) {
          if (img.src.includes('upload') && !img.src.includes('logo') && !img.src.includes('icon') && !img.src.includes('banner')) {
            const parent = img.closest('a, div, li');
            if (parent) {
              const nameEl = parent.querySelector('.name, strong, b') || parent;
              const name = nameEl.textContent.trim().split('\n')[0].replace(/\(\d+\)/, '').trim();
              if (name && name.length < 20) {
                imageMap[name] = img.src;
              }
            }
          }
        }
        return imageMap;
      });

      console.log(`  [${i+1}/${shops.length}] ${shop.name}: ${girls.length}名`);

      // Save progress
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ source: 'fues', shop: shop.source_url, index: i }));

      for (const girl of girls) {
        const sourceId = `fues_${shop.id}_${girl.name}`;
        const imageUrl = therapistImages[girl.name] || null;

        const existing = stmts.findGirlBySource.get(sourceId);
        if (existing) {
          stmts.updateGirl.run({
            age: girl.age,
            height: girl.height,
            bust: girl.bust,
            waist: girl.waist,
            hip: girl.hip,
            cup: girl.cup,
            image_url: imageUrl,
            source_id: sourceId,
          });
        } else {
          stmts.insertGirl.run({
            name: girl.name,
            shop_id: shop.id,
            age: girl.age,
            height: girl.height,
            bust: girl.bust,
            waist: girl.waist,
            hip: girl.hip,
            cup: girl.cup,
            image_url: imageUrl,
            source_id: sourceId,
          });
          newGirlCount++;
        }
        girlCount++;
      }
    } catch (e) {
      console.log(`  エラー: ${shop.name} - ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${girlCount}名 (新規: ${newGirlCount})`);
}

// ─── メイン ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const resume = args.includes('--resume');

  const { db, stmts } = prepareDb();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    if (command === 'shops' || command === 'all') {
      await scrapeAromaestheShops(browser, db, stmts);
      await scrapeFuesShops(browser, db, stmts);
    }

    if (command === 'girls' || command === 'all') {
      let resumeFrom = null;
      if (resume && fs.existsSync(PROGRESS_PATH)) {
        const progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
        resumeFrom = progress.shop;
        console.log(`  再開: ${resumeFrom}`);
      }
      await scrapeAromaestheGirls(browser, db, stmts, resumeFrom);
      await scrapeFuesGirls(browser, db, stmts, resumeFrom);
    }

    // Summary
    const menesuShops = db.prepare("SELECT COUNT(*) as cnt FROM shops WHERE category = 'メンズエステ'").get();
    const menesuGirls = db.prepare(`
      SELECT COUNT(*) as cnt FROM girls g
      JOIN shops s ON g.shop_id = s.id
      WHERE s.category = 'メンズエステ'
    `).get();
    console.log('\n' + '='.repeat(60));
    console.log('サマリー');
    console.log('='.repeat(60));
    console.log(`  メンエス店舗数: ${menesuShops.cnt}`);
    console.log(`  メンエスセラピスト数: ${menesuGirls.cnt}`);

  } finally {
    await browser.close();
    db.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
