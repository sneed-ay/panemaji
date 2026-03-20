#!/usr/bin/env node
/**
 * パネマジ掲示板の女性のXアカウントをGoogle検索で収集するスクリプト
 *
 * 戦略:
 * 1. 在籍数の多い店舗から優先的に女性を取得
 * 2. Google検索で site:x.com OR site:twitter.com "店舗名" "女性名" を検索
 * 3. 見つかったプロフィールURLをDBに保存
 */

const Database = require('better-sqlite3');
const puppeteer = require('puppeteer');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'panemaji.db');
const SEARCH_DELAY_MS = 4000; // Google検索の間隔（4秒）
const MAX_SHOPS = 50; // 上位50店舗
const BATCH_SIZE = 10; // 進捗報告の単位

// --- DB操作 ---
function getTargetGirls(db) {
  // 在籍数の多い上位店舗の女性を取得（twitter_urlが未設定のもの）
  const stmt = db.prepare(`
    SELECT g.id, g.name, s.name as shop_name, s.id as shop_id
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1
      AND (g.twitter_url IS NULL OR g.twitter_url = '')
      AND s.id IN (
        SELECT s2.id FROM shops s2
        JOIN girls g2 ON g2.shop_id = s2.id
        WHERE g2.is_active = 1
        GROUP BY s2.id
        ORDER BY COUNT(g2.id) DESC
        LIMIT ?
      )
    ORDER BY s.id, g.id
  `);
  return stmt.all(MAX_SHOPS);
}

function updateTwitterUrl(db, girlId, twitterUrl) {
  const stmt = db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ?');
  stmt.run(twitterUrl, girlId);
}

// --- Google検索 ---
function buildSearchQuery(shopName, girlName) {
  // 店舗名から余計な修飾を除く（短縮）
  const cleanShop = shopName
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `site:x.com OR site:twitter.com "${cleanShop}" "${girlName}"`;
}

function extractTwitterUrl(url) {
  // x.com or twitter.com のプロフィールURLを抽出
  const match = url.match(/https?:\/\/(x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/?$/);
  if (match) {
    const username = match[2].toLowerCase();
    // 検索結果やヘルプページを除外
    const excluded = ['search', 'explore', 'home', 'hashtag', 'i', 'settings',
                      'help', 'about', 'tos', 'privacy', 'login', 'signup'];
    if (excluded.includes(username)) return null;
    return `https://x.com/${match[2]}`;
  }
  return null;
}

async function searchGoogle(page, query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=ja`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // CAPTCHA検出
    const content = await page.content();
    if (content.includes('captcha') || content.includes('unusual traffic') || content.includes('sorry')) {
      console.log('  [WARN] Google CAPTCHA detected, waiting 30s...');
      await sleep(30000);
      return [];
    }

    // 検索結果からリンクを抽出
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      return Array.from(anchors)
        .map(a => a.href)
        .filter(href => href.includes('x.com/') || href.includes('twitter.com/'));
    });

    return links;
  } catch (err) {
    console.log(`  [ERROR] Search failed: ${err.message}`);
    return [];
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- メイン処理 ---
async function main() {
  const db = new Database(DB_PATH);

  console.log('=== パネマジ X/Twitter アカウント収集スクリプト ===\n');

  // 対象の女性を取得
  const girls = getTargetGirls(db);
  console.log(`対象: 上位${MAX_SHOPS}店舗から ${girls.length} 人の女性\n`);

  if (girls.length === 0) {
    console.log('対象の女性がいません。終了します。');
    db.close();
    return;
  }

  // ユニークな店舗名を表示
  const uniqueShops = [...new Set(girls.map(g => g.shop_name))];
  console.log(`対象店舗数: ${uniqueShops.length}`);
  console.log(`最初の10店舗: ${uniqueShops.slice(0, 10).join(', ')}\n`);

  // Puppeteerブラウザ起動
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let found = 0;
  let searched = 0;
  let errors = 0;
  const results = [];

  // 名前が一般的すぎるものをスキップ（1文字の名前など）
  const filteredGirls = girls.filter(g => g.name.length >= 2);
  console.log(`検索対象（2文字以上の名前）: ${filteredGirls.length} 人\n`);

  // 検索数を制限（最大500件）
  const targetGirls = filteredGirls.slice(0, 500);

  for (const girl of targetGirls) {
    searched++;

    const query = buildSearchQuery(girl.shop_name, girl.name);

    if (searched % BATCH_SIZE === 1 || searched === 1) {
      console.log(`--- 進捗: ${searched}/${targetGirls.length} (発見: ${found}) ---`);
    }

    const links = await searchGoogle(page, query);

    // リンクからTwitter URLを抽出
    let twitterUrl = null;
    for (const link of links) {
      const extracted = extractTwitterUrl(link);
      if (extracted) {
        twitterUrl = extracted;
        break;
      }
    }

    if (twitterUrl) {
      found++;
      console.log(`  [FOUND] ${girl.shop_name} - ${girl.name}: ${twitterUrl}`);
      updateTwitterUrl(db, girl.id, twitterUrl);
      results.push({ id: girl.id, name: girl.name, shop: girl.shop_name, url: twitterUrl });
    }

    // レート制限対策
    await sleep(SEARCH_DELAY_MS);

    // 10回連続でCAPTCHAに引っかかったら終了
    if (errors > 10) {
      console.log('\n[ABORT] Too many errors. Stopping.');
      break;
    }
  }

  await browser.close();

  // 結果サマリー
  console.log('\n=== 結果サマリー ===');
  console.log(`検索数: ${searched}`);
  console.log(`発見数: ${found}`);
  console.log(`成功率: ${searched > 0 ? (found / searched * 100).toFixed(1) : 0}%`);

  if (results.length > 0) {
    console.log('\n発見したアカウント:');
    results.forEach(r => {
      console.log(`  ${r.shop} - ${r.name}: ${r.url}`);
    });
  }

  // DB確認
  const totalTwitter = db.prepare("SELECT COUNT(*) as cnt FROM girls WHERE twitter_url IS NOT NULL AND twitter_url <> ''").get();
  console.log(`\nDB内のtwitter_url設定済み: ${totalTwitter.cnt} 件`);

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
