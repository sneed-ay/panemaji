#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウント収集 v5
 *
 * 方針: Google検索を使用（DuckDuckGoより精度が高い）
 * - 検索クエリ: "女性名" "店舗キーワード" site:x.com
 * - 結果のスニペットに店舗名or女性名が含まれるか確認
 * - 1つのXアカウントが3人以上にヒットしたら除外（店舗アカウント）
 * - 上位100店舗対象、名前3文字以上
 * - 高速: プロフィール確認なし、スニペットベースで判定
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const PROGRESS_FILE = path.join(__dirname, '..', 'twitter-v5-progress.json');
const MAX_SHOPS = 100;
const SEARCH_DELAY_MS = 4000; // Google is stricter about rate limiting

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return {
        searched: new Set(data.searched || []),
        found: data.found || 0,
        accountUsage: data.accountUsage || {}, // url -> count across ALL shops
        shopAccountUsage: data.shopAccountUsage || {}, // shopId -> { url: count }
      };
    }
  } catch (e) {}
  return { searched: new Set(), found: 0, accountUsage: {}, shopAccountUsage: {} };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    searched: [...progress.searched],
    found: progress.found,
    accountUsage: progress.accountUsage,
    shopAccountUsage: progress.shopAccountUsage,
    lastSaved: new Date().toISOString()
  }));
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
      AND g.name NOT LIKE '%即%'
      AND g.name NOT LIKE '%限定%'
      AND g.name NOT LIKE '%AF%'
      AND g.name NOT LIKE '%在籍%'
      AND g.name NOT LIKE '%最高峰%'
      AND g.name NOT LIKE '%スター%'
      AND g.name NOT LIKE '%女優%'
      AND g.name NOT LIKE '%被写体%'
      AND g.name NOT LIKE '%ちゃん%'
      AND LENGTH(g.name) >= 3
      AND LENGTH(g.name) <= 8
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

function extractShopKeyword(shopName) {
  let name = shopName
    .replace(/　/g, ' ').replace(/\s+/g, ' ')
    .replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '').replace(/「[^」]*」/g, '')
    .replace(/『[^』]*』/g, '').replace(/[～〜]/g, '')
    .trim();
  const parts = name.split(/[\s　]/);
  if (parts[0].length >= 3) return parts[0];
  return name.substring(0, 20);
}

async function searchGoogle(page, shopName, girlName) {
  const shopKeyword = extractShopKeyword(shopName);
  const query = `"${girlName}" "${shopKeyword}" site:x.com`;

  try {
    await page.goto('https://www.google.com/search?q=' + encodeURIComponent(query) + '&num=5&hl=ja', {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    await sleep(500);

    // Check for CAPTCHA
    const url = page.url();
    if (url.includes('sorry') || url.includes('captcha')) {
      console.log('    [CAPTCHA] Google CAPTCHA detected. Switching to DuckDuckGo...');
      return searchDDG(page, shopName, girlName);
    }

    // Extract search results with context
    const results = await page.evaluate(() => {
      const items = [];
      // Google search result containers
      document.querySelectorAll('#search .g, #rso .g, [data-sokoban-container]').forEach(el => {
        const linkEl = el.querySelector('a[href*="x.com"], a[href*="twitter.com"]');
        if (!linkEl) return;
        const href = linkEl.href;
        const title = el.querySelector('h3')?.textContent || linkEl.textContent || '';
        const snippet = el.querySelector('.VwiC3b, [data-sncf], .IsZvec')?.textContent || '';
        items.push({ href, title, snippet });
      });
      return items;
    });

    return processResults(results, girlName, shopName);
  } catch (err) {
    return null;
  }
}

async function searchDDG(page, shopName, girlName) {
  const shopKeyword = extractShopKeyword(shopName);
  const query = `"${girlName}" "${shopKeyword}" site:x.com`;

  try {
    await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    await sleep(600);

    const noResults = await page.evaluate(() => {
      return document.body.innerText.includes('結果は見つかりません') ||
             document.body.innerText.includes('No results');
    });
    if (noResults) return null;

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('article, [data-testid="result"]').forEach(el => {
        const links = el.querySelectorAll('a');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (href.includes('x.com/') || href.includes('twitter.com/')) {
            const title = el.querySelector('h2')?.textContent || a.textContent || '';
            const snippet = el.querySelector('[data-result="snippet"]')?.textContent || el.textContent || '';
            items.push({ href, title, snippet });
            break;
          }
        }
      });
      return items;
    });

    return processResults(results, girlName, shopName);
  } catch (err) {
    return null;
  }
}

