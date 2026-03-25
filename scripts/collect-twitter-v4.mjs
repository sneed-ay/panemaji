#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウントをDuckDuckGo検索で収集するスクリプト v4
 *
 * 方針:
 * 1. 名前3文字以上の女性のみ対象（2文字は誤検出が多すぎる）
 * 2. DuckDuckGo検索でX候補を取得
 * 3. Xプロフィールを訪問して検証:
 *    - 店舗公式アカウント（同店舗で2回以上出現）は除外
 *    - bioに店舗名 or 業界キーワード + 名前 → 高信頼度で採用
 * 4. 進捗保存で中断再開可能
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const PROGRESS_FILE = path.join(__dirname, '..', 'twitter-v4-progress.json');
const MAX_SHOPS = 100;
const SEARCH_DELAY_MS = 3000;
const PROFILE_DELAY_MS = 1200;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const INDUSTRY_KEYWORDS = [
  'デリヘル', 'ヘルス', 'ソープ', 'デリバリー', '風俗', '出勤',
  '予約', 'キャスト', 'セラピスト', 'コンパニオン',
  '在籍', '写メ日記', 'ヘブン', 'シティヘブン', 'cityheaven',
  '指名', '本指名', 'メンエス', 'アロマ', 'エステ', 'リフレ',
  '性感', 'イメクラ', 'オナクラ', 'ピンサロ', 'ホテヘル',
  'パネマジ', '嬢', '待機中', 'お仕事', 'バック率',
];

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return {
        searched: new Set(data.searched || []),
        found: data.found || 0,
        shopAccounts: new Map(Object.entries(data.shopAccounts || {})),
        knownShopAccounts: new Set(data.knownShopAccounts || []),
      };
    }
  } catch (e) {}
  return { searched: new Set(), found: 0, shopAccounts: new Map(), knownShopAccounts: new Set() };
}

function saveProgress(progress) {
  const data = {
    searched: [...progress.searched],
    found: progress.found,
    shopAccounts: Object.fromEntries(progress.shopAccounts),
    knownShopAccounts: [...progress.knownShopAccounts],
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

function extractShopShortNames(shopName) {
  const names = [];
  let clean = shopName
    .replace(/　/g, ' ').replace(/\s+/g, ' ')
    .replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '').replace(/「[^」]*」/g, '')
    .replace(/『[^』]*』/g, '').replace(/[～〜]/g, '')
    .trim();
  names.push(clean);
  for (const part of clean.split(/[\s　]/)) {
    if (part.length >= 3) names.push(part);
  }
  names.push(clean.replace(/\s/g, ''));
  return [...new Set(names)].map(n => n.toLowerCase());
}

async function searchDDG(page, shopName, girlName) {
  const shopKeyword = extractShopKeyword(shopName);
  const query = `${girlName} ${shopKeyword} site:x.com`;

  try {
    await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    await sleep(600);

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
    if (noResults) return [];

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

    const excluded = new Set(['search', 'explore', 'home', 'hashtag', 'i', 'settings',
      'help', 'about', 'tos', 'privacy', 'login', 'signup',
      'intent', 'share', 'compose', 'notifications', 'messages',
      'duckduckgo', 'communities', 'lists', 'elonmusk', 'x']);

    const profiles = [];
    for (const link of links) {
      const m = link.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/?$/);
      if (!m) continue;
      const username = m[1];
      if (excluded.has(username.toLowerCase())) continue;
      if (!profiles.includes(username)) profiles.push(username);
    }

    return profiles.slice(0, 3);
  } catch (err) {
    return [];
  }
}

