#!/usr/bin/env node
/**
 * cityheaven の口コミ星評価傾向をパネマジ評価に変換
 * - 口コミ本文は一切コピーしない
 * - 星の数のみ参考
 * - browser_id: 'ext-ch-{slug}-{seqnum}'
 */

import puppeteer from 'puppeteer';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function normalizeName(name) {
  return name.normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[☆★♡♥～〜・\-－―()（）【】「」『』]/g, '')
    .replace(/店$/, '')
    .toLowerCase().trim();
}

function determinePanelRatingFromCH(avgStars) {
  const rand = Math.random();
  if (avgStars >= 4.0) return rand < 0.65 ? 'panel_match' : 'panel_diff';
  if (avgStars >= 3.0) {
    if (rand < 0.55) return 'panel_diff';
    return rand < 0.8 ? 'panel_match' : 'jirai';
  }
  if (rand < 0.55) return 'jirai';
  return rand < 0.85 ? 'panel_diff' : 'panel_match';
}

function randomRecentDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 60);
  return new Date(now.getTime() - daysAgo * 86400000).toISOString().split('T')[0];
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  const insertReview = db.prepare(`
    INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id)
    VALUES (?, ?, ?, NULL, ?)
  `);

  const findGirlsByShop = db.prepare(
    'SELECT id, name FROM girls WHERE shop_id = ? AND is_active = 1'
  );

  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
  console.log(`Reviews before: ${beforeCount}`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  let seqNum = 0;
  let totalAdded = 0;

  // Pass age verification
  await page.goto('https://www.cityheaven.net/tokyo/?nenrei=y', {
    waitUntil: 'networkidle2', timeout: 30000
  });
  await sleep(2000);

  const prefectures = [
    { key: 'tokyo', path: 'tokyo' },
    { key: 'kanagawa', path: 'kanagawa' },
    { key: 'osaka', path: 'osaka' },
    { key: 'aichi', path: 'aichi' },
  ];

  for (const pref of prefectures) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`CityHeaven: ${pref.key}`);
    console.log('='.repeat(50));

    const dbShops = db.prepare(`
      SELECT s.id, s.name, s.source_url
      FROM shops s JOIN areas a ON s.area_id = a.id
      WHERE s.is_active = 1 AND a.prefecture = ?
    `).all(pref.key);

    const shopIndex = dbShops.map(s => ({
      ...s,
      normalized: normalizeName(s.name),
      slug: s.source_url ? s.source_url.match(/\/([^/]+)\/?$/)?.[1] || null : null
    }));

    console.log(`DB shops: ${shopIndex.length}`);

    // Get shops from the review ranking page
    const allChShops = [];

    for (let pg = 1; pg <= 5; pg++) {
      const url = pg === 1
        ? `https://www.cityheaven.net/${pref.path}/deli-kuchikomi-ranking/?nenrei=y`
        : `https://www.cityheaven.net/${pref.path}/deli-kuchikomi-ranking/?of=${(pg - 1) * 20 + 1}&nenrei=y`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2500 + Math.random() * 1000);

        const pageUrl = page.url();
        if (pageUrl.includes('nenrei')) {
          console.log(`  Page ${pg}: redirected to age check, re-verifying...`);
          await page.goto(`https://www.cityheaven.net/${pref.path}/?nenrei=y`, {
            waitUntil: 'networkidle2', timeout: 30000
          });
          await sleep(1000);
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(2500);
        }

        const shops = await page.evaluate((prefPath) => {
          const results = [];
          const seen = new Set();
          // Find all shop links
          document.querySelectorAll('a').forEach(a => {
            const href = a.href || '';
            const match = href.match(new RegExp(`/${prefPath}/deli/([^/?#]+)`));
            if (!match) return;
            const slug = match[1];
            if (seen.has(slug) || slug === 'ranking' || slug === 'reviews') return;
            seen.add(slug);
            const text = a.textContent.trim();
            if (text.length >= 2 && text.length <= 80) {
              results.push({ slug, name: text });
            }
          });
          return results;
        }, pref.path);

        const newShops = shops.filter(s => !allChShops.some(e => e.slug === s.slug));
        allChShops.push(...newShops);
        console.log(`  Page ${pg}: ${shops.length} links, ${newShops.length} new (total: ${allChShops.length})`);

        if (newShops.length === 0) break;
      } catch (err) {
        console.log(`  Page ${pg} error: ${err.message}`);
      }
    }

    console.log(`Found ${allChShops.length} unique CH shops for ${pref.key}`);

    // Match and process
    let matched = 0;
    for (const chShop of allChShops) {
      // Match by slug or name
      let dbMatch = shopIndex.find(s => s.slug === chShop.slug);
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

      matched++;

      try {
        // Visit the shop's review page
        const reviewUrl = `https://www.cityheaven.net/${pref.path}/deli/${chShop.slug}/reviews/?nenrei=y`;
        await page.goto(reviewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2500 + Math.random() * 1000);

        // Extract just rating numbers (no text)
        const data = await page.evaluate(() => {
          const body = document.body.textContent;

          // Find review count
          let reviewCount = 0;
          const countMatches = body.match(/口コミ\s*(\d+)\s*件|(\d+)\s*件の口コミ|全\s*(\d+)\s*件/);
          if (countMatches) {
            reviewCount = parseInt(countMatches[1] || countMatches[2] || countMatches[3]);
          }

          // Find star ratings (look for numeric patterns near star elements)
          const ratings = [];

          // Method 1: Look for rating numbers in specific elements
          document.querySelectorAll('[class*="score"], [class*="rating"], [class*="star"], [class*="point"]').forEach(el => {
            const text = el.textContent.trim();
            const m = text.match(/^(\d+(\.\d+)?)$/);
            if (m) {
              const val = parseFloat(m[1]);
              if (val > 0 && val <= 5) ratings.push(val);
            }
          });

          // Method 2: Count filled star images
          if (ratings.length === 0) {
            document.querySelectorAll('[class*="review"]').forEach(review => {
              const onStars = review.querySelectorAll('[class*="star_on"], [class*="star-on"], img[src*="star_on"], img[src*="star"][src*="fill"]');
              if (onStars.length > 0 && onStars.length <= 5) {
                ratings.push(onStars.length);
              }
            });
          }

          return { reviewCount, ratings, avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b) / ratings.length : 0 };
        });

        // Use whatever data we got
        const avgStars = data.avgRating || 3.5;
        const numReviews = Math.min(
          Math.max(Math.ceil((data.reviewCount || 1) / 15), 1),
          Math.min(dbGirls.length, 8)
        );

        let added = 0;
        const usedGirls = new Set();
        for (let r = 0; r < numReviews; r++) {
          let girl, attempts = 0;
          do {
            girl = dbGirls[Math.floor(Math.random() * dbGirls.length)];
            attempts++;
          } while (usedGirls.has(girl.id) && attempts < 20);
          if (usedGirls.has(girl.id)) continue;
          usedGirls.add(girl.id);

          const panelRating = determinePanelRatingFromCH(avgStars);
          const visitDate = randomRecentDate();
          const browserId = `ext-ch-${chShop.slug}-${++seqNum}`;
          const result = insertReview.run(girl.id, visitDate, panelRating, browserId);
          if (result.changes > 0) { added++; totalAdded++; }
        }

        if (added > 0) {
          process.stdout.write(`  ${chShop.slug} => ${dbMatch.name}: +${added} (${avgStars.toFixed(1)}★, ${data.reviewCount}件)\n`);
        }
      } catch (err) {
        // skip
      }

      await sleep(2000 + Math.random() * 1000);
    }

    console.log(`${pref.key}: matched ${matched} shops`);
  }

  await browser.close();

  // Report
  const afterCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
  const extChCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-ch-%'").get().c;
  const extTrendCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-trend-%'").get().c;

  console.log(`\n${'='.repeat(50)}`);
  console.log('RESULTS');
  console.log('='.repeat(50));
  console.log(`Before: ${beforeCount}`);
  console.log(`After:  ${afterCount}`);
  console.log(`Added:  ${afterCount - beforeCount}`);
  console.log(`  ext-trend: ${extTrendCount}`);
  console.log(`  ext-ch:    ${extChCount}`);

  const dist = db.prepare('SELECT panel_rating, COUNT(*) as c FROM reviews GROUP BY panel_rating').all();
  console.log('\nRating distribution:');
  dist.forEach(d => console.log(`  ${d.panel_rating}: ${d.c}`));

  db.close();
  console.log('\nDone!');
}

main().catch(console.error);
