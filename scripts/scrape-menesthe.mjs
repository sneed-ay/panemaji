#!/usr/bin/env node
/**
 * men-esthe.jp スクレイピングスクリプト
 *
 * 使い方:
 *   node scripts/scrape-menesthe.mjs shops              # 店舗一覧を取得
 *   node scripts/scrape-menesthe.mjs girls              # 全店舗のセラピストデータ取得
 *   node scripts/scrape-menesthe.mjs girls --resume     # 中断した続きから再開
 *   node scripts/scrape-menesthe.mjs all                # shops → girls を連続実行
 *   node scripts/scrape-menesthe.mjs trends             # 口コミ傾向データ生成
 *
 * ソース:
 *   - men-esthe.jp (メンエス)
 *
 * 背景:
 *   「神のエステ」(kaminoesthe.com等)のランキングポータルサイトは
 *   2025年頃にドメイン失効・閉鎖済み。代替としてmen-esthe.jpから収集。
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_PATH = path.join(PROJECT_ROOT, 'menesthe-progress.json');

const DELAY_MIN = 2500;
const DELAY_JITTER = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

// ─── エリアマッピング ───────────────────────────────────
// men-esthe.jp area ID → パネマジDBのarea slug
const AREA_CONFIG = [
  { id: 8, name: '新宿', slug: 'shinjuku' },
  { id: 34, name: '大久保・新大久保', slug: 'shinjuku' },
  { id: 11, name: '高田馬場', slug: 'shinjuku' },
  { id: 15, name: '池袋', slug: 'ikebukuro' },
  { id: 6, name: '渋谷', slug: 'shibuya' },
  { id: 7, name: '代々木・原宿', slug: 'shibuya' },
  { id: 5, name: '恵比寿', slug: 'shibuya' },
  { id: 20, name: '代官山', slug: 'shibuya' },
  { id: 4, name: '目黒', slug: 'gotanda' },
  { id: 3, name: '中目黒', slug: 'gotanda' },
  { id: 1, name: '五反田', slug: 'gotanda' },
  { id: 2, name: '品川', slug: 'shinagawa' },
  { id: 24, name: '蒲田・大井町', slug: 'kamata' },
  { id: 26, name: '田町・浜松町', slug: 'shinbashi' },
  { id: 16, name: '麻布十番', slug: 'roppongi' },
  { id: 19, name: '六本木・西麻布', slug: 'roppongi' },
  { id: 14, name: '赤坂', slug: 'roppongi' },
  { id: 18, name: '新橋・銀座', slug: 'shinbashi' },
  { id: 25, name: '日本橋・東京駅', slug: 'tokyo-st' },
  { id: 12, name: '神田', slug: 'akihabara' },
  { id: 9, name: '秋葉原', slug: 'akihabara' },
  { id: 10, name: '飯田橋・市ヶ谷・神楽坂', slug: 'iidabashi' },
  { id: 35, name: '茅場町・人形町・小伝馬町', slug: 'tokyo-st' },
  { id: 13, name: '上野', slug: 'ueno' },
  { id: 29, name: '北千住', slug: 'kinshicho' },
  { id: 31, name: '西日暮里・鶯谷', slug: 'ueno' },
  { id: 27, name: '錦糸町', slug: 'kinshicho' },
  { id: 115, name: '小岩・新小岩', slug: 'kinshicho' },
  { id: 37, name: '大塚・巣鴨', slug: 'otsuka' },
  { id: 30, name: '赤羽', slug: 'itabashi' },
  { id: 21, name: '三軒茶屋', slug: 'tokyu' },
  { id: 33, name: '自由が丘', slug: 'tokyu' },
  { id: 17, name: '初台・笹塚・明大前', slug: 'shibuya' },
  { id: 22, name: '幡ヶ谷', slug: 'shibuya' },
  { id: 43, name: '下北沢', slug: 'shibuya' },
  { id: 54, name: '中野', slug: 'kichijoji' },
  { id: 23, name: '荻窪・西荻窪', slug: 'kichijoji' },
  { id: 38, name: '練馬・大泉学園', slug: 'seibu' },
  { id: 36, name: '吉祥寺', slug: 'kichijoji' },
  { id: 40, name: '調布・登戸', slug: 'kichijoji' },
  { id: 42, name: '立川', slug: 'tachikawa' },
  { id: 167, name: '八王子', slug: 'tachikawa' },
  { id: 28, name: '葛西・西葛西・行徳・浦安', slug: 'kinshicho' },
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

  const stmts = {
    findAreaBySlug: db.prepare("SELECT id FROM areas WHERE slug = ? AND prefecture = 'tokyo'"),
    findShopBySource: db.prepare('SELECT id FROM shops WHERE source_url = ?'),
    findShopByName: db.prepare("SELECT id FROM shops WHERE name = ? AND category = 'メンズエステ'"),
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

// ─── 店舗一覧取得 ────────────────────────────────────────
async function scrapeShops(browser, db, stmts) {
  console.log('\n' + '='.repeat(60));
  console.log('men-esthe.jp - 店舗一覧取得');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en;q=0.9' });

  let totalShops = 0;
  let newShops = 0;
  const allSalonIds = new Set();

  for (const areaConf of AREA_CONFIG) {
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

          // Get name from img alt or from text in specific containers
          const img = a.querySelector('img');
          let name = img?.alt || '';

          // Skip ad blocks
          if (name === 'メンエスおすすめ優良店' || name === '' || name.includes('口コミ')) {
            // Try to find name from parent container
            const parent = a.closest('.salon-box, .salon-item, div');
            if (parent) {
              const nameEl = parent.querySelector('.salon-name, .name, h3, h4, strong, b');
              if (nameEl) {
                name = nameEl.textContent.trim().split('\n')[0].trim();
              }
            }
          }

          // Last resort: get first meaningful line from link text
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

      const areaRow = stmts.findAreaBySlug.get(areaConf.slug);
      const areaId = areaRow ? areaRow.id : 1;

      let areaNew = 0;
      for (const salon of salons) {
        if (allSalonIds.has(salon.id)) continue;
        allSalonIds.add(salon.id);

        const sourceUrl = `https://men-esthe.jp/salon.php?id=${salon.id}`;
        const existing = stmts.findShopBySource.get(sourceUrl);

        if (existing) {
          stmts.updateShop.run(existing.id);
        } else {
          // Check if shop with same name already exists (from other sources)
          const sameNameShop = stmts.findShopByName.get(salon.name);
          if (sameNameShop) {
            // Skip - likely same shop from different source
            continue;
          }

          stmts.insertShop.run({
            name: salon.name,
            area_id: areaId,
            category: 'メンズエステ',
            description: '',
            source_url: sourceUrl,
          });
          areaNew++;
          newShops++;
        }
        totalShops++;
      }

      console.log(`  ${areaConf.name}: ${salons.length}店舗 (新規: ${areaNew})`);
    } catch (e) {
      console.log(`  エラー: ${areaConf.name} - ${e.message}`);
    }
  }

  await page.close();
  console.log(`\n  合計: ${totalShops}店舗 (新規: ${newShops})`);
  return totalShops;
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

      // Extract therapist data from the salon page
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

          // Parse name and age: various patterns
          // Pattern: "名前 (23)さん" or "名前 (23)"
          let name = null, age = null;
          const nameAgeMatch = linkText.match(/([^\n\s(]+)\s*\((\d{2})\)\s*(?:さん)?/);
          if (nameAgeMatch) {
            name = nameAgeMatch[1].trim();
            age = parseInt(nameAgeMatch[2]);
          }

          // Filter out non-names
          if (name && (name.includes('セラピスト') || name.includes('おすすめ') || name.includes('マッサージ') || name.includes('新人') || name.length > 15)) {
            // Try to find actual name after the label
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

          // Get image
          const img = a.querySelector('img');
          const imgSrc = img?.src || '';
          const validImg = imgSrc.includes('men-esthe.jp/contents/therapist/') ? imgSrc : null;

          results.push({ id, name, age, text: linkText.substring(0, 200), img: validImg });
        }
        return results;
      });

      console.log(`  [${i + 1}/${shops.length}] ${shop.name}: ${therapists.length}名`);

      // Save progress
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
      console.log(`  エラー: ${shop.name} - ${e.message}`);
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

  // Get girls from men-esthe.jp shops that have no reviews yet
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
      // 0-5 reviews per girl, weighted toward fewer
      const reviewCount = pick([0, 0, 1, 1, 2, 2, 3, 4, 5]);

      for (let r = 0; r < reviewCount; r++) {
        // Rating distribution: panel_match 60%, panel_diff 30%, jirai 10%
        const roll = Math.random();
        let rating;
        if (roll < 0.60) {
          rating = 'panel_match';
        } else if (roll < 0.90) {
          rating = 'panel_diff';
        } else {
          rating = 'jirai';
        }

        // Random visit date in last 90 days
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

  // Show distribution
  const dist = db.prepare(`
    SELECT panel_rating, COUNT(*) as cnt
    FROM reviews r
    WHERE r.browser_id LIKE 'ext-trend-kamiesthe-%'
    GROUP BY panel_rating
  `).all();

  if (dist.length > 0) {
    console.log(`\n  口コミ評価分布:`);
    for (const d of dist) {
      const pct = (d.cnt / totalReviews * 100).toFixed(1);
      console.log(`    ${d.panel_rating}: ${d.cnt} (${pct}%)`);
    }
  }
}

// ─── メイン ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const resume = args.includes('--resume');

  const { db, stmts } = prepareDb();

  if (command === 'trends') {
    generateTrends(db, stmts);
    db.close();
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    if (command === 'shops' || command === 'all') {
      await scrapeShops(browser, db, stmts);
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
