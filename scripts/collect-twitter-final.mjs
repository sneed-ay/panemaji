#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウント収集 - 最終版
 *
 * 方針:
 * - DuckDuckGo検索（引用符なし = 元スクリプトと同じ方式）
 * - 上位100店舗の全在籍女性対象
 * - 名前3文字以上（2文字は誤検出多すぎ）
 * - プロフィールURLのみ採用（ステータスURLは無視）
 * - 同一アカウントが3+人に割当→全削除（店舗アカウント判定）
 * - 同一店舗内で同じアカウント2+回→削除
 * - 進捗保存で中断再開可能
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const PROGRESS_FILE = path.join(__dirname, '..', 'twitter-final-progress.json');
const MAX_SHOPS = 100;
const SEARCH_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      return { searched: new Set(data.searched || []), found: data.found || 0 };
    }
  } catch (e) {}
  return { searched: new Set(), found: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    searched: [...progress.searched],
    found: progress.found,
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
  return name.substring(0, 15);
}

function extractBestProfile(links) {
  const excluded = new Set(['search', 'explore', 'home', 'hashtag', 'i', 'settings',
    'help', 'about', 'tos', 'privacy', 'login', 'signup',
    'intent', 'share', 'compose', 'notifications', 'messages',
    'duckduckgo', 'communities', 'lists', 'elonmusk', 'x']);

  // Only profile URLs (not status/hashtag pages)
  for (const link of links) {
    const m = link.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/?(?:\?.*)?$/);
    if (!m) continue;
    const username = m[1];
    if (excluded.has(username.toLowerCase())) continue;
    return `https://x.com/${username}`;
  }
  return null;
}

async function searchDDG(page, shopName, girlName) {
  const shopKeyword = extractShopKeyword(shopName);
  const query = `site:x.com ${shopKeyword} ${girlName}`;

  try {
    await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(query), {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

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
      // Fallback selectors
      if (out.length === 0) {
        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          if ((href.includes('x.com/') || href.includes('twitter.com/')) &&
              !href.includes('duckduckgo')) {
            out.push(href);
          }
        });
      }
      return [...new Set(out)];
    });

    return extractBestProfile(links);
  } catch (err) {
    return null;
  }
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  console.log('=== パネマジ X/Twitter アカウント収集 最終版 ===\n');

  const beforeCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`開始時: twitter_url ${beforeCount.cnt} 件\n`);

  const progress = loadProgress();
  console.log(`前回: ${progress.searched.size} 件検索済み, ${progress.found} 件発見\n`);

  const girls = getTargetGirls(db);
  console.log(`対象: 上位${MAX_SHOPS}店舗の ${girls.length} 人`);

  const targetGirls = girls.filter(g => !progress.searched.has(String(g.id)));
  console.log(`未検索: ${targetGirls.length} 人\n`);

  if (targetGirls.length === 0) {
    console.log('全員検索済み。クリーンアップのみ実行。');
  } else {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let sessionFound = 0;
    let sessionSearched = 0;
    let consecutiveEmpty = 0;
    const startTime = Date.now();

    const updateStmt = db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ? AND (twitter_url IS NULL OR twitter_url = \'\')');

    for (const girl of targetGirls) {
      sessionSearched++;

      if (sessionSearched % 25 === 1 || sessionSearched <= 5) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rate = sessionSearched > 1 ? (sessionFound / sessionSearched * 100).toFixed(1) : '0.0';
        console.log(`\n[進捗] ${sessionSearched}/${targetGirls.length} | 発見: ${sessionFound} (${rate}%) | ${elapsed}分`);
      }

      const twitterUrl = await searchDDG(page, girl.shop_name, girl.name);
      progress.searched.add(String(girl.id));

      if (twitterUrl) {
        sessionFound++;
        progress.found++;
        consecutiveEmpty = 0;
        console.log(`  [FOUND] ${girl.shop_name} / ${girl.name}: ${twitterUrl}`);
        updateStmt.run(twitterUrl, girl.id);
      } else {
        consecutiveEmpty++;
      }

      if (consecutiveEmpty >= 40) {
        console.log('\n[WARN] 40連続空。15秒待機...');
        await sleep(15000);
        consecutiveEmpty = 0;
      }

      if (sessionSearched % 100 === 0) {
        saveProgress(progress);
        console.log(`  [SAVE] ${progress.searched.size} searched, ${progress.found} found`);
      }

      await sleep(SEARCH_DELAY_MS);
    }

    await browser.close();
    saveProgress(progress);

    console.log(`\n検索完了: ${sessionSearched} 件検索, ${sessionFound} 件発見`);
    console.log(`所要時間: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)}分`);
  }

  // === クリーンアップフェーズ ===
  console.log('\n=== クリーンアップ ===');

  // 1. 同一アカウントが3人以上に割当 → 全削除
  const dupes3 = db.prepare(`
    SELECT twitter_url, COUNT(*) as cnt, GROUP_CONCAT(name, ', ') as names
    FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url HAVING COUNT(*) >= 3
  `).all();
  if (dupes3.length > 0) {
    console.log(`\n3人以上に割当されたアカウント (${dupes3.length} 件):`);
    for (const d of dupes3) {
      console.log(`  ${d.twitter_url}: ${d.cnt}人 (${d.names.substring(0, 60)})`);
      db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ?').run(d.twitter_url);
    }
  }

  // 2. 同一店舗内で同じアカウント2回以上 → 全削除
  const shopDupes = db.prepare(`
    SELECT twitter_url, shop_id, COUNT(*) as cnt
    FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url, shop_id HAVING COUNT(*) >= 2
  `).all();
  if (shopDupes.length > 0) {
    console.log(`\n同一店舗内で重複したアカウント (${shopDupes.length} 件):`);
    for (const d of shopDupes) {
      console.log(`  ${d.twitter_url} (shop ${d.shop_id}): ${d.cnt}人`);
      db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ? AND shop_id = ?').run(d.twitter_url, d.shop_id);
    }
  }

  // 3. 全体で2回重複もcheck
  const dupes2 = db.prepare(`
    SELECT twitter_url, COUNT(*) as cnt
    FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''
    GROUP BY twitter_url HAVING COUNT(*) >= 2
  `).all();
  if (dupes2.length > 0) {
    console.log(`\n2人以上に割当されたアカウント (${dupes2.length} 件) → 削除`);
    for (const d of dupes2) {
      db.prepare('UPDATE girls SET twitter_url = NULL WHERE twitter_url = ?').run(d.twitter_url);
    }
  }

  const afterCount = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();

  console.log('\n========================================');
  console.log('最終結果');
  console.log('========================================');
  console.log(`開始時: ${beforeCount.cnt} 件 → 終了時: ${afterCount.cnt} 件 (+${afterCount.cnt - beforeCount.cnt})`);

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
