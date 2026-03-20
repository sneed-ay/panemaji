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

/**
 * Download an image from URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PanemajiBot/1.0)' },
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Post a tweet with optional image attachment
 */
export async function postTweet(text: string, imageUrl?: string | null): Promise<void> {
  try {
    console.log('[Twitter] Attempting to post tweet...');

    const client = new TwitterApi({
      appKey: TWITTER_CONFIG.appKey,
      appSecret: TWITTER_CONFIG.appSecret,
      accessToken: TWITTER_CONFIG.accessToken,
      accessSecret: TWITTER_CONFIG.accessSecret,
    });

    let mediaId: string | undefined;

    // Try to upload image if URL provided
    if (imageUrl) {
      try {
        console.log('[Twitter] Downloading image:', imageUrl.substring(0, 80));
        const imageBuffer = await downloadImage(imageUrl);
        if (imageBuffer && imageBuffer.length > 1000) {
          console.log('[Twitter] Uploading image (' + imageBuffer.length + ' bytes)...');
          mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
          console.log('[Twitter] Image uploaded, mediaId:', mediaId);
        }
      } catch (imgErr) {
        console.error('[Twitter] Image upload failed, posting without image:', imgErr);
      }
    }

    // Post tweet with or without media
    if (mediaId) {
      const result = await client.v2.tweet({ text, media: { media_ids: [mediaId] } });
      console.log('[Twitter] Tweet with image posted! ID:', result.data.id);
    } else {
      const result = await client.v2.tweet(text);
      console.log('[Twitter] Tweet posted (no image)! ID:', result.data.id);
    }

    // Record successful tweet time for rate limiting
    recordTweetTime();
  } catch (err: unknown) {
    const error = err as { code?: number; data?: unknown; message?: string };
    console.error('[Twitter] Failed to post tweet. Code:', error.code);
    console.error('[Twitter] Error data:', JSON.stringify(error.data));
    console.error('[Twitter] Error message:', error.message);
  }
}
