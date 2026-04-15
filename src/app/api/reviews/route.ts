import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { addReview, getLatestReviews, getGirlById, getGirlWithReviewStats } from '@/lib/queries';
import { postTweet, canTweetNow } from '@/lib/twitter';

export async function GET() {
  const reviews = getLatestReviews(20);
  return NextResponse.json(reviews);
}



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { girl_id, panel_rating, comment, twitter_url, browser_id } = body;

    if (!girl_id || !panel_rating || !browser_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    if (!['panel_match', 'panel_diff', 'jirai'].includes(panel_rating)) {
      return NextResponse.json({ error: '不正な評価値です' }, { status: 400 });
    }

    addReview(girl_id, panel_rating, comment || null, browser_id);

    // Save twitter URL if provided
    if (twitter_url) {
      const cleanHandle = twitter_url.replace(/^@/, '').replace(/^https?:\/\/(twitter\.com|x\.com)\//, '').trim();
      if (cleanHandle && /^[a-zA-Z0-9_]{1,15}$/.test(cleanHandle)) {
        const { updateGirlTwitter } = await import('@/lib/queries');
        updateGirlTwitter(girl_id, `https://x.com/${cleanHandle}`);
      }
    }

    // Revalidate related pages after review submission
    revalidatePath(`/girl/${girl_id}`);
    const girl = getGirlById(girl_id);
    if (girl) {
      revalidatePath(`/shop/${girl.shop_id}`);
    }
    revalidatePath('/'); // Latest reviews on homepage

    // Post to X asynchronously with rate limiting (max 1 tweet per 10 min)
    if (canTweetNow()) {
      const girlWithStats = getGirlWithReviewStats(girl_id);
      if (girlWithStats) {
        const ratingEmoji: Record<string, string> = {
          panel_match: 'パネル通り ✅',
          panel_diff: '許せる 🟡',
          jirai: '盛りすぎ 🚨',
        };
        const ratingText = ratingEmoji[panel_rating] || panel_rating;

        const reviewCount = girlWithStats.review_count ?? 0;
        const realPct = girlWithStats.real_pct ?? -1;
        const realScore = realPct >= 0 ? Math.round(realPct) : 0;

        const commentLine = comment ? `\n💬 ${comment}` : '';

        // Add @mention if girl has X account
        const twitterUrl = girlWithStats.twitter_url || '';
        const twitterHandle = twitterUrl.replace(/^https?:\/\/(x\.com|twitter\.com)\//, '').replace(/\/.*$/, '');
        const mentionLine = twitterHandle ? `\n\n@${twitterHandle}` : '';

        const tweetText = `【新規口コミ🔥】
🏠 ${girlWithStats.shop_name}
👩 ${girlWithStats.name} さん
📊 ${ratingText}
${commentLine}
📈 累計リアル度: ${realScore}%（${reviewCount}件）

⬇️ パネマジ掲示板
https://panemaji.com/girl/${girl_id}?t=${Date.now()}${mentionLine}`;

        postTweet(tweetText).catch((err) => {
          console.error('[Twitter] Async tweet failed:', err);
        });
      }
    } else {
      console.log('[Twitter] Rate limited: skipping tweet (10min interval not elapsed)');
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
      return NextResponse.json({ error: 'ALREADY_REVIEWED' }, { status: 409 });
    }
    return NextResponse.json({ error: '投稿に失敗しました' }, { status: 500 });
  }
}