function processResults(results, girlName, shopName) {
  if (!results || results.length === 0) return null;

  const excluded = new Set(['search', 'explore', 'home', 'hashtag', 'i', 'settings',
    'help', 'about', 'tos', 'privacy', 'login', 'signup',
    'intent', 'share', 'compose', 'notifications', 'messages',
    'communities', 'lists', 'elonmusk', 'x']);

  const shopKeyword = extractShopKeyword(shopName).toLowerCase();

  for (const result of results) {
    const href = result.href || '';
    const context = (result.title + ' ' + result.snippet).toLowerCase();

    // Only profile URLs
    const m = href.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/?$/);
    if (!m) continue;

    const username = m[1];
    if (excluded.has(username.toLowerCase())) continue;

    // Skip if result title/snippet contains "公式" (official)
    if (context.includes('公式') || context.includes('official')) continue;

    // Check if both name and shop keyword appear in context
    const hasName = context.includes(girlName.toLowerCase()) || context.includes(girlName);
    const hasShop = context.includes(shopKeyword);

    if (hasName && hasShop) {
      return `https://x.com/${username}`;
    }

    // If only name appears but in a profile-like context
    if (hasName && !href.includes('/status/')) {
      return `https://x.com/${username}`;
    }
  }

  return null;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  console.log('=== パネマジ X/Twitter アカウント収集スクリプト v5 (Google検索版) ===\n');

  const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`開始時点のtwitter_url保有数: ${beforeCount.cnt} 件\n`);

  const progress = loadProgress();
  console.log(`前回の進捗: ${progress.searched.size} 件検索済み, ${progress.found} 件発見\n`);

  const girls = getTargetGirls(db);
  console.log(`対象: 上位${MAX_SHOPS}店舗の ${girls.length} 人 (名前3文字以上)`);

  const targetGirls = girls.filter(g => !progress.searched.has(String(g.id)));
  console.log(`未検索: ${targetGirls.length} 人\n`);

  if (targetGirls.length === 0) {
    console.log('全員検索済みです。');
    db.close();
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let sessionFound = 0;
  let sessionSearched = 0;
  let consecutiveEmpty = 0;
  let useGoogle = true;
  const results = [];
  const startTime = Date.now();

  const updateStmt = db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ? AND (twitter_url IS NULL OR twitter_url = \'\')');

  for (const girl of targetGirls) {
    sessionSearched++;

    if (sessionSearched % 10 === 1 || sessionSearched <= 5) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = sessionSearched > 1 ? (sessionFound / sessionSearched * 100).toFixed(1) : '0.0';
      console.log(`\n[進捗] ${sessionSearched}/${targetGirls.length} | 発見: ${sessionFound} (${rate}%) | ${elapsed}分 | ${useGoogle ? 'Google' : 'DDG'}`);
    }

    let twitterUrl;
    if (useGoogle) {
      twitterUrl = await searchGoogle(page, girl.shop_name, girl.name);
      // If Google blocked us, switch to DDG
      const currentUrl = page.url();
      if (currentUrl.includes('sorry') || currentUrl.includes('captcha')) {
        useGoogle = false;
        console.log('  [SWITCH] Google blocked → DuckDuckGoに切替');
        twitterUrl = await searchDDG(page, girl.shop_name, girl.name);
      }
    } else {
      twitterUrl = await searchDDG(page, girl.shop_name, girl.name);
    }

    progress.searched.add(String(girl.id));

    if (twitterUrl) {
      // Track usage
      progress.accountUsage[twitterUrl] = (progress.accountUsage[twitterUrl] || 0) + 1;
      const shopKey = String(girl.shop_id);
      if (!progress.shopAccountUsage[shopKey]) progress.shopAccountUsage[shopKey] = {};
      progress.shopAccountUsage[shopKey][twitterUrl] = (progress.shopAccountUsage[shopKey][twitterUrl] || 0) + 1;

      // Skip if this URL has been found too many times (shop account)
      if (progress.accountUsage[twitterUrl] <= 2 &&
          progress.shopAccountUsage[shopKey][twitterUrl] <= 1) {
        sessionFound++;
        progress.found++;
        consecutiveEmpty = 0;
        console.log(`  [FOUND] ${girl.shop_name} / ${girl.name}: ${twitterUrl}`);
        updateStmt.run(twitterUrl, girl.id);
        results.push({ id: girl.id, name: girl.name, shop: girl.shop_name, url: twitterUrl });
      } else {
        console.log(`  [SKIP] ${twitterUrl} (使用回数: ${progress.accountUsage[twitterUrl]}, 同店舗: ${progress.shopAccountUsage[shopKey][twitterUrl]})`);
        // Revert if this is the 2nd time in same shop
        if (progress.shopAccountUsage[shopKey][twitterUrl] === 2) {
          db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ? AND shop_id = ?').run(twitterUrl, girl.shop_id);
        }
      }
    } else {
      consecutiveEmpty++;
    }

    if (consecutiveEmpty >= 50) {
      console.log('\n[WARN] 50連続空結果。30秒待機...');
      await sleep(30000);
      consecutiveEmpty = 0;
    }

    if (sessionSearched % 50 === 0) {
      saveProgress(progress);
      const cnt = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
      console.log(`  [SAVE] DB: ${cnt.cnt} 件`);
    }

    await sleep(SEARCH_DELAY_MS);
  }

  await browser.close();
  saveProgress(progress);

  // Final cleanup
  const dupes = db.prepare(`
    SELECT twitter_url, COUNT(*) as cnt FROM girls
    WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url HAVING COUNT(*) > 1
  `).all();
  if (dupes.length > 0) {
    console.log(`\n[最終クリーンアップ] ${dupes.length} 件の重複削除`);
    for (const d of dupes) {
      db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ?').run(d.twitter_url);
    }
  }

  const afterCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();

  console.log('\n========================================');
  console.log('結果サマリー');
  console.log('========================================');
  console.log(`検索数: ${sessionSearched}`);
  console.log(`発見数: ${sessionFound}`);
  console.log(`所要時間: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}分`);
  console.log(`開始時: ${beforeCount.cnt} → 終了時: ${afterCount.cnt} (+${afterCount.cnt - beforeCount.cnt})`);

  if (results.length > 0) {
    console.log('\n発見アカウント:');
    results.forEach(r => console.log(`  ${r.shop} / ${r.name}: ${r.url}`));
  }

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
