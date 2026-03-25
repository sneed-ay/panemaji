#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウントをDuckDuckGo検索で収集するスクリプト v3
 *
 * 精度重視:
 * - DuckDuckGoで検索 → 候補を取得
 * - 候補のXプロフィールページを訪問して、bio/descriptionに店舗名や業界キーワードが含まれるか確認
 * - 確認できた場合のみDBに保存
 * - 上位100店舗、全在籍女性対象
 * - 進捗保存で中断再開可能
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const PROGRESS_FILE = path.join(__dirname, '..', 'twitter-collect-v3-progress.json');
const MAX_SHOPS = 100;
const SEARCH_DELAY_MS = 3000;
const PROFILE_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Industry keywords that indicate the X account belongs to someone in the industry
const INDUSTRY_KEYWORDS = [
  'デリヘル', 'ヘルス', 'ソープ', 'デリバリー', '風俗', '出勤',
  '予約', 'お仕事', 'キャスト', 'セラピスト', 'コンパニオン',
  '在籍', '写メ日記', 'ヘブン', 'シティヘブン', 'cityheaven',
  'バック率', '指名', '本指名', 'フリー', 'お店', '待機',
  'メンエス', 'アロマ', 'エステ', 'リフレ', 'ピンサロ',
  '嬢', 'キャバ', 'ガールズバー', 'ホテヘル',
  '性感', 'M性感', 'SM', 'イメクラ', 'オナクラ',
  'パネマジ', '口コミ', 'レビュー',
];

// Short generic names that produce too many false results
const SKIP_NAMES = new Set([
  'あい', 'まい', 'ゆい', 'りん', 'るい', 'ゆう', 'れい', 'めい', 'らん', 'あん',
  'みう', 'みお', 'りお', 'のあ', 'すず', 'もも', 'はな', 'さら', 'えま', 'ひな',
  'かな', 'ゆな', 'あや', 'れな', 'みな', 'りな', 'まな', 'せな', 'そら', 'るな',
  'みき', 'りか', 'みか', 'えり', 'ゆき', 'あか', 'しお', 'しの', 'なお', 'まお',
  'りく', 'つき', 'ここ', 'なな', 'もえ', 'うた', 'えん', 'こう', 'さや', 'ちぃ',
  'ふう', 'まき', 'まゆ', 'みよ', 'めめ', 'にき', 'ある', 'こん', 'しろ', 'てる',
  'はお', 'みこ', 'もか', 'よる', 'える', 'なつ', 'あき', 'りず', 'にも', 'すあ',
]);

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return {
        searched: new Set(data.searched || []),
        found: data.found || 0,
        totalSearched: data.totalSearched || 0,
      };
    }
  } catch (e) {}
  return { searched: new Set(), found: 0, totalSearched: 0 };
}

