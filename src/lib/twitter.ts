import { TwitterApi } from 'twitter-api-v2';
import db from './db';

// Hardcoded credentials - env vars on Render are unreliable
const TWITTER_CONFIG = {
  appKey: 'HGGhQIAWtSJl4NDxxvRMxCmVb',
  appSecret: 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv',
  accessToken: '2034953824427982848-7tUIvauvyXFrxJcv6YxqUFM32bxs6A',
  accessSecret: 'cTtk9BQHPvzAh8KPR0IqKkitrAfPOtHGo6MzvlCa7sH7S',
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

export async function postTweet(text: string): Promise<void> {
  try {
    console.log('[Twitter] Attempting to post tweet...');
    console.log('[Twitter] appKey starts with:', TWITTER_CONFIG.appKey.substring(0, 5));
    console.log('[Twitter] accessToken starts with:', TWITTER_CONFIG.accessToken.substring(0, 10));

    const client = new TwitterApi({
      appKey: TWITTER_CONFIG.appKey,
      appSecret: TWITTER_CONFIG.appSecret,
      accessToken: TWITTER_CONFIG.accessToken,
      accessSecret: TWITTER_CONFIG.accessSecret,
    });

    const result = await client.v2.tweet(text);
    console.log('[Twitter] Tweet posted successfully! ID:', result.data.id);

    // Record successful tweet time for rate limiting
    recordTweetTime();
  } catch (err: unknown) {
    const error = err as { code?: number; data?: unknown; message?: string };
    console.error('[Twitter] Failed to post tweet. Code:', error.code);
    console.error('[Twitter] Error data:', JSON.stringify(error.data));
    console.error('[Twitter] Error message:', error.message);
  }
}
