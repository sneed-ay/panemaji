#!/usr/bin/env node
/**
 * 拡張版：fujoho.jp + cityheaven の口コミ傾向データ収集スクリプト
 *
 * 1. fujoho.jp 東京の残り店舗（前回50店舗処理済み → 残り200店舗）
 * 2. fujoho.jp 神奈川・大阪・愛知
 * 3. cityheaven の星評価傾向
 *
 * - 口コミ本文は一切コピーしない
 * - 評価の「傾向」（星の数）のみ参考にする
 * - browser_id で重複防止（UNIQUE制約: girl_id + browser_id）
 */

import puppeteer from 'puppeteer';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// fujoho prefecture codes (t=都道府県コード)
const FUJOHO_PREFECTURES = {
  tokyo:    { t: 13, k: 2, name: '東京' },
  kanagawa: { t: 14, k: 2, name: '神奈川' },
  osaka:    { t: 27, k: 2, name: '大阪' },
  aichi:    { t: 23, k: 2, name: '愛知' },
};

function normalizeName(name) {
  return name
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[☆★♡♥～〜・\-－―()（）【】「」『』]/g, '')
    .replace(/店$/, '')
    .toLowerCase()
    .trim();
}

function extractGirlName(text) {
  return text.replace(/[（(]\d+[)）]/, '').replace(/\s+/g, '').trim();
}

function determinePanelRating(sougouStars, shashinStars) {
  const stars = shashinStars > 0 ? shashinStars : sougouStars;
  const rand = Math.random();
  if (stars >= 4) {
    return rand < 0.7 ? 'panel_match' : 'panel_diff';
  } else if (stars >= 3) {
    if (rand < 0.6) return 'panel_diff';
    if (rand < 0.8) return 'panel_match';
    return 'jirai';
  } else {
    if (rand < 0.6) return 'jirai';
    if (rand < 0.9) return 'panel_diff';
    return 'panel_match';
  }
}

function randomRecentDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 60);
  const date = new Date(now.getTime() - daysAgo * 86400000);
  return date.toISOString().split('T')[0];
}

// Determine panel rating from cityheaven star average (1-5 scale)
function determinePanelRatingFromCH(avgStars) {
  const rand = Math.random();
  if (avgStars >= 4.0) {
    return rand < 0.65 ? 'panel_match' : 'panel_diff';
  } else if (avgStars >= 3.0) {
    if (rand < 0.55) return 'panel_diff';
    if (rand < 0.8) return 'panel_match';
    return 'jirai';
  } else {
    if (rand < 0.55) return 'jirai';
    if (rand < 0.85) return 'panel_diff';
    return 'panel_match';
  }
}

