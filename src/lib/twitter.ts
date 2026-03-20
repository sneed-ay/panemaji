import { TwitterApi } from 'twitter-api-v2';

function getClient(): TwitterApi | null {
  const appKey = process.env.X_API_KEY || 'HGGhQIAWtSJl4NDxxvRMxCmVb';
  const appSecret = process.env.X_API_SECRET || 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv';
  const accessToken = process.env.X_ACCESS_TOKEN || '2034953824427982848-7tUIvauvyXFrxJcv6YxqUFM32bxs6A';
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET || 'cTtk9BQHPvzAh8KPR0IqKkitrAfPOtHGo6MzvlCa7sH7S';

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    console.log('[Twitter] X API credentials not configured, skipping tweet');
    return null;
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

export async function postTweet(text: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.v2.tweet(text);
    console.log('[Twitter] Tweet posted successfully');
  } catch (err) {
    console.error('[Twitter] Failed to post tweet:', err);
  }
}
