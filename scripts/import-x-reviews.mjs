#!/usr/bin/env node
/**
 * X（Twitter）からパネマジ関連ツイートを検索し、口コミとしてDBに追加するスクリプト
 *
 * v3: 構造化ツイート（パネマジ掲示板通知）の解析を優先し、
 *     一般ツイートからも店舗・女性名のマッチングを試みる
 */

import { TwitterApi } from 'twitter-api-v2';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

const client = new TwitterApi({
  appKey: 'HGGhQIAWtSJl4NDxxvRMxCmVb',
  appSecret: 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv',
  accessToken: '2034953824427982848-7tUIvauvyXFrxJcv6YxqUFM32bxs6A',
  accessSecret: 'cTtk9BQHPvzAh8KPR0IqKkitrAfPOtHGo6MzvlCa7sH7S',
});

const SEARCH_QUERIES = [
  // Structured review tweets from panemaji site
  '新規口コミ パネマジ掲示板',
  '累計リアル度',
  'パネル通り パネマジ掲示板',
  // General review tweets
  'パネマジ デリヘル -is:retweet',
  'パネマジ 風俗 -is:retweet',
  'パネル詐欺 -is:retweet',
  '写真と違う デリヘル -is:retweet',
  'デリヘル 地雷 -is:retweet',
  'メンエス パネマジ -is:retweet',
  'ソープ パネマジ -is:retweet',
];

const RATING_KEYWORDS = {
  panel_match: ['パネル通り', '写真通り', '当たり', '大当たり', '逆パネマジ', '逆パネ', 'パネ通り'],
  panel_diff: ['まぁまぁ', '普通', '微妙', '許容範囲', 'まあまあ', 'そこそこ', '悪くない'],
  jirai: ['パネマジ', '地雷', 'パネル詐欺', '写真と違う', 'ハズレ', 'はずれ', '別人', '詐欺写真', 'パネ詐欺'],
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function determineRating(text) {
  // Check positive first for structured tweets that say "パネル通り" but also contain "パネマジ" in branding
  const hasPositive = RATING_KEYWORDS.panel_match.some(kw => text.includes(kw));
  const hasNeutral = RATING_KEYWORDS.panel_diff.some(kw => text.includes(kw));

  // For structured review tweets, "パネル通り ✅" is a clear positive marker
  if (text.includes('パネル通り ✅') || text.includes('パネル通り✅')) return 'panel_match';
  if (text.includes('パネマジ ❌') || text.includes('地雷 ❌')) return 'jirai';

  for (const kw of RATING_KEYWORDS.jirai) {
    if (text.includes(kw)) return 'jirai';
  }
  if (hasPositive) return 'panel_match';
  if (hasNeutral) return 'panel_diff';
  return null;
}

/**
 * Parse structured review notification tweets
 * Format: 🏠 ShopName 👩 GirlName さん 📊 Rating
 */
function parseStructuredReview(text) {
  const shopMatch = text.match(/🏠\s*(.+?)(?:\n|👩)/);
  const girlMatch = text.match(/👩\s*(.+?)\s*さん/);
  const ratingMatch = text.match(/📊\s*(.+?)(?:\s*[✅❌]|\n|💬|$)/);

  if (shopMatch && girlMatch) {
    const shopName = shopMatch[1].trim();
    let girlName = girlMatch[1].trim();
    let rating = null;

    if (ratingMatch) {
      const ratingText = ratingMatch[1].trim();
      if (ratingText.includes('パネル通り') || ratingText.includes('写真通り')) {
        rating = 'panel_match';
      } else if (ratingText.includes('パネマジ') || ratingText.includes('地雷')) {
        rating = 'jirai';
      } else if (ratingText.includes('微妙') || ratingText.includes('許容範囲')) {
        rating = 'panel_diff';
      }
    }

    return { shopName, girlName, rating };
  }
  return null;
}

function extractGirlNames(text) {
  const patterns = [
    /([ぁ-んァ-ヶー]{2,8})(?:ちゃん|さん|嬢)/g,
    /「([ぁ-んァ-ヶー]{2,8})」/g,
  ];
  const names = new Set();
  const excludeWords = new Set(['ちゃん', 'さん', '嬢', 'デリヘル', 'ソープ', 'ヘルス', 'パネマジ', 'パネル', 'メンエス', 'キャバ']);
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      if (!excludeWords.has(m[1])) names.add(m[1]);
    }
  }
  return [...names];
}

