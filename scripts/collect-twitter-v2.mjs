#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウントをDuckDuckGo検索で収集するスクリプト v2
 *
 * 改善点:
 * - 上位100店舗に拡大
 * - 検索結果の精度向上（誤検出を大幅削減）
 *   - 同じ店舗で同じXアカウントが複数人にヒットしたら除外
 *   - プロフィールURLのみを採用（ステータスURLは除外）
 *   - 検索結果のタイトル/スニペットに女性名が含まれるか確認
 * - レート制限対策（適応的遅延）
 * - 進捗保存（中断再開可能）
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const PROGRESS_FILE = path.join(__dirname, '..', 'twitter-collect-progress-v2.json');
const MAX_SHOPS = 100;
const BASE_DELAY_MS = 2500;
const MAX_DELAY_MS = 15000;
const BATCH_SIZE = 50;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Names too short/generic for reliable search
const SKIP_NAMES = new Set([
  'あい', 'まい', 'ゆい', 'りん', 'るい', 'ゆう', 'れい', 'めい', 'らん', 'あん',
  'みう', 'みお', 'りお', 'のあ', 'すず', 'もも', 'はな', 'さら', 'えま', 'ひな',
  'かな', 'ゆな', 'あや', 'れな', 'みな', 'りな', 'まな', 'せな', 'そら', 'るな',
  'みき', 'りか', 'みか', 'えり', 'ゆき', 'あか', 'しお', 'しの', 'なお', 'まお',
  'りく', 'つき', 'ここ', 'なな', 'もえ', 'うた', 'えん', 'こう', 'さや', 'ちぃ',
  'ふう', 'まき', 'まゆ', 'みよ', 'めめ', 'にき', 'ある', 'こん', 'しろ', 'てる',
  'はお', 'みこ', 'もか', 'よる', 'える', 'なつ', 'あき', 'りず',
]);

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return {
        searched: new Set(data.searched || []),
        found: data.found || 0,
        totalSearched: data.totalSearched || 0,
        shopAccountMap: data.shopAccountMap || {},
      };
    }
  } catch (e) {}
  return { searched: new Set(), found: 0, totalSearched: 0, shopAccountMap: {} };
}

function saveProgress(progress) {
  const data = {
    searched: [...progress.searched],
    found: progress.found,
    totalSearched: progress.totalSearched,
    shopAccountMap: progress.shopAccountMap,
    lastSaved: new Date().toISOString()
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data));
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
      AND LENGTH(g.name) >= 2
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
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/「[^」]*」/g, '')
    .replace(/『[^』]*』/g, '')
    .replace(/[～〜]/g, '')
    .trim();
  const parts = name.split(/[\s　]/);
  if (parts[0].length >= 3) return parts[0];
  return name.substring(0, 20);
}

/**
 * Extract profiles from search results WITH context validation.
 * Returns { url, confidence } where confidence = 'high' or 'low'
 */
function extractValidatedProfile(resultData, girlName) {
  const excluded = new Set(['search', 'explore', 'home', 'hashtag', 'i', 'settings',
    'help', 'about', 'tos', 'privacy', 'login', 'signup',
    'intent', 'share', 'compose', 'notifications', 'messages',
    'duckduckgo', 'communities', 'lists', 'elonmusk', 'x']);

  const candidates = [];

  for (const result of resultData) {
    const href = result.href || '';
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const text = title + ' ' + snippet;

    // Only look at profile URLs (not status/posts)
    const m = href.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/?$/);
    if (!m) continue;

    const username = m[1];
    if (excluded.has(username.toLowerCase())) continue;

    // Check if girl's name appears in the result context
    const nameInContext = text.includes(girlName.toLowerCase()) ||
                          text.includes(girlName);

    candidates.push({
      username,
      url: `https://x.com/${username}`,
      nameInContext,
      href
    });
  }

  // Prefer candidates where the name appears in context
  const highConf = candidates.filter(c => c.nameInContext);
  if (highConf.length > 0) {
    return { url: highConf[0].url, confidence: 'high' };
  }

  // If only one candidate, it's somewhat reliable
  if (candidates.length === 1) {
    return { url: candidates[0].url, confidence: 'low' };
  }

  return { url: null, confidence: null };
}

