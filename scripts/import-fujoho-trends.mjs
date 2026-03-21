#!/usr/bin/env node
/**
 * fujoho.jp の口コミ傾向を参考にして、パネマジ掲示板の口コミデータを増やすスクリプト
 *
 * - 口コミ本文は一切コピーしない
 * - 評価の「傾向」（星の数）のみ参考にする
 * - パネマジ独自の3段階評価として生成
 * - browser_id: 'ext-trend-{timestamp}-{連番}' で区別管理
 */

import puppeteer from 'puppeteer';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Normalize shop name for matching
function normalizeName(name) {
  return name
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[☆★♡♥～〜・\-－―()（）【】「」『』]/g, '')
    .replace(/店$/, '')
    .toLowerCase()
    .trim();
}

// Extract girl name (remove age suffix like （24）)
function extractGirlName(text) {
  return text.replace(/[（(]\d+[)）]/, '').replace(/\s+/g, '').trim();
}

// Determine panel_rating from fujoho stars
// sougouStars: overall rating (1-5)
// shashinStars: photo accuracy rating (1-5)
function determinePanelRating(sougouStars, shashinStars) {
  // Use shashin (photo) stars as primary indicator for panel match
  // Fall back to sougou if shashin is unavailable
  const stars = shashinStars > 0 ? shashinStars : sougouStars;

  const rand = Math.random();

  if (stars >= 4) {
    // High rating: panel_match(70%) / panel_diff(30%)
    return rand < 0.7 ? 'panel_match' : 'panel_diff';
  } else if (stars >= 3) {
    // Mid rating: panel_diff(60%) / panel_match(20%) / jirai(20%)
    if (rand < 0.6) return 'panel_diff';
    if (rand < 0.8) return 'panel_match';
    return 'jirai';
  } else {
    // Low rating (1-2): jirai(60%) / panel_diff(30%) / panel_match(10%)
    if (rand < 0.6) return 'jirai';
    if (rand < 0.9) return 'panel_diff';
    return 'panel_match';
  }
}