function buildShopIndex(shops) {
  const index = new Map();
  for (const shop of shops) {
    index.set(shop.name, [...(index.get(shop.name) || []), shop]);
    const shortName = shop.name.replace(/　/g, ' ').split(/[\s（(【「『|]/)[0];
    if (shortName.length >= 4) {
      index.set(shortName, [...(index.get(shortName) || []), shop]);
    }
  }
  return index;
}

function findShopInText(text, shopIndex) {
  const matches = [];
  const seen = new Set();
  for (const [keyword, shops] of shopIndex) {
    if (keyword.length >= 4 && text.includes(keyword)) {
      for (const shop of shops) {
        if (!seen.has(shop.id)) {
          seen.add(shop.id);
          matches.push(shop);
        }
      }
    }
  }
  return matches;
}

async function searchTweets(query) {
  try {
    const result = await client.v2.search(query, {
      max_results: 100,
      'tweet.fields': ['created_at', 'author_id', 'text'],
    });
    const tweets = [];
    if (result.data && result.data.data) {
      for (const tweet of result.data.data) {
        tweets.push({ id: tweet.id, text: tweet.text, created_at: tweet.created_at });
      }
    }
    return tweets;
  } catch (err) {
    if (err.code === 429) {
      console.log('  [RATE LIMIT] 15分待機...');
      await sleep(15 * 60 * 1000);
      return searchTweets(query);
    }
    console.error(`  [ERROR] ${query}:`, err.message || err);
    return [];
  }
}

async function main() {
  const db = new Database(DB_PATH);
  console.log('=== X口コミ収集スクリプト v3 ===\n');

  const shops = db.prepare('SELECT id, name FROM shops WHERE is_active = 1').all();
  console.log(`DB店舗数: ${shops.length}`);
  const shopIndex = buildShopIndex(shops);

  const insertReview = db.prepare(`
    INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const findGirlInShop = db.prepare(`
    SELECT g.id, g.name, s.name as shop_name
    FROM girls g JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1 AND g.name = ? AND g.shop_id = ?
  `);

  const findGirlByName = db.prepare(`
    SELECT g.id, g.name, s.name as shop_name, s.id as shop_id
    FROM girls g JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1 AND g.name = ?
  `);

  const findGirlLike = db.prepare(`
    SELECT g.id, g.name, s.name as shop_name, s.id as shop_id
    FROM girls g JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1 AND g.name LIKE ? AND g.shop_id = ?
  `);

  let totalTweets = 0;
  let insertedReviews = 0;
  const seenTweetIds = new Set();
  const results = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`\n検索: "${query}"`);
    const tweets = await searchTweets(query);
    console.log(`  ${tweets.length}件`);
    totalTweets += tweets.length;

    for (const tweet of tweets) {
      if (seenTweetIds.has(tweet.id)) continue;
      seenTweetIds.add(tweet.id);

      const text = tweet.text;
      const visitDate = tweet.created_at ? tweet.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const browserId = `x-import-${tweet.id}`;
      const comment = text.length > 200 ? text.substring(0, 197) + '...' : text;

      // 1. Structured review tweet
      const structured = parseStructuredReview(text);
      if (structured && structured.rating) {
        const { shopName, girlName, rating } = structured;
        const matchedShops = findShopInText(shopName, shopIndex);

        for (const shop of matchedShops) {
          // Try exact match
          let girls = findGirlInShop.all(girlName, shop.id);
          // Try LIKE match
          if (girls.length === 0) {
            girls = findGirlLike.all(`%${girlName}%`, shop.id);
          }
          if (girls.length > 0) {
            const girl = girls[0];
            const r = insertReview.run(girl.id, visitDate, rating, comment, browserId);
            if (r.changes > 0) {
              insertedReviews++;
              console.log(`  [INSERT] ${girl.shop_name} / ${girl.name} => ${rating}`);
              results.push({ shop: girl.shop_name, girl: girl.name, rating, tweetId: tweet.id });
            }
          } else {
            console.log(`  [NO GIRL] ${shopName} / ${girlName} (shop found, girl not in DB)`);
          }
        }
        if (matchedShops.length === 0) {
          console.log(`  [NO SHOP] ${shopName} / ${girlName}`);
        }
        continue; // Skip general matching for structured tweets
      }

      // 2. General tweet matching
      const rating = determineRating(text);
      if (!rating) continue;

      const matchedShops = findShopInText(text, shopIndex);
      const girlNames = extractGirlNames(text);
      let matched = false;

      // Shop + girl match
      if (matchedShops.length > 0 && girlNames.length > 0) {
        for (const shop of matchedShops) {
          for (const name of girlNames) {
            let girls = findGirlInShop.all(name, shop.id);
            if (girls.length === 0) girls = findGirlLike.all(`%${name}%`, shop.id);
            if (girls.length === 1 || (girls.length > 0 && findGirlInShop.all(name, shop.id).length > 0)) {
              const girl = girls[0];
              const r = insertReview.run(girl.id, visitDate, rating, comment, browserId);
              if (r.changes > 0) {
                insertedReviews++;
                console.log(`  [INSERT] ${girl.shop_name} / ${girl.name} => ${rating}`);
                results.push({ shop: girl.shop_name, girl: girl.name, rating, tweetId: tweet.id });
              }
              matched = true;
            }
          }
        }
      }

      // Unique girl name match (no ambiguity)
      if (!matched && girlNames.length > 0) {
        for (const name of girlNames) {
          if (name.length < 2) continue;
          const girls = findGirlByName.all(name);
          if (girls.length === 1) {
            const girl = girls[0];
            const r = insertReview.run(girl.id, visitDate, rating, comment, browserId);
            if (r.changes > 0) {
              insertedReviews++;
              console.log(`  [INSERT-U] ${girl.shop_name} / ${girl.name} => ${rating}`);
              results.push({ shop: girl.shop_name, girl: girl.name, rating, tweetId: tweet.id });
            }
            matched = true;
          }
        }
      }
    }

    await sleep(2000);
  }

  // Summary
  console.log('\n========================================');
  console.log('結果サマリー');
  console.log('========================================');
  console.log(`検索クエリ数: ${SEARCH_QUERIES.length}`);
  console.log(`取得ツイート数: ${totalTweets} (重複除外: ${seenTweetIds.size})`);
  console.log(`DB挿入数: ${insertedReviews}`);

  if (results.length > 0) {
    console.log('\n追加された口コミ:');
    for (const r of results) {
      console.log(`  [${r.rating}] ${r.shop} / ${r.girl} (tweet: ${r.tweetId})`);
    }
  }

  const reviewCount = db.prepare('SELECT COUNT(*) as cnt FROM reviews').get();
  console.log(`\nDB口コミ合計: ${reviewCount.cnt} 件`);

  db.close();
  console.log('\n完了！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