function saveProgress(progress) {
  const data = {
    searched: [...progress.searched],
    found: progress.found,
    totalSearched: progress.totalSearched,
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
      AND LENGTH(g.name) <= 10
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

function extractShopShortNames(shopName) {
  // Generate multiple short keywords from the shop name for bio matching
  const names = [];
  let clean = shopName
    .replace(/　/g, ' ').replace(/\s+/g, ' ')
    .replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '').replace(/「[^」]*」/g, '')
    .replace(/『[^』]*』/g, '').replace(/[～〜]/g, '')
    .trim();

  names.push(clean);
  // Split by spaces and add each part >= 3 chars
  for (const part of clean.split(/[\s　]/)) {
    if (part.length >= 3) names.push(part);
  }
  // Add without spaces
  names.push(clean.replace(/\s/g, ''));

  return [...new Set(names)].map(n => n.toLowerCase());
}

/**
 * Extract x.com profile URLs from DuckDuckGo search results
 */
async function searchDDG(page, shopName, girlName) {
  const shopKeyword = extractShopKeyword(shopName);
  // Use quotes for exact match
  const query = `"${girlName}" "${shopKeyword}" site:x.com`;

  try {
    await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    await sleep(500);

    // Check for rate limiting
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    if (pageText.includes('CAPTCHA') || pageText.includes('automated')) {
      console.log('    [RATE LIMITED] Waiting 60s...');
      await sleep(60000);
      return [];
    }

    const noResults = await page.evaluate(() => {
      return document.body.innerText.includes('結果は見つかりません') ||
             document.body.innerText.includes('No results');
    });

    if (noResults) {
      // Retry without quotes
      const query2 = `${girlName} ${shopKeyword} site:x.com`;
      await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query2), {
        waitUntil: 'networkidle2',
        timeout: 20000
      });
      await sleep(500);
    }

    // Extract all x.com links from results
    const links = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        if ((href.includes('x.com/') || href.includes('twitter.com/')) &&
            !href.includes('duckduckgo.com')) {
          out.push(href);
        }
      });
      return [...new Set(out)];
    });

    // Extract unique profile usernames (not status/post URLs)
    const excluded = new Set(['search', 'explore', 'home', 'hashtag', 'i', 'settings',
      'help', 'about', 'tos', 'privacy', 'login', 'signup',
      'intent', 'share', 'compose', 'notifications', 'messages',
      'duckduckgo', 'communities', 'lists', 'elonmusk', 'x']);

    const profiles = [];
    for (const link of links) {
      // Only profile URLs (no /status/, /hashtag/, etc.)
      const m = link.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/?$/);
      if (!m) continue;
      const username = m[1];
      if (excluded.has(username.toLowerCase())) continue;
      if (!profiles.includes(username)) {
        profiles.push(username);
      }
    }

    return profiles.slice(0, 3); // Max 3 candidates
  } catch (err) {
    return [];
  }
}

/**
 * Visit X profile and check if bio matches the girl/shop
 */
