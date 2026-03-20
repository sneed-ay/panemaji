#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウントをDuckDuckGo検索で収集するスクリプト
 *
 * site:x.com 店舗名 女性名 で検索し、プロフィールURLを抽出
 */

const Database = require('better-sqlite3');
const puppeteer = require('puppeteer');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const MAX_SHOPS = 50;
const SEARCH_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTargetGirls(db) {
  return db.prepare(`
    SELECT g.id, g.name, s.name as shop_name, s.id as shop_id
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1
      AND (g.twitter_url IS NULL OR g.twitter_url = '')
      AND g.name NOT LIKE '%新人%'
      AND g.name NOT LIKE '%体験%'
      AND LENGTH(g.name) >= 2
      AND s.id IN (
        SELECT s2.id FROM shops s2
        JOIN girls g2 ON g2.shop_id = s2.id
        WHERE g2.is_active = 1
        GROUP BY s2.id
        ORDER BY COUNT(g2.id) DESC
        LIMIT ?
      )
    ORDER BY s.id, g.id
  `).all(MAX_SHOPS);
}

function updateTwitterUrl(db, girlId, twitterUrl) {
  db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ?').run(twitterUrl, girlId);
}

function extractShopKeyword(shopName) {
  let name = shopName.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = name.split(/[\s（(【「『]/);
  if (parts[0].length >= 3) return parts[0];
  return name.substring(0, 15);
}

function extractBestProfile(links, girlName) {
  const excluded = new Set(['search', 'explore', 'home', 'hashtag', 'i', 'settings',
    'help', 'about', 'tos', 'privacy', 'login', 'signup',
    'intent', 'share', 'compose', 'notifications', 'messages']);

  const profiles = []; // Direct profile links
  const userCounts = {}; // Username -> count from status URLs

  for (const link of links) {
    const m = link.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})(?:\/|$|\?)/);
    if (!m) continue;
    const username = m[1];
    if (excluded.has(username.toLowerCase())) continue;

    if (!link.includes('/status/') && !link.includes('/hashtag/')) {
      profiles.push(username);
    } else if (link.includes('/status/')) {
      userCounts[username] = (userCounts[username] || 0) + 1;
    }
  }

  // Prefer profile links that contain girl's name (romaji approximation)
  if (profiles.length > 0) {
    // Deduplicate
    const unique = [...new Set(profiles)];
    // Return first unique profile
    return `https://x.com/${unique[0]}`;
  }

  // Fallback: most mentioned user in status URLs
  if (Object.keys(userCounts).length > 0) {
    const sorted = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
    return `https://x.com/${sorted[0][0]}`;
  }

  return null;
}

async function searchDDG(page, shopName, girlName) {
  const shopKeyword = extractShopKeyword(shopName);
  // Use unquoted search for better results
  const query = `site:x.com ${shopKeyword} ${girlName}`;

  try {
    await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    // Check if no results
    const noResults = await page.evaluate(() => {
      return document.body.innerText.includes('結果は見つかりません') ||
             document.body.innerText.includes('No results');
    });
    if (noResults) return null;

    const links = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[data-testid="result-extras-url-link"], a[data-testid="result-title-a"]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (href.includes('x.com/') || href.includes('twitter.com/')) {
          out.push(href);
        }
      });
      return [...new Set(out)];
    });

    return extractBestProfile(links, girlName);
  } catch (err) {
    return null;
  }
}

async function main() {
  const db = new Database(DB_PATH);

  console.log('=== パネマジ X/Twitter アカウント収集スクリプト ===\n');

  const girls = getTargetGirls(db);
  console.log(`対象: 上位${MAX_SHOPS}店舗の ${girls.length} 人`);

  const uniqueShops = [...new Set(girls.map(g => g.shop_name))];
  console.log(`店舗数: ${uniqueShops.length}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let found = 0;
  let searched = 0;
  const results = [];
  let consecutiveEmpty = 0;

  const targetGirls = girls.slice(0, 500);
  console.log(`検索実行: ${targetGirls.length} 人\n`);
  const startTime = Date.now();

  for (const girl of targetGirls) {
    searched++;

    if (searched % 25 === 1 || searched <= 5) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`\n[進捗] ${searched}/${targetGirls.length} | 発見: ${found} | ${elapsed}分経過`);
    }

    const twitterUrl = await searchDDG(page, girl.shop_name, girl.name);

    if (twitterUrl) {
      found++;
      consecutiveEmpty = 0;
      console.log(`  [FOUND] ${girl.shop_name} / ${girl.name}: ${twitterUrl}`);
      updateTwitterUrl(db, girl.id, twitterUrl);
      results.push({ id: girl.id, name: girl.name, shop: girl.shop_name, url: twitterUrl });
    } else {
      consecutiveEmpty++;
    }

    if (consecutiveEmpty >= 40) {
      console.log('\n[WARN] 40連続空結果。15秒待機...');
      await sleep(15000);
      consecutiveEmpty = 0;
    }

    await sleep(SEARCH_DELAY_MS);
  }

  await browser.close();

  console.log('\n========================================');
  console.log('結果サマリー');
  console.log('========================================');
  console.log(`検索数: ${searched}`);
  console.log(`発見数: ${found}`);
  console.log(`成功率: ${(found / searched * 100).toFixed(1)}%`);
  console.log(`所要時間: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}分`);

  if (results.length > 0) {
    console.log('\n発見したアカウント:');
    results.forEach(r => console.log(`  ${r.shop} / ${r.name}: ${r.url}`));
  }

  const total = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`\nDB twitter_url合計: ${total.cnt} 件`);

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
