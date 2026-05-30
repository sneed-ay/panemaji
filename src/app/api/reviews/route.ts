import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { addReview, getLatestReviews, getGirlById } from '@/lib/queries';

export async function GET() {
  const reviews = getLatestReviews(20);
  return NextResponse.json(reviews);
}

// === Bot 防御 (2026-05-30 強化版) ===
// 1. origin/referer チェック (偽装可能なので必須条件にしない、警告レベル)
// 2. rate limit を超厳しく:
//    - IP: 1時間 1件
//    - browser_id: 1時間 1件
//    - 同一 girl_id への全投稿: 1時間 3件 (人気嬢への集中攻撃防止)
//    - global: 1分間に全 IP 合計で 20件まで (バースト遮断)
// in-memory なので process 再起動でリセットされるが、Render は通常単インスタンス
const ipBucket = new Map<string, number[]>();
const browserBucket = new Map<string, number[]>();
const girlBucket = new Map<number, number[]>();
const globalBurst: number[] = [];
const IP_LIMIT = 1;
const BROWSER_LIMIT = 1;
const GIRL_LIMIT = 3;
const GLOBAL_BURST_LIMIT = 20;
const GLOBAL_BURST_WINDOW_MS = 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;

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

    // Global burst (全 IP 合計を 1分20件で頭打ち)
    const now = Date.now();
    while (globalBurst.length > 0 && now - globalBurst[0] > GLOBAL_BURST_WINDOW_MS) globalBurst.shift();
    if (globalBurst.length >= GLOBAL_BURST_LIMIT) {
      return NextResponse.json({ error: 'global_burst' }, { status: 429 });
    }
    globalBurst.push(now);

    // Rate limit (IP / browser_id / girl_id)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
    if (!checkLimit(ipBucket, ip, IP_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_ip' }, { status: 429 });
    }
    if (!checkLimit(browserBucket, String(browser_id), BROWSER_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_browser' }, { status: 429 });
    }
    if (!checkLimit(girlBucket as unknown as Map<string, number[]>, String(girl_id), GIRL_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_girl' }, { status: 429 });
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
