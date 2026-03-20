import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { addReview, getLatestReviews, getGirlById, getGirlWithReviewStats } from '@/lib/queries';
import { postTweet } from '@/lib/twitter';

export async function GET() {
  const reviews = getLatestReviews(20);
  return NextResponse.json(reviews);
}

// Temporary: DELETE test reviews by ID range
export async function DELETE(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== 'cleanup-test-reviews-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const ids: number[] = body.ids;
  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }
  const db = (await import('@/lib/db')).default;
  const stmt = db.prepare('DELETE FROM reviews WHERE id = ?');
  let deleted = 0;
  for (const id of ids) {
    const result = stmt.run(id);
    deleted += result.changes;
  }
  return NextResponse.json({ deleted });
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

    // Post to X asynchronously (don't block the response)
    const girlWithStats = getGirlWithReviewStats(girl_id);
    if (girlWithStats) {
      const ratingEmoji: Record<string, string> = {
        panel_match: 'パネル通り ✅',
        panel_diff: '許せる 🟡',
        jirai: 'パネル詐欺 🚨',
      };
      const ratingText = ratingEmoji[panel_rating] || panel_rating;

      const reviewCount = girlWithStats.review_count ?? 0;
      const realPct = girlWithStats.real_pct ?? -1;
      const realScore = realPct >= 0 ? Math.round(realPct) : 0;

      const commentLine = comment ? `\n💬 ${comment}` : '';

      const tweetText = `【新規口コミ🔥】
🏠 ${girlWithStats.shop_name}
👩 ${girlWithStats.name} さん
📊 ${ratingText}
${commentLine}
📈 累計リアル度: ${realScore}%（${reviewCount}件）

⬇️ パネマジ掲示板
https://panemaji.com/girl/${girl_id}?t=${Date.now()}`;

      postTweet(tweetText).catch((err) => {
        console.error('[Twitter] Async tweet failed:', err);
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
      return NextResponse.json({ error: 'ALREADY_REVIEWED' }, { status: 409 });
    }
    return NextResponse.json({ error: '投稿に失敗しました' }, { status: 500 });
  }
}
