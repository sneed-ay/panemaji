import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { addReview, getLatestReviews, getGirlById } from '@/lib/queries';

export async function GET() {
  const reviews = getLatestReviews(20);
  return NextResponse.json(reviews);
}

// === Bot 防御 (2026-05-30 追加) ===
// 1. origin/referer チェック: panemaji.com 以外からの POST を拒否
// 2. rate limit: IP ごと 1時間 5件まで, browser_id ごと 1時間 3件まで
//    (in-memory なので process 再起動でリセット。Render の単インスタンス想定)
const ipBucket = new Map<string, number[]>();      // ip -> timestamps[]
const browserBucket = new Map<string, number[]>(); // browser_id -> timestamps[]
const IP_LIMIT = 5;
const BROWSER_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkLimit(map: Map<string, number[]>, key: string, limit: number): boolean {
  const now = Date.now();
  const arr = (map.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= limit) return false;
  arr.push(now);
  map.set(key, arr);
  // mapが肥大化しないよう古いキーを掃除 (10000超えたら掃除)
  if (map.size > 10000) {
    for (const [k, v] of map) {
      const fresh = v.filter(t => now - t < WINDOW_MS);
      if (fresh.length === 0) map.delete(k);
      else map.set(k, fresh);
    }
  }
  return true;
}

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const allowed = ['https://panemaji.com', 'https://www.panemaji.com'];
  // origin が指定されていれば一致必須、なければ referer が panemaji.com で始まること
  if (origin) return allowed.includes(origin);
  if (referer) return allowed.some(a => referer.startsWith(a));
  // どちらも無い = curl 等の生 POST = 拒否
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Origin/Referer チェック
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { girl_id, panel_rating, comment, twitter_url, browser_id } = body;

    if (!girl_id || !panel_rating || !browser_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    if (!['panel_match', 'panel_diff', 'jirai'].includes(panel_rating)) {
      return NextResponse.json({ error: '不正な評価値です' }, { status: 400 });
    }

    // Rate limit (IP + browser_id 両方)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
    if (!checkLimit(ipBucket, ip, IP_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_ip' }, { status: 429 });
    }
    if (!checkLimit(browserBucket, String(browser_id), BROWSER_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_browser' }, { status: 429 });
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

    // X (Twitter) 投稿は廃止: 旧 @aichan_ura_ai アカウントは停止 + 運用しないため。
    // girls.twitter_url フィールドは引き続き保存・表示用に存在 (上記 line 33 で記録)。

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
      return NextResponse.json({ error: 'ALREADY_REVIEWED' }, { status: 409 });
    }
    return NextResponse.json({ error: '投稿に失敗しました' }, { status: 500 });
  }
}
