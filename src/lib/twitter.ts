import { TwitterApi } from 'twitter-api-v2';
import db from './db';

// ===== 新Xアカウント情報 =====
// 旧アカウントがBANされたため、以下の新アカウントに切り替え予定
// ID: @aichan_ura_ai
// メアド: ura_ai@sneed.jp
// ステータス: X Developer PortalでOAuth認証をやり直す必要あり
// TODO: OAuth認証完了後、下記のAPIキーを新アカウントのものに差し替えること
// ================================

// Hardcoded credentials - env vars on Render are unreliable
// ※旧アカウント(BAN済み)のキー。新アカウントのOAuth設定完了後に差し替え
const TWITTER_CONFIG = {
  appKey: 'HGGhQIAWtSJl4NDxxvRMxCmVb',
  appSecret: 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv',
  accessToken: '2035202106597285891-0gxs1jo60zQubdH5LvcRdR9MEionAV',
  accessSecret: 'HMllldHQKJycTMCNQrqfWrHG4RneoboGWSHyZ3mf6inS2',
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
  // X account suspended - disable posting until new account is set up
  console.log('[Twitter] Posting disabled (account suspended)');
  return;

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
