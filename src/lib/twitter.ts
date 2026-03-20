import { TwitterApi } from 'twitter-api-v2';

// Hardcoded credentials - env vars on Render are unreliable
const TWITTER_CONFIG = {
  appKey: 'HGGhQIAWtSJl4NDxxvRMxCmVb',
  appSecret: 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv',
  accessToken: '2034953824427982848-7tUIvauvyXFrxJcv6YxqUFM32bxs6A',
  accessSecret: 'cTtk9BQHPvzAh8KPR0IqKkitrAfPOtHGo6MzvlCa7sH7S',
};

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
  } catch (err: unknown) {
    const error = err as { code?: number; data?: unknown; message?: string };
    console.error('[Twitter] Failed to post tweet. Code:', error.code);
    console.error('[Twitter] Error data:', JSON.stringify(error.data));
    console.error('[Twitter] Error message:', error.message);
  }
}