async function searchDDG(page, shopName, girlName, retryCount = 0) {
  const shopKeyword = extractShopKeyword(shopName);
  const query = `"${girlName}" "${shopKeyword}" site:x.com`;

  try {
    await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    // Wait a bit for results to load
    await sleep(800);

    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    if (pageText.includes('CAPTCHA') || pageText.includes('automated')) {
      if (retryCount < 2) {
        console.log('    [RATE LIMITED] Waiting 30s...');
        await sleep(30000);
        return searchDDG(page, shopName, girlName, retryCount + 1);
      }
      return { url: null, confidence: null, rateLimited: true };
    }

    const noResults = await page.evaluate(() => {
      return document.body.innerText.includes('結果は見つかりません') ||
             document.body.innerText.includes('No results') ||
             document.body.innerText.includes('No more results');
    });
    if (noResults) {
      // Try without quotes
      const query2 = `${girlName} ${shopKeyword} site:x.com`;
      await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query2), {
        waitUntil: 'networkidle2',
        timeout: 20000
      });
      await sleep(800);
    }

    // Extract results with title and snippet context
    const resultData = await page.evaluate(() => {
      const results = [];
      // Get all result items
      const articles = document.querySelectorAll('article, [data-testid="result"]');
      for (const article of articles) {
        const links = article.querySelectorAll('a');
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (href.includes('x.com/') || href.includes('twitter.com/')) {
            const title = article.querySelector('h2, [data-testid="result-title-a"]')?.textContent || '';
            const snippet = article.querySelector('[data-result="snippet"], .result__snippet')?.textContent || '';
            results.push({ href, title, snippet });
          }
        }
      }

      // Fallback: direct link extraction
      if (results.length === 0) {
        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          if ((href.includes('x.com/') || href.includes('twitter.com/')) &&
              !href.includes('duckduckgo.com')) {
            const parent = a.closest('article, li, div.result, [data-testid="result"]');
            const title = a.textContent || '';
            const snippet = parent ? parent.textContent || '' : '';
            results.push({ href, title, snippet });
          }
        });
      }

      return results;
    });

    const { url, confidence } = extractValidatedProfile(resultData, girlName);
    return { url, confidence, rateLimited: false };
  } catch (err) {
    if (retryCount < 1) {
      await sleep(5000);
      return searchDDG(page, shopName, girlName, retryCount + 1);
    }
    return { url: null, confidence: null, rateLimited: false };
  }
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  console.log('=== パネマジ X/Twitter アカウント収集スクリプト v2 ===\n');

  // First, clean up false positives from v1 run
  // Remove accounts that got assigned to many girls in the same shop
  const dupeCheck = db.prepare(`
    SELECT twitter_url, COUNT(*) as cnt, GROUP_CONCAT(name, ', ') as names
    FROM girls
    WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url
    HAVING COUNT(*) > 2
  `).all();

  if (dupeCheck.length > 0) {
    console.log(`[クリーンアップ] 3人以上に設定された重複Xアカウント: ${dupeCheck.length} 件`);
    const clearStmt = db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ?');
    let cleaned = 0;
    for (const dupe of dupeCheck) {
      console.log(`  削除: ${dupe.twitter_url} (${dupe.cnt}人: ${dupe.names.substring(0, 80)})`);
      clearStmt.run(dupe.twitter_url);
      cleaned += dupe.cnt;
    }
    console.log(`  ${cleaned} 件のtwitter_urlをクリア\n`);
  }

  // Re-count after cleanup
  const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`開始時点のtwitter_url保有数: ${beforeCount.cnt} 件\n`);

  // Load progress
  const progress = loadProgress();
  let totalFound = progress.found;
  let totalSearched = progress.totalSearched;

  console.log(`前回の進捗: ${progress.searched.size} 件検索済み, ${totalFound} 件発見\n`);

  const girls = getTargetGirls(db);
  console.log(`対象: 上位${MAX_SHOPS}店舗の ${girls.length} 人`);

  // Filter out already searched and skip names
  const targetGirls = girls.filter(g => {
    if (progress.searched.has(String(g.id))) return false;
    if (SKIP_NAMES.has(g.name)) return false;
    return true;
  });

  console.log(`未検索: ${targetGirls.length} 人`);

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
  let currentDelay = BASE_DELAY_MS;
  const results = [];
  const startTime = Date.now();

  // Track accounts found per shop to detect false positives
  const shopAccountCount = {}; // shopId -> { account -> count }

  const updateStmt = db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ? AND (twitter_url IS NULL OR twitter_url = \'\')');

  for (const girl of targetGirls) {
    sessionSearched++;
    totalSearched++;

    if (sessionSearched % 25 === 1 || sessionSearched <= 5) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = sessionSearched > 1 ? (sessionFound / sessionSearched * 100).toFixed(1) : '0.0';
      console.log(`\n[進捗] ${sessionSearched}/${targetGirls.length} | 今回発見: ${sessionFound} (${rate}%) | ${elapsed}分経過 | delay: ${currentDelay}ms`);
    }

    const { url: twitterUrl, confidence, rateLimited } = await searchDDG(page, girl.shop_name, girl.name);

    progress.searched.add(String(girl.id));

    if (twitterUrl && confidence === 'high') {
      // Track per-shop account usage
      if (!shopAccountCount[girl.shop_id]) shopAccountCount[girl.shop_id] = {};
      const shopAccounts = shopAccountCount[girl.shop_id];
      shopAccounts[twitterUrl] = (shopAccounts[twitterUrl] || 0) + 1;

      // If this account has already been found for 2+ girls in the same shop, it's likely a shop account
      if (shopAccounts[twitterUrl] <= 1) {
        sessionFound++;
        totalFound++;
        consecutiveEmpty = 0;
        currentDelay = Math.max(BASE_DELAY_MS, currentDelay - 200);
        console.log(`  [FOUND] ${girl.shop_name} / ${girl.name}: ${twitterUrl}`);
        updateStmt.run(twitterUrl, girl.id);
        results.push({ id: girl.id, name: girl.name, shop: girl.shop_name, url: twitterUrl });
      } else {
        console.log(`  [SKIP-DUP] ${girl.shop_name} / ${girl.name}: ${twitterUrl} (shop account?)`);
        // Also remove previously assigned instance
        if (shopAccounts[twitterUrl] === 2) {
          db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ? AND shop_id = ?').run(twitterUrl, girl.shop_id);
          sessionFound--;
          totalFound--;
          results.splice(results.findIndex(r => r.url === twitterUrl && r.shop === girl.shop_name), 1);
          console.log(`    → 同店舗の前回登録も削除`);
        }
      }
    } else {
      consecutiveEmpty++;
    }

    if (rateLimited) {
      currentDelay = Math.min(MAX_DELAY_MS, currentDelay * 2);
      console.log(`  [RATE] Increased delay to ${currentDelay}ms`);
    }

    if (consecutiveEmpty >= 50) {
      console.log('\n[WARN] 50連続空結果。20秒待機...');
      await sleep(20000);
      consecutiveEmpty = 0;
      currentDelay = Math.min(MAX_DELAY_MS, currentDelay + 2000);
    }

    if (sessionSearched % BATCH_SIZE === 0) {
      saveProgress({ ...progress, found: totalFound, totalSearched, shopAccountMap: shopAccountCount });
      console.log(`  [SAVE] 進捗保存 (${progress.searched.size} searched, ${totalFound} found)`);
    }

    await sleep(currentDelay);
  }

  await browser.close();

  saveProgress({ ...progress, found: totalFound, totalSearched, shopAccountMap: shopAccountCount });

  // Final cleanup: remove any accounts assigned to 3+ girls
  const finalDupeCheck = db.prepare(`
    SELECT twitter_url, COUNT(*) as cnt
    FROM girls
    WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url
    HAVING COUNT(*) > 2
  `).all();
  if (finalDupeCheck.length > 0) {
    console.log(`\n[最終クリーンアップ] 重複アカウント ${finalDupeCheck.length} 件を削除`);
    const clearStmt = db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ?');
    for (const dupe of finalDupeCheck) {
      clearStmt.run(dupe.twitter_url);
    }
  }

  const afterCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();

  console.log('\n========================================');
  console.log('結果サマリー');
  console.log('========================================');
  console.log(`今回の検索数: ${sessionSearched}`);
  console.log(`今回の発見数: ${sessionFound}`);
  console.log(`今回の成功率: ${sessionFound > 0 ? (sessionFound / sessionSearched * 100).toFixed(1) : 0}%`);
  console.log(`所要時間: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}分`);
  console.log(`\n開始時: ${beforeCount.cnt} 件 → 終了時: ${afterCount.cnt} 件 (差分: +${afterCount.cnt - beforeCount.cnt})`);

  if (results.length > 0) {
    console.log('\n今回発見したアカウント:');
    results.forEach(r => console.log(`  ${r.shop} / ${r.name}: ${r.url}`));
  }

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