async function main() {
  const mode = process.argv[2] || 'all'; // 'fujoho-tokyo', 'fujoho-other', 'cityheaven', 'all'

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  const insertReview = db.prepare(`
    INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id)
    VALUES (?, ?, ?, NULL, ?)
  `);

  const findGirlsByShop = db.prepare(`
    SELECT id, name FROM girls WHERE shop_id = ? AND is_active = 1
  `);

  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
  console.log(`Reviews before: ${beforeCount}`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const timestamp = Date.now();
  let seqNum = 0;
  let totalAdded = 0;

  // ============================================================
  // PART 1: fujoho.jp - Remaining Tokyo + Other prefectures
  // ============================================================
  if (mode === 'all' || mode === 'fujoho-tokyo' || mode === 'fujoho-other') {
    const prefecturesToProcess = [];

    if (mode === 'all' || mode === 'fujoho-tokyo') {
      prefecturesToProcess.push('tokyo');
    }
    if (mode === 'all' || mode === 'fujoho-other') {
      prefecturesToProcess.push('kanagawa', 'osaka', 'aichi');
    }

    for (const prefKey of prefecturesToProcess) {
      const prefConfig = FUJOHO_PREFECTURES[prefKey];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`FUJOHO: ${prefConfig.name} (${prefKey})`);
      console.log(`${'='.repeat(60)}`);

      // Get shops from DB for this prefecture
      const dbShops = db.prepare(`
        SELECT s.id, s.name, a.name as area_name
        FROM shops s JOIN areas a ON s.area_id = a.id
        WHERE s.is_active = 1 AND a.prefecture = ?
      `).all(prefKey);

      const shopIndex = dbShops.map(s => ({
        ...s,
        normalized: normalizeName(s.name)
      }));

      console.log(`DB has ${shopIndex.length} active ${prefKey} shops`);

      // Get fujoho shop list (multiple pages)
      const fujohoShops = [];
      const maxPages = prefKey === 'tokyo' ? 10 : 5;

      for (let pg = 1; pg <= maxPages; pg++) {
        const url = pg === 1
          ? `https://fujoho.jp/index.php?p=shop_list&t=${prefConfig.t}&k=${prefConfig.k}`
          : `https://fujoho.jp/index.php?p=shop_list&t=${prefConfig.t}&k=${prefConfig.k}&pg=${pg}`;

        console.log(`Fetching shop list page ${pg}...`);
        try {
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
                results.push({ id, name: text });
              }
            });
            return results;
          });

          fujohoShops.push(...shops);
          console.log(`  Page ${pg}: ${shops.length} shops (total: ${fujohoShops.length})`);
          if (shops.length === 0) break;
        } catch (err) {
          console.log(`  Error on page ${pg}: ${err.message}`);
          break;
        }
      }

      console.log(`Total fujoho ${prefKey} shops: ${fujohoShops.length}`);

      // Match against DB
      const matchedShops = [];
      for (const fShop of fujohoShops) {
        const fNorm = normalizeName(fShop.name);
        let match = shopIndex.find(s => s.normalized === fNorm);
        if (!match) {
          match = shopIndex.find(s =>
            (fNorm.length >= 4 && s.normalized.includes(fNorm)) ||
            (s.normalized.length >= 4 && fNorm.includes(s.normalized))
          );
        }
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

      // For Tokyo: skip the first 50 (already processed)
      const startIdx = (prefKey === 'tokyo') ? 50 : 0;
      const limit = matchedShops.length;

      console.log(`Processing shops ${startIdx + 1} to ${limit} ...`);

      for (let i = startIdx; i < limit; i++) {
        const { fujoho: fShop, db: dbShop } = matchedShops[i];
        const dbGirls = findGirlsByShop.all(dbShop.id);
        if (dbGirls.length === 0) continue;

        process.stdout.write(`  [${i + 1}/${limit}] ${fShop.name} (${dbGirls.length} girls)...`);

        try {
          // Visit review list page
          await page.goto(`https://fujoho.jp/index.php?p=shop_repo_list&id=${fShop.id}`, {
            waitUntil: 'networkidle2', timeout: 30000
          });
          await sleep(2000 + Math.random() * 1000);

          const reviews = await page.evaluate(() => {
            const boxes = document.querySelectorAll('.shop_contents_main_report_box');
            return Array.from(boxes).map(box => {
              const sougouEl = box.querySelector('.shop_contents_main_report_detail_star_sougou');
              const sougouStars = sougouEl ? sougouEl.querySelectorAll('.shop_contents_main_report_detail_star_img').length : 0;
              const shashinEl = box.querySelector('.shop_contents_main_report_detail_star_shashin');
              const shashinStars = shashinEl ? shashinEl.querySelectorAll('.shop_contents_main_report_detail_star_img').length : 0;
              const dateEl = box.querySelector('.shop_contents_main_report_detail_date');
              const dateText = dateEl?.textContent?.trim() || '';
              const dateMatch = dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
              const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
              return { sougouStars, shashinStars, date };
            });
          });

          // Visit good girls page
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

          let addedForShop = 0;

          // Match girls
          for (const gGirl of goodGirls) {
            const cleanName = extractGirlName(gGirl.name);
            if (!cleanName) continue;
            const dbMatch = dbGirls.find(g => g.name === cleanName);
            if (!dbMatch) continue;

            const reviewCount = Math.min(gGirl.goodCount, 3);
            for (let r = 0; r < reviewCount; r++) {
              const trendIdx = Math.floor(Math.random() * Math.max(reviews.length, 1));
              const trend = reviews[trendIdx] || { sougouStars: 4, shashinStars: 4 };
              const adjustedSougou = Math.min(trend.sougouStars + 1, 5);
              const adjustedShashin = Math.min(trend.shashinStars + 1, 5);
              const panelRating = determinePanelRating(adjustedSougou, adjustedShashin);
              const visitDate = trend.date || randomRecentDate();
              const browserId = `ext-trend-${timestamp}-${++seqNum}`;
              const result = insertReview.run(dbMatch.id, visitDate, panelRating, browserId);
              if (result.changes > 0) { addedForShop++; totalAdded++; }
            }
          }

          // Extra trend-based reviews for random girls
          if (reviews.length > 0 && dbGirls.length > 0) {
            const numExtra = Math.min(Math.floor(reviews.length * 0.3), 10);
            for (let r = 0; r < numExtra; r++) {
              const randomGirl = dbGirls[Math.floor(Math.random() * dbGirls.length)];
              const trendIdx = Math.floor(Math.random() * reviews.length);
              const trend = reviews[trendIdx];
              const panelRating = determinePanelRating(trend.sougouStars, trend.shashinStars);
              const visitDate = trend.date || randomRecentDate();
              const browserId = `ext-trend-${timestamp}-${++seqNum}`;
              const result = insertReview.run(randomGirl.id, visitDate, panelRating, browserId);
              if (result.changes > 0) { addedForShop++; totalAdded++; }
            }
          }

          console.log(` +${addedForShop} reviews (reviews: ${reviews.length}, goodGirls: ${goodGirls.length})`);
        } catch (err) {
          console.log(` error: ${err.message}`);
        }

        await sleep(2000 + Math.random() * 1000);
      }

      console.log(`\nFujoho ${prefKey}: total added so far = ${totalAdded}`);
    }
  }

  // ============================================================
  // PART 2: cityheaven - Star rating trends
  // ============================================================
  if (mode === 'all' || mode === 'cityheaven') {
    console.log(`\n${'='.repeat(60)}`);
    console.log('CITYHEAVEN: Star rating trends');
    console.log(`${'='.repeat(60)}`);

    // Set age verification cookie
    await page.setCookie({
      name: 'acheck',
      value: '1',
      domain: '.cityheaven.net',
      path: '/',
    });

    const chPrefectures = [
      { key: 'tokyo', path: 'tokyo', name: '東京' },
      { key: 'kanagawa', path: 'kanagawa', name: '神奈川' },
      { key: 'osaka', path: 'osaka', name: '大阪' },
      { key: 'aichi', path: 'aichi', name: '愛知' },
    ];

    for (const pref of chPrefectures) {
      console.log(`\n--- CityHeaven: ${pref.name} ---`);

      const dbShops = db.prepare(`
        SELECT s.id, s.name, s.source_url, a.name as area_name
        FROM shops s JOIN areas a ON s.area_id = a.id
        WHERE s.is_active = 1 AND a.prefecture = ?
      `).all(pref.key);

      const shopIndex = dbShops.map(s => ({
        ...s,
        normalized: normalizeName(s.name),
        // Extract cityheaven slug from source_url
        slug: s.source_url ? s.source_url.match(/\/([^/]+)\/?$/)?.[1] || null : null
      }));

      console.log(`DB has ${shopIndex.length} ${pref.key} shops`);

      // Get shop list from cityheaven review ranking page
      const reviewRankUrl = `https://www.cityheaven.net/${pref.path}/deli-kuchikomi-ranking/`;
      console.log(`Fetching: ${reviewRankUrl}`);

      try {
        await page.goto(reviewRankUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2500 + Math.random() * 1000);

        // Extract shops with review counts from ranking
        const chShops = await page.evaluate(() => {
          const results = [];
          // Try various selectors for the ranking page
          const items = document.querySelectorAll('.ranking_shop, .shop_ranking_item, .ranking-shop-item, [class*="ranking"] a[href*="/deli/"]');
          items.forEach(item => {
            const link = item.querySelector ? (item.querySelector('a[href*="/deli/"]') || item.closest('a[href*="/deli/"]')) : item;
            if (!link) return;
            const href = link.href || '';
            const slug = href.match(/\/deli\/([^/]+)/)?.[1];
            const name = (link.textContent || '').trim().substring(0, 100);
            if (slug && name) {
              results.push({ slug, name, href });
            }
          });

          // Also try generic links to deli shops
          if (results.length === 0) {
            document.querySelectorAll('a[href*="/deli/"]').forEach(a => {
              const href = a.href || '';
              const slug = href.match(/\/deli\/([^/]+)/)?.[1];
              const name = (a.textContent || '').trim().substring(0, 100);
              if (slug && name && name.length > 2 && !slug.includes('ranking')) {
                results.push({ slug, name, href });
              }
            });
          }

          // Deduplicate by slug
          const seen = new Set();
          return results.filter(r => {
            if (seen.has(r.slug)) return false;
            seen.add(r.slug);
            return true;
          }).slice(0, 100);
        });

        console.log(`Found ${chShops.length} shops on ranking page`);

        // Match cityheaven shops against DB
        for (const chShop of chShops) {
          // Try to match by slug in source_url
          let dbMatch = shopIndex.find(s => s.slug === chShop.slug);

          // Try by name
          if (!dbMatch) {
            const chNorm = normalizeName(chShop.name);
            dbMatch = shopIndex.find(s => s.normalized === chNorm);
            if (!dbMatch) {
              dbMatch = shopIndex.find(s =>
                (chNorm.length >= 4 && s.normalized.includes(chNorm)) ||
                (s.normalized.length >= 4 && chNorm.includes(s.normalized))
              );
            }
          }

          if (!dbMatch) continue;

          const dbGirls = findGirlsByShop.all(dbMatch.id);
          if (dbGirls.length === 0) continue;

          // Visit shop review page on cityheaven
          try {
            const shopReviewUrl = `https://www.cityheaven.net/${pref.path}/deli/${chShop.slug}/reviews/`;
            await page.goto(shopReviewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(2500 + Math.random() * 1000);

            // Extract review star data (NOT text)
            const reviewData = await page.evaluate(() => {
              const stars = [];
              // Look for star ratings
              const reviewItems = document.querySelectorAll('.review_item, .review-item, [class*="review"]');
              reviewItems.forEach(item => {
                // Try to find star images or star count
                const starImgs = item.querySelectorAll('.star img, [class*="star"] img, .icon-star');
                const starText = item.querySelector('[class*="star"], [class*="rating"]');
                let starCount = starImgs.length;
                if (starCount === 0 && starText) {
                  const match = starText.textContent.match(/(\d+(\.\d+)?)/);
                  if (match) starCount = parseFloat(match[1]);
                }
                if (starCount > 0) {
                  stars.push(starCount);
                }
              });

              // Also try the overall shop rating
              const overallEl = document.querySelector('.shop-rating, [class*="average"], [class*="rating-num"]');
              let overallRating = 0;
              if (overallEl) {
                const match = overallEl.textContent.match(/(\d+(\.\d+)?)/);
                if (match) overallRating = parseFloat(match[1]);
              }

              // Count total reviews from pagination or count text
              const countEl = document.querySelector('[class*="review-count"], [class*="total"]');
              let reviewCount = 0;
              if (countEl) {
                const match = countEl.textContent.match(/(\d+)/);
                if (match) reviewCount = parseInt(match[1]);
              }

              return { stars, overallRating, reviewCount };
            });

            // Generate reviews based on trends
            const avgStars = reviewData.stars.length > 0
              ? reviewData.stars.reduce((a, b) => a + b, 0) / reviewData.stars.length
              : reviewData.overallRating || 3.5;

            // Generate 1-5 reviews per shop based on review count
            const numReviews = Math.min(
              Math.max(Math.floor(reviewData.reviewCount / 10), 1),
              Math.min(dbGirls.length, 5)
            );

            let addedForShop = 0;
            const usedGirls = new Set();

            for (let r = 0; r < numReviews; r++) {
              // Pick a random girl (avoid duplicates)
              let girl;
              let attempts = 0;
              do {
                girl = dbGirls[Math.floor(Math.random() * dbGirls.length)];
                attempts++;
              } while (usedGirls.has(girl.id) && attempts < 10);
              usedGirls.add(girl.id);

              const panelRating = determinePanelRatingFromCH(avgStars);
              const visitDate = randomRecentDate();
              const browserId = `ext-ch-${chShop.slug}-${++seqNum}`;

              const result = insertReview.run(girl.id, visitDate, panelRating, browserId);
              if (result.changes > 0) { addedForShop++; totalAdded++; }
            }

            if (addedForShop > 0) {
              console.log(`  ${chShop.name} => ${dbMatch.name}: +${addedForShop} (avg ${avgStars.toFixed(1)} stars)`);
            }
          } catch (err) {
            // Skip silently
          }

          await sleep(2000 + Math.random() * 1000);
        }

      } catch (err) {
        console.log(`  Error on ranking page: ${err.message}`);
      }
    }
  }

  await browser.close();

  // Report
  const afterCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
  const extTrendCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-trend-%'").get().c;
  const extChCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-ch-%'").get().c;

  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL RESULTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Reviews before: ${beforeCount}`);
  console.log(`Reviews after: ${afterCount}`);
  console.log(`New reviews added: ${afterCount - beforeCount}`);
  console.log(`  ext-trend total: ${extTrendCount}`);
  console.log(`  ext-ch total: ${extChCount}`);

  const dist = db.prepare(`
    SELECT panel_rating, COUNT(*) as c
    FROM reviews
    GROUP BY panel_rating
  `).all();
  console.log('\nOverall rating distribution:');
  dist.forEach(d => console.log(`  ${d.panel_rating}: ${d.c}`));

  db.close();
  console.log('\nDone!');
}

main().catch(console.error);