async function verifyXProfile(page, username, girlName, shopName) {
  const shopNames = extractShopShortNames(shopName);

  try {
    await page.goto(`https://x.com/${username}`, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    await sleep(1000);

    // Extract bio/description text
    const profileInfo = await page.evaluate(() => {
      // Get the bio text - X uses data-testid="UserDescription"
      const bioEl = document.querySelector('[data-testid="UserDescription"]');
      const bio = bioEl ? bioEl.textContent : '';

      // Get display name
      const nameEl = document.querySelector('[data-testid="UserName"]');
      const displayName = nameEl ? nameEl.textContent : '';

      // Get the whole profile text area
      const profileHeader = document.querySelector('[data-testid="UserProfileHeader_Items"]');
      const headerText = profileHeader ? profileHeader.textContent : '';

      // Get location
      const locEl = document.querySelector('[data-testid="UserLocation"]');
      const location = locEl ? locEl.textContent : '';

      // Get pinned tweet if any
      const pinnedEl = document.querySelector('[data-testid="tweet"] [data-testid="tweetText"]');
      const pinned = pinnedEl ? pinnedEl.textContent : '';

      return {
        bio: bio.toLowerCase(),
        displayName: displayName.toLowerCase(),
        headerText: headerText.toLowerCase(),
        location: location.toLowerCase(),
        pinned: pinned.toLowerCase(),
        fullText: (bio + ' ' + displayName + ' ' + headerText + ' ' + location + ' ' + pinned).toLowerCase()
      };
    });

    if (!profileInfo.fullText || profileInfo.fullText.length < 5) {
      return { verified: false, reason: 'empty profile' };
    }

    const text = profileInfo.fullText;

    // Check if shop name appears in profile
    const shopMatch = shopNames.some(sn => text.includes(sn.toLowerCase()));
    if (shopMatch) {
      return { verified: true, reason: 'shop name in profile' };
    }

    // Check if industry keywords appear
    const industryMatch = INDUSTRY_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    if (industryMatch) {
      // Also check if girl's name appears in display name or bio
      if (text.includes(girlName.toLowerCase()) || text.includes(girlName)) {
        return { verified: true, reason: 'industry keyword + name match' };
      }
      // Industry keyword alone with the name in search - medium confidence
      return { verified: true, reason: 'industry keyword in profile' };
    }

    return { verified: false, reason: 'no match' };
  } catch (err) {
    return { verified: false, reason: 'error: ' + err.message };
  }
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  console.log('=== パネマジ X/Twitter アカウント収集スクリプト v3 (精度重視) ===\n');

  const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`開始時点のtwitter_url保有数: ${beforeCount.cnt} 件\n`);

  const progress = loadProgress();
  let totalFound = progress.found;
  let totalSearched = progress.totalSearched;
  console.log(`前回の進捗: ${progress.searched.size} 件検索済み, ${totalFound} 件発見\n`);

  const girls = getTargetGirls(db);
  console.log(`対象: 上位${MAX_SHOPS}店舗の ${girls.length} 人`);

  const targetGirls = girls.filter(g => {
    if (progress.searched.has(String(g.id))) return false;
    if (SKIP_NAMES.has(g.name)) return false;
    return true;
  });

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

  const searchPage = await browser.newPage();
  await searchPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const profilePage = await browser.newPage();
  await profilePage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let sessionFound = 0;
  let sessionSearched = 0;
  let consecutiveEmpty = 0;
  const results = [];
  const startTime = Date.now();

  const updateStmt = db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ? AND (twitter_url IS NULL OR twitter_url = \'\')');

  for (const girl of targetGirls) {
    sessionSearched++;
    totalSearched++;

    if (sessionSearched % 10 === 1 || sessionSearched <= 5) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = sessionSearched > 1 ? (sessionFound / sessionSearched * 100).toFixed(1) : '0.0';
      console.log(`\n[進捗] ${sessionSearched}/${targetGirls.length} | 発見: ${sessionFound} (${rate}%) | ${elapsed}分経過`);
    }

    // Step 1: Search DuckDuckGo for candidates
    const candidates = await searchDDG(searchPage, girl.shop_name, girl.name);
    progress.searched.add(String(girl.id));

    if (candidates.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 50) {
        console.log('\n[WARN] 50連続空結果。30秒待機...');
        await sleep(30000);
        consecutiveEmpty = 0;
      }
      await sleep(SEARCH_DELAY_MS);
      continue;
    }

    // Step 2: Verify each candidate by visiting profile
    let matched = false;
    for (const username of candidates) {
      const { verified, reason } = await verifyXProfile(profilePage, username, girl.name, girl.shop_name);

      if (verified) {
        const url = `https://x.com/${username}`;
        sessionFound++;
        totalFound++;
        consecutiveEmpty = 0;
        console.log(`  [VERIFIED] ${girl.shop_name} / ${girl.name}: ${url} (${reason})`);
        updateStmt.run(url, girl.id);
        results.push({ id: girl.id, name: girl.name, shop: girl.shop_name, url, reason });
        matched = true;
        break;
      }

      await sleep(PROFILE_DELAY_MS);
    }

    if (!matched) {
      consecutiveEmpty++;
    }

    // Save progress every 25 searches
    if (sessionSearched % 25 === 0) {
      saveProgress({ ...progress, found: totalFound, totalSearched });
      console.log(`  [SAVE] 進捗保存 (${progress.searched.size} searched, ${totalFound} found)`);
    }

    await sleep(SEARCH_DELAY_MS);
  }

  await browser.close();

  saveProgress({ ...progress, found: totalFound, totalSearched });

  const afterCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();

  console.log('\n========================================');
  console.log('結果サマリー');
  console.log('========================================');
  console.log(`今回の検索数: ${sessionSearched}`);
  console.log(`今回の発見・検証数: ${sessionFound}`);
  console.log(`成功率: ${sessionFound > 0 ? (sessionFound / sessionSearched * 100).toFixed(1) : 0}%`);
  console.log(`所要時間: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}分`);
  console.log(`\n開始時: ${beforeCount.cnt} 件 → 終了時: ${afterCount.cnt} 件 (差分: +${afterCount.cnt - beforeCount.cnt})`);

  if (results.length > 0) {
    console.log('\n今回発見・検証したアカウント:');
    results.forEach(r => console.log(`  ${r.shop} / ${r.name}: ${r.url} [${r.reason}]`));
  }

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
