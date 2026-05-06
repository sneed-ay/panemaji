import { TwitterApi } from 'twitter-api-v2';
import db from './db';

// X account: @aichan_ura_ai (ura_ai@sneed.jp)
//
// 認証情報は環境変数から読む。Render の Environment にて以下を設定:
//   TWITTER_APP_KEY, TWITTER_APP_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
//
// セキュリティ: 旧キーはリポ public で漏洩したため X dashboard で revoke 推奨。
// 現状アカウント停止中で `postTweet()` 自体が早期 return しているため、
// 環境変数未設定でも実害はない (canTweetNow は DB 読みのみで API 呼ばない)。
const TWITTER_CONFIG = {
  appKey: process.env.TWITTER_APP_KEY || '',
  appSecret: process.env.TWITTER_APP_SECRET || '',
  accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
  accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
};

const TWEET_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Check if enough time has passed since the last tweet.
 * Returns true if tweeting is allowed (>= 10 min since last tweet).
 */
export function canTweetNow(): boolean {
  const row = db.prepare("SELECT value FROM tweet_settings WHERE key = 'last_tweet_at'").get() as { value: string } | undefined;
  if (!row) return true;

  const lastTweetAt = new Date(row.value).getTime();
  const now = Date.now();
  return now - lastTweetAt >= TWEET_INTERVAL_MS;
}

/**
 * Record the current time as the last tweet timestamp.
 */
function recordTweetTime(): void {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO tweet_settings (key, value) VALUES ('last_tweet_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(now);
}

/**
 * Post a tweet (text only, OGP card handles the image via link preview)
 */
export async function postTweet(text: string): Promise<void> {
  // X account suspended - disable posting
  console.log('[Twitter] Posting disabled (account suspended)');
  return;

  // 環境変数未設定時はガード (アカウント復活後の安全装置)
  if (!TWITTER_CONFIG.appKey || !TWITTER_CONFIG.appSecret || !TWITTER_CONFIG.accessToken || !TWITTER_CONFIG.accessSecret) {
    console.warn('[Twitter] env vars not set - skip post:', text.slice(0, 50));
    return;
  }

  try {
    console.log('[Twitter] Posting tweet...');

    const client = new TwitterApi({
      appKey: TWITTER_CONFIG.appKey,
      appSecret: TWITTER_CONFIG.appSecret,
      accessToken: TWITTER_CONFIG.accessToken,
      accessSecret: TWITTER_CONFIG.accessSecret,
    });

    const result = await client.v2.tweet(text);
    console.log('[Twitter] Tweet posted! ID:', result.data.id);

    recordTweetTime();
  } catch (err: unknown) {
    const error = err as { code?: number; data?: unknown; message?: string };
    console.error('[Twitter] Failed to post tweet. Code:', error.code);
    console.error('[Twitter] Error data:', JSON.stringify(error.data));
    console.error('[Twitter] Error message:', error.message);
  }
}
