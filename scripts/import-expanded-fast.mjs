#!/usr/bin/env node
/**
 * 高速版：fujoho.jp + cityheaven の口コミ傾向データ収集
 *
 * 前回のスクリプトより高速化:
 * - good girls ページの訪問をスキップ（1店舗あたり1ページのみ訪問）
 * - レビュー傾向のみ取得→ランダムに在籍女性に割り当て
 * - INSERT OR IGNORE で重複防止
 */

import puppeteer from 'puppeteer';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FUJOHO_PREFECTURES = {
  tokyo:    { t: 13, k: 2, name: '東京' },
  kanagawa: { t: 14, k: 2, name: '神奈川' },
  osaka:    { t: 27, k: 2, name: '大阪' },
  aichi:    { t: 23, k: 2, name: '愛知' },
};

function normalizeName(name) {
  return name.normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[☆★♡♥～〜・\-－―()（）【】「」『』]/g, '')
    .replace(/店$/, '')
    .toLowerCase().trim();
}

function determinePanelRating(sougouStars, shashinStars) {
  const stars = shashinStars > 0 ? shashinStars : sougouStars;
  const rand = Math.random();
  if (stars >= 4) return rand < 0.7 ? 'panel_match' : 'panel_diff';
  if (stars >= 3) {
    if (rand < 0.6) return 'panel_diff';
    return rand < 0.8 ? 'panel_match' : 'jirai';
  }
  if (rand < 0.6) return 'jirai';
  return rand < 0.9 ? 'panel_diff' : 'panel_match';
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
  const mode = process.argv[2] || 'all';

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

  // Count existing reviews per girl to avoid over-populating
  const existingReviewCount = db.prepare(
    'SELECT girl_id, COUNT(*) as c FROM reviews GROUP BY girl_id'
  );
  const reviewCountMap = new Map();
  for (const row of existingReviewCount.all()) {
    reviewCountMap.set(row.girl_id, row.c);
  }

  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
  console.log(`Reviews before: ${beforeCount}`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const timestamp = Date.now();
  let seqNum = 0;
  let totalAdded = 0;

  // Helper: match fujoho shops against DB
  function matchShops(fujohoShops, shopIndex) {
    const matched = [];
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
      if (match) matched.push({ fujoho: fShop, db: match });
    }
    return matched;
  }

  // ============================================================
  // PART 1: fujoho.jp - fast mode (review trends only, no good girls)
  // ============================================================
  if (mode === 'all' || mode.startsWith('fujoho')) {
    const prefKeys = mode === 'fujoho-tokyo' ? ['tokyo']
      : mode === 'fujoho-other' ? ['kanagawa', 'osaka', 'aichi']
      : ['tokyo', 'kanagawa', 'osaka', 'aichi'];

    for (const prefKey of prefKeys) {
      const prefConfig = FUJOHO_PREFECTURES[prefKey];
      console.log(`\n${'='.repeat(50)}`);
      console.log(`FUJOHO FAST: ${prefConfig.name}`);
      console.log('='.repeat(50));

      const dbShops = db.prepare(`
        SELECT s.id, s.name FROM shops s
        JOIN areas a ON s.area_id = a.id
        WHERE s.is_active = 1 AND a.prefecture = ?
      `).all(prefKey);

      const shopIndex = dbShops.map(s => ({ ...s, normalized: normalizeName(s.name) }));
      console.log(`DB shops: ${shopIndex.length}`);

      // Get fujoho shop list
      const fujohoShops = [];
      const maxPages = prefKey === 'tokyo' ? 10 : 5;

      for (let pg = 1; pg <= maxPages; pg++) {
        const url = pg === 1
          ? `https://fujoho.jp/index.php?p=shop_list&t=${prefConfig.t}&k=${prefConfig.k}`
          : `https://fujoho.jp/index.php?p=shop_list&t=${prefConfig.t}&k=${prefConfig.k}&pg=${pg}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(2000 + Math.random() * 1000);
          const shops = await page.evaluate(() => {
            const results = []; const seen = new Set();
            document.querySelectorAll('a[href*="p=shop&id="]').forEach(a => {
              const id = new URL(a.href).searchParams.get('id');
              const text = a.textContent.trim();
              if (id && text && text.length > 1 && !seen.has(id)) {
                seen.add(id); results.push({ id, name: text });
              }
            });
            return results;
          });
          fujohoShops.push(...shops);
          console.log(`  Page ${pg}: ${shops.length} (total: ${fujohoShops.length})`);
          if (shops.length === 0) break;
        } catch (err) {
          console.log(`  Page ${pg} error: ${err.message}`);
          break;
        }
      }

      const matched = matchShops(fujohoShops, shopIndex);
      console.log(`Matched: ${matched.length}`);

      // Check which shops already have ext-trend reviews
      const processedShopIds = new Set();
      const existing = db.prepare(`
        SELECT DISTINCT g.shop_id FROM reviews r
        JOIN girls g ON r.girl_id = g.id
        WHERE r.browser_id LIKE 'ext-trend-%'
      `).all();
      existing.forEach(e => processedShopIds.add(e.shop_id));
      console.log(`Already processed shops: ${processedShopIds.size}`);

      const toProcess = matched.filter(m => !processedShopIds.has(m.db.id));
      console.log(`Shops to process: ${toProcess.length}`);

      for (let i = 0; i < toProcess.length; i++) {
        const { fujoho: fShop, db: dbShop } = toProcess[i];
        const dbGirls = findGirlsByShop.all(dbShop.id);
        if (dbGirls.length === 0) continue;

        try {
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

          if (reviews.length === 0) {
            process.stdout.write(`  [${i+1}/${toProcess.length}] ${fShop.name}: 0 reviews, skip\n`);
            continue;
          }

          // Generate reviews: assign to random girls based on trends
          // Number of reviews = min(review_count * 0.5, 15, girlCount)
          const numToGenerate = Math.min(
            Math.ceil(reviews.length * 0.5),
            15,
            dbGirls.length
          );

          let added = 0;
          const usedGirls = new Set();

          for (let r = 0; r < numToGenerate; r++) {
            // Pick a girl not yet used, preferring those with fewer reviews
            let girl;
            let attempts = 0;
            do {
              girl = dbGirls[Math.floor(Math.random() * dbGirls.length)];
              attempts++;
            } while (usedGirls.has(girl.id) && attempts < 20);

            if (usedGirls.has(girl.id)) continue;
            usedGirls.add(girl.id);

            const trend = reviews[Math.floor(Math.random() * reviews.length)];
            const panelRating = determinePanelRating(trend.sougouStars, trend.shashinStars);
            const visitDate = trend.date || randomRecentDate();
            const browserId = `ext-trend-${timestamp}-${++seqNum}`;
            const result = insertReview.run(girl.id, visitDate, panelRating, browserId);
            if (result.changes > 0) { added++; totalAdded++; }
          }

          process.stdout.write(`  [${i+1}/${toProcess.length}] ${fShop.name}: +${added} (from ${reviews.length} trends)\n`);
        } catch (err) {
          process.stdout.write(`  [${i+1}/${toProcess.length}] ${fShop.name}: error\n`);
        }

        await sleep(2000 + Math.random() * 1000);
      }

      console.log(`\n${prefConfig.name} done. Total added so far: ${totalAdded}`);
    }
  }

  // ============================================================
  // PART 2: cityheaven star trends
  // ============================================================
  if (mode === 'all' || mode === 'cityheaven') {
    console.log(`\n${'='.repeat(50)}`);
    console.log('CITYHEAVEN TRENDS');
    console.log('='.repeat(50));

    await page.setCookie({
      name: 'acheck', value: '1',
      domain: '.cityheaven.net', path: '/',
    });

    const chPrefectures = [
      { key: 'tokyo', path: 'tokyo' },
      { key: 'kanagawa', path: 'kanagawa' },
      { key: 'osaka', path: 'osaka' },
      { key: 'aichi', path: 'aichi' },
    ];

    for (const pref of chPrefectures) {
      console.log(`\n--- CityHeaven: ${pref.key} ---`);

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

      // Get review ranking pages
      for (let pg = 1; pg <= 3; pg++) {
        const url = pg === 1
          ? `https://www.cityheaven.net/${pref.path}/deli-kuchikomi-ranking/`
          : `https://www.cityheaven.net/${pref.path}/deli-kuchikomi-ranking/?of=${(pg-1) * 20 + 1}`;

        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(2500 + Math.random() * 1000);

          // Extract shop links
          const chShops = await page.evaluate((prefPath) => {
            const results = [];
            const seen = new Set();
            document.querySelectorAll(`a[href*="/${prefPath}/deli/"]`).forEach(a => {
              const href = a.href || '';
              const match = href.match(new RegExp(`/${prefPath}/deli/([^/]+)`));
              if (!match) return;
              const slug = match[1];
              if (slug.includes('ranking') || slug.includes('review') || seen.has(slug)) return;
              seen.add(slug);
              const name = a.textContent.trim().substring(0, 80);
              if (name.length > 2) results.push({ slug, name });
            });
            return results;
          }, pref.path);

          console.log(`  Ranking page ${pg}: ${chShops.length} shops`);

          for (const chShop of chShops) {
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

            try {
              const reviewUrl = `https://www.cityheaven.net/${pref.path}/deli/${chShop.slug}/reviews/`;
              await page.goto(reviewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
              await sleep(2500 + Math.random() * 1000);

              // Extract star ratings only (no text)
              const data = await page.evaluate(() => {
                let avgRating = 0;
                let reviewCount = 0;

                // Try to find overall rating
                const ratingEls = document.querySelectorAll('[class*="rating"], [class*="score"], [class*="star"]');
                for (const el of ratingEls) {
                  const text = el.textContent.trim();
                  const match = text.match(/(\d+\.\d+)/);
                  if (match && parseFloat(match[1]) <= 5.0 && parseFloat(match[1]) > 0) {
                    avgRating = parseFloat(match[1]);
                    break;
                  }
                }

                // Try to find review count
                const body = document.body.textContent;
                const countMatch = body.match(/(\d+)\s*件/);
                if (countMatch) reviewCount = parseInt(countMatch[1]);

                // Count star images as fallback
                if (avgRating === 0) {
                  const starImgs = document.querySelectorAll('.icon-star-on, .star_on, img[src*="star"][src*="on"]');
                  if (starImgs.length > 0) {
                    avgRating = Math.min(starImgs.length, 5);
                  }
                }

                return { avgRating, reviewCount };
              });

              if (data.avgRating === 0 && data.reviewCount === 0) continue;

              const effectiveRating = data.avgRating || 3.5;
              const numReviews = Math.min(
                Math.max(Math.ceil(data.reviewCount / 20), 1),
                Math.min(dbGirls.length, 5)
              );

              let added = 0;
              const usedGirls = new Set();
              for (let r = 0; r < numReviews; r++) {
                let girl;
                let attempts = 0;
                do {
                  girl = dbGirls[Math.floor(Math.random() * dbGirls.length)];
                  attempts++;
                } while (usedGirls.has(girl.id) && attempts < 15);
                if (usedGirls.has(girl.id)) continue;
                usedGirls.add(girl.id);

                const panelRating = determinePanelRatingFromCH(effectiveRating);
                const visitDate = randomRecentDate();
                const browserId = `ext-ch-${chShop.slug}-${++seqNum}`;
                const result = insertReview.run(girl.id, visitDate, panelRating, browserId);
                if (result.changes > 0) { added++; totalAdded++; }
              }

              if (added > 0) {
                process.stdout.write(`  ${chShop.name} => ${dbMatch.name}: +${added} (${effectiveRating}★)\n`);
              }
            } catch (err) {
              // skip
            }

            await sleep(2000 + Math.random() * 1000);
          }
        } catch (err) {
          console.log(`  Ranking page ${pg} error: ${err.message}`);
        }
      }
    }
  }

  await browser.close();

  // Final report
  const afterCount = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;
  const extTrendCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-trend-%'").get().c;
  const extChCount = db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-ch-%'").get().c;

  console.log(`\n${'='.repeat(50)}`);
  console.log('FINAL RESULTS');
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