async function verifyXProfile(page, username, girlName, shopName) {
  const shopNames = extractShopShortNames(shopName);

  try {
    await page.goto(`https://x.com/${username}`, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    await sleep(800);

    const profileInfo = await page.evaluate(() => {
      const bioEl = document.querySelector('[data-testid="UserDescription"]');
      const bio = bioEl ? bioEl.textContent : '';
      const nameEl = document.querySelector('[data-testid="UserName"]');
      const displayName = nameEl ? nameEl.textContent : '';
      const headerEl = document.querySelector('[data-testid="UserProfileHeader_Items"]');
      const headerText = headerEl ? headerEl.textContent : '';
      const locEl = document.querySelector('[data-testid="UserLocation"]');
      const location = locEl ? locEl.textContent : '';

      return {
        bio,
        displayName,
        headerText,
        location,
        fullText: (bio + ' ' + displayName + ' ' + headerText + ' ' + location)
      };
    });

    if (!profileInfo.fullText || profileInfo.fullText.length < 3) {
      return { verified: false, reason: 'empty profile', isShopAccount: false };
    }

    const text = profileInfo.fullText.toLowerCase();
    const bioText = profileInfo.bio.toLowerCase();
    const nameText = profileInfo.displayName.toLowerCase();

    // Check if shop name appears in profile
    const shopMatch = shopNames.some(sn => text.includes(sn.toLowerCase()));

    // Check industry keywords
    const industryMatch = INDUSTRY_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));

    // Check if girl's name appears
    const nameMatch = text.includes(girlName.toLowerCase()) || text.includes(girlName);

    // Detect shop accounts: bio contains "公式" or "official" or "店舗" or "オフィシャル"
    const isShopAccount = text.includes('公式') || text.includes('official') ||
                          text.includes('オフィシャル') || text.includes('スタッフ') ||
                          text.includes('店長');

    if (isShopAccount) {
      return { verified: false, reason: 'shop/official account', isShopAccount: true };
    }

    // High confidence: shop name + girl's name in bio
    if (shopMatch && nameMatch) {
      return { verified: true, reason: 'shop name + name in bio', isShopAccount: false };
    }

    // Medium-high: industry keyword + name in bio/display name
    if (industryMatch && nameMatch) {
      return { verified: true, reason: 'industry keyword + name', isShopAccount: false };
    }

    // Medium: shop name in bio (could be a girl who works there)
    if (shopMatch) {
      return { verified: true, reason: 'shop name in bio', isShopAccount: false };
    }

    // Lower confidence: industry keyword + name partially in username
    if (industryMatch) {
      const userLower = username.toLowerCase();
      // Check if girl's name (in romaji-ish) might be in username
      // This is a loose check
      return { verified: true, reason: 'industry keyword in bio', isShopAccount: false };
    }

    return { verified: false, reason: 'no match', isShopAccount: false };
  } catch (err) {
    return { verified: false, reason: 'error', isShopAccount: false };
  }
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  console.log('=== パネマジ X/Twitter アカウント収集スクリプト v4 ===\n');

  const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`開始時点のtwitter_url保有数: ${beforeCount.cnt} 件\n`);

  const progress = loadProgress();
  console.log(`前回の進捗: ${progress.searched.size} 件検索済み, ${progress.found} 件発見`);
  console.log(`既知の店舗アカウント: ${progress.knownShopAccounts.size} 件\n`);

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

  const searchPage = await browser.newPage();
  await searchPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const profilePage = await browser.newPage();
  await profilePage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let sessionFound = 0;
  let sessionSearched = 0;
  let consecutiveEmpty = 0;
  const results = [];
  const startTime = Date.now();

  // Track accounts per shop to detect shop accounts
  const shopAccountUsage = {}; // shopId -> { username: count }

  const updateStmt = db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ? AND (twitter_url IS NULL OR twitter_url = \'\')');

  for (const girl of targetGirls) {
    sessionSearched++;

    if (sessionSearched % 10 === 1 || sessionSearched <= 5) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = sessionSearched > 1 ? (sessionFound / sessionSearched * 100).toFixed(1) : '0.0';
      console.log(`\n[進捗] ${sessionSearched}/${targetGirls.length} | 発見: ${sessionFound} (${rate}%) | ${elapsed}分経過`);
    }

    // Search DuckDuckGo
    const candidates = await searchDDG(searchPage, girl.shop_name, girl.name);
    progress.searched.add(String(girl.id));

    if (candidates.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 40) {
        console.log('\n[WARN] 40連続空結果。30秒待機...');
        await sleep(30000);
        consecutiveEmpty = 0;
      }
      await sleep(SEARCH_DELAY_MS);
      continue;
    }

    // Filter out known shop accounts
    const filteredCandidates = candidates.filter(u => !progress.knownShopAccounts.has(u.toLowerCase()));

    if (filteredCandidates.length === 0) {
      consecutiveEmpty++;
      await sleep(SEARCH_DELAY_MS);
      continue;
    }

    // Verify profiles
    let matched = false;
    for (const username of filteredCandidates) {
      const { verified, reason, isShopAccount } = await verifyXProfile(profilePage, username, girl.name, girl.shop_name);

      if (isShopAccount) {
        progress.knownShopAccounts.add(username.toLowerCase());
        console.log(`  [SHOP] ${username} は店舗/公式アカウント → 除外リストに追加`);
        continue;
      }

      if (verified) {
        // Track per-shop usage
        const shopKey = String(girl.shop_id);
        if (!shopAccountUsage[shopKey]) shopAccountUsage[shopKey] = {};
        const usage = shopAccountUsage[shopKey];
        usage[username] = (usage[username] || 0) + 1;

        if (usage[username] > 1) {
          // This account appeared for multiple girls in the same shop = shop account
          progress.knownShopAccounts.add(username.toLowerCase());
          console.log(`  [SHOP-DUP] ${username} が同店舗で複数回出現 → 店舗アカウント判定`);
          // Revert previous assignment
          db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ? AND shop_id = ?')
            .run(`https://x.com/${username}`, girl.shop_id);
          const prevIdx = results.findIndex(r => r.url === `https://x.com/${username}`);
          if (prevIdx >= 0) {
            results.splice(prevIdx, 1);
            sessionFound--;
          }
          continue;
        }

        const url = `https://x.com/${username}`;
        sessionFound++;
        consecutiveEmpty = 0;
        console.log(`  [VERIFIED] ${girl.shop_name} / ${girl.name}: ${url} (${reason})`);
        updateStmt.run(url, girl.id);
        results.push({ id: girl.id, name: girl.name, shop: girl.shop_name, url, reason });
        matched = true;
        break;
      }

      await sleep(PROFILE_DELAY_MS);
    }

    if (!matched) consecutiveEmpty++;

    if (sessionSearched % 25 === 0) {
      progress.found += sessionFound;
      sessionFound = 0;
      saveProgress(progress);
      const totalNow = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
      console.log(`  [SAVE] 進捗保存 | DB twitter_url: ${totalNow.cnt} 件 | 店舗アカウント除外: ${progress.knownShopAccounts.size} 件`);
    }

    await sleep(SEARCH_DELAY_MS);
  }

  await browser.close();

  progress.found += sessionFound;
  saveProgress(progress);

  // Final cleanup
  const dupes = db.prepare(`
    SELECT twitter_url, COUNT(*) as cnt FROM girls
    WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url HAVING COUNT(*) > 1
  `).all();
  if (dupes.length > 0) {
    console.log(`\n[最終クリーンアップ] ${dupes.length} 件の重複アカウントを削除`);
    const clearStmt = db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ?');
    for (const d of dupes) {
      clearStmt.run(d.twitter_url);
    }
  }

  const afterCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();

  console.log('\n========================================');
  console.log('結果サマリー');
  console.log('========================================');
  console.log(`検索数: ${sessionSearched + (progress.searched.size - sessionSearched)}`);
  console.log(`発見・検証数: ${results.length}`);
  console.log(`所要時間: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}分`);
  console.log(`\n開始時: ${beforeCount.cnt} 件 → 終了時: ${afterCount.cnt} 件 (差分: +${afterCount.cnt - beforeCount.cnt})`);
  console.log(`店舗アカウント除外リスト: ${progress.knownShopAccounts.size} 件`);

  if (results.length > 0) {
    console.log('\n発見・検証したアカウント:');
    results.forEach(r => console.log(`  ${r.shop} / ${r.name}: ${r.url} [${r.reason}]`));
  }

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