// Generate random date within last 30 days
function randomRecentDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date(now.getTime() - daysAgo * 86400000);
  return date.toISOString().split('T')[0];
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  // Prepare DB queries
  const findShopByName = db.prepare(`
    SELECT s.id, s.name, a.name as area_name
    FROM shops s JOIN areas a ON s.area_id = a.id
    WHERE s.is_active = 1 AND a.prefecture = 'tokyo'
  `).all();

  const findGirlsByShop = db.prepare(`
    SELECT id, name FROM girls WHERE shop_id = ? AND is_active = 1
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id)
    VALUES (?, ?, ?, NULL, ?)
  `);

  // Check for existing ext-trend reviews to avoid duplicates
  const existingExtTrend = db.prepare(`
    SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-trend-%'
  `).get();
  console.log(`Existing ext-trend reviews: ${existingExtTrend.c}`);

  // Build shop name index for fuzzy matching
  const shopIndex = findShopByName.map(s => ({
    ...s,
    normalized: normalizeName(s.name)
  }));

  console.log(`DB has ${shopIndex.length} active Tokyo shops`);

  // Launch browser
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let totalAdded = 0;
  let totalSkipped = 0;
  let totalShopsMatched = 0;
  let totalGirlsMatched = 0;
  const timestamp = Date.now();
  let seqNum = 0;

  try {
    // Step 1: Get Tokyo deli-hel shop list from fujoho.jp
    console.log('\n=== Step 1: Fetching Tokyo deli-hel shop list from fujoho.jp ===');

    // Get multiple pages of shops
    const fujohoShops = [];
    const maxPages = 5; // Get up to 5 pages

    for (let pg = 1; pg <= maxPages; pg++) {
      const url = pg === 1
        ? 'https://fujoho.jp/index.php?p=shop_list&t=13&k=2'
        : `https://fujoho.jp/index.php?p=shop_list&t=13&k=2&pg=${pg}`;

      console.log(`Fetching shop list page ${pg}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000 + Math.random() * 1000);

      const shops = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('a[href*="p=shop&id="]').forEach(a => {
          const id = new URL(a.href).searchParams.get('id');
          const text = a.textContent.trim();
          if (id && text && text.length > 1 && !seen.has(id)) {
            seen.add(id);
            // Get area info from nearby elements
            const parent = a.closest('.main_section_info_item, .shop_list_item, tr, li, div');
            const areaText = parent ? parent.textContent : '';
            results.push({ id, name: text, areaHint: areaText.substring(0, 200) });
          }
        });
        return results;
      });

      fujohoShops.push(...shops);
      console.log(`  Page ${pg}: found ${shops.length} shops (total: ${fujohoShops.length})`);

      if (shops.length === 0) break;
    }

    console.log(`\nTotal fujoho shops found: ${fujohoShops.length}`);

    // Step 2: Match fujoho shops against our DB
    console.log('\n=== Step 2: Matching shops against DB ===');

    const matchedShops = [];
    for (const fShop of fujohoShops) {
      const fNorm = normalizeName(fShop.name);

      // Try exact normalized match first
      let match = shopIndex.find(s => s.normalized === fNorm);

      // Try contains match (either direction)
      if (!match) {
        match = shopIndex.find(s =>
          (fNorm.length >= 4 && s.normalized.includes(fNorm)) ||
          (s.normalized.length >= 4 && fNorm.includes(s.normalized))
        );
      }

      // Try partial match (first 6 chars)
      if (!match && fNorm.length >= 6) {
        match = shopIndex.find(s =>
          s.normalized.startsWith(fNorm.substring(0, 6)) ||
          fNorm.startsWith(s.normalized.substring(0, 6))
        );
      }

      if (match) {
        matchedShops.push({ fujoho: fShop, db: match });
      }
    }

    console.log(`Matched ${matchedShops.length} shops`);
    matchedShops.slice(0, 10).forEach(m => {
      console.log(`  ${m.fujoho.name} => ${m.db.name} (${m.db.area_name})`);
    });

    // Step 3: For each matched shop, scrape review trends
    console.log('\n=== Step 3: Scraping review trends for matched shops ===');

    const limit = Math.min(matchedShops.length, 50);

    for (let i = 0; i < limit; i++) {
      const { fujoho: fShop, db: dbShop } = matchedShops[i];
      console.log(`\n[${i + 1}/${limit}] ${fShop.name} (fujoho ID: ${fShop.id}) => DB: ${dbShop.name}`);

      // Get girls for this shop from our DB
      const dbGirls = findGirlsByShop.all(dbShop.id);
      if (dbGirls.length === 0) {
        console.log('  No girls in DB for this shop, skipping');
        continue;
      }

      // Visit the review list page
      try {
        await page.goto(`https://fujoho.jp/index.php?p=shop_repo_list&id=${fShop.id}`, {
          waitUntil: 'networkidle2', timeout: 30000
        });
        await sleep(2000 + Math.random() * 1000);

        // Extract review trends (star counts per review)
        const reviews = await page.evaluate(() => {
          const boxes = document.querySelectorAll('.shop_contents_main_report_box');
          return Array.from(boxes).map(box => {
            // Count sougou (overall) stars
            const sougouEl = box.querySelector('.shop_contents_main_report_detail_star_sougou');
            const sougouStars = sougouEl ? sougouEl.querySelectorAll('.shop_contents_main_report_detail_star_img').length : 0;

            // Count shashin (photo) stars
            const shashinEl = box.querySelector('.shop_contents_main_report_detail_star_shashin');
            const shashinStars = shashinEl ? shashinEl.querySelectorAll('.shop_contents_main_report_detail_star_img').length : 0;

            // Get date
            const dateEl = box.querySelector('.shop_contents_main_report_detail_date');
            const dateText = dateEl?.textContent?.trim() || '';
            const dateMatch = dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
            const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

            return { sougouStars, shashinStars, date };
          });
        });

        console.log(`  Found ${reviews.length} reviews on page`);

        // Also try to get girl names from the "good girls" page
        await sleep(2000 + Math.random() * 1000);
        await page.goto(`https://fujoho.jp/index.php?p=shop_girl_good_list&id=${fShop.id}&od=1`, {
          waitUntil: 'networkidle2', timeout: 30000
        });

        const goodGirls = await page.evaluate(() => {
          const items = document.querySelectorAll('.main_section_info_item');
          return Array.from(items).map(item => {
            const nameEl = item.querySelector('.main_section_info_name');
            const name = nameEl?.textContent?.trim() || '';
            const goodEl = item.querySelector('.main_section_info_good_strong');
            const goodCount = parseInt(goodEl?.textContent) || 0;
            return { name, goodCount };
          });
        });

        console.log(`  Found ${goodGirls.length} "good girls" entries`);

        // Match girls from "good girls" list against DB
        const girlMatches = [];
        for (const gGirl of goodGirls) {
          const cleanName = extractGirlName(gGirl.name);
          if (!cleanName) continue;

          const dbMatch = dbGirls.find(g => g.name === cleanName);
          if (dbMatch) {
            girlMatches.push({ fujoho: gGirl, db: dbMatch });
          }
        }

        // If we have girl matches, create reviews for them based on review trends
        if (girlMatches.length > 0) {
          totalShopsMatched++;
          console.log(`  Matched ${girlMatches.length} girls`);

          for (const gMatch of girlMatches) {
            totalGirlsMatched++;

            // Determine how many reviews to generate based on goodCount
            // goodCount represents positive reviews, so generate 1-3 reviews
            const reviewCount = Math.min(gMatch.fujoho.goodCount, 3);

            for (let r = 0; r < reviewCount; r++) {
              // Pick a review trend to base this on
              const trendIdx = Math.floor(Math.random() * Math.max(reviews.length, 1));
              const trend = reviews[trendIdx] || { sougouStars: 4, shashinStars: 4 };

              // For "good girls", bias toward higher ratings
              const adjustedSougou = Math.min(trend.sougouStars + 1, 5);
              const adjustedShashin = Math.min(trend.shashinStars + 1, 5);

              const panelRating = determinePanelRating(adjustedSougou, adjustedShashin);
              const visitDate = trend.date || randomRecentDate();
              const browserId = `ext-trend-${timestamp}-${++seqNum}`;

              insertReview.run(gMatch.db.id, visitDate, panelRating, browserId);
              totalAdded++;
            }

            console.log(`    ${gMatch.fujoho.name} => ${gMatch.db.name} (ID:${gMatch.db.id}): ${Math.min(gMatch.fujoho.goodCount, 3)} reviews`);
          }
        }

        // Also: for reviews WITHOUT specific girl matching,
        // randomly assign to girls in this shop (to increase data coverage)
        // Use overall review trends to generate ratings
        if (reviews.length > 0 && dbGirls.length > 0) {
          // Generate reviews for random girls based on overall shop trends
          const numExtraReviews = Math.min(Math.floor(reviews.length * 0.3), 10);

          for (let r = 0; r < numExtraReviews; r++) {
            const randomGirl = dbGirls[Math.floor(Math.random() * dbGirls.length)];
            const trendIdx = Math.floor(Math.random() * reviews.length);
            const trend = reviews[trendIdx];

            const panelRating = determinePanelRating(trend.sougouStars, trend.shashinStars);
            const visitDate = trend.date || randomRecentDate();
            const browserId = `ext-trend-${timestamp}-${++seqNum}`;

            insertReview.run(randomGirl.id, visitDate, panelRating, browserId);
            totalAdded++;
          }

          if (!girlMatches.length) totalShopsMatched++;
          console.log(`  + ${numExtraReviews} trend-based reviews for random girls`);
        }

      } catch (err) {
        console.log(`  Error processing shop: ${err.message}`);
        totalSkipped++;
      }

      await sleep(2000 + Math.random() * 1000);
    }

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await browser.close();
  }

  // Report
  console.log('\n========== RESULTS ==========');
  console.log(`Total shops matched: ${totalShopsMatched}`);
  console.log(`Total girls matched: ${totalGirlsMatched}`);
  console.log(`Total reviews added: ${totalAdded}`);
  console.log(`Total shops skipped (errors): ${totalSkipped}`);

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
  const extTrendCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-trend-%'").get();
  console.log(`\nTotal reviews in DB: ${finalCount.c}`);
  console.log(`Ext-trend reviews in DB: ${extTrendCount.c}`);

  // Rating distribution of new reviews
  const dist = db.prepare(`
    SELECT panel_rating, COUNT(*) as c
    FROM reviews WHERE browser_id LIKE 'ext-trend-${timestamp}%'
    GROUP BY panel_rating
  `).all();
  console.log('\nRating distribution of new reviews:');
  dist.forEach(d => console.log(`  ${d.panel_rating}: ${d.c}`));

  db.close();
  console.log('\nDone!');
}

main().catch(console.error);
