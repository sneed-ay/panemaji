import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import db from '@/lib/db';
import { isBakusaiSpam } from '@/lib/bakusai-spam';

export const dynamic = 'force-dynamic';

// === Bot 防御 ===
// このエンドポイントは /api/reviews とは別経路で reviews に INSERT/UPDATE する。
// 2026-05-30 の防御強化 (origin/rate-limit) は /api/reviews にしか入っておらず、
// ここが無防備だったため bot が「パネマジ掲示板」系スパムをここから流し込んでいた。
// → /api/reviews と同等の origin チェック + content ブロック + rate limit を入れる。
const ipBucket = new Map<string, number[]>();
const browserBucket = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 3;
const BROWSER_LIMIT = 3;

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const allowed = ['https://panemaji.com', 'https://www.panemaji.com'];
  if (origin) return allowed.includes(origin);
  if (referer) return allowed.some((a) => referer.startsWith(a));
  return false;
}

function checkLimit(map: Map<string, number[]>, key: string, limit: number): boolean {
  const now = Date.now();
  const arr = (map.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= limit) return false;
  arr.push(now);
  map.set(key, arr);
  if (map.size > 10000) {
    for (const [k, v] of map) {
      const fresh = v.filter((t) => now - t < WINDOW_MS);
      if (fresh.length === 0) map.delete(k);
      else map.set(k, fresh);
    }
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { girl_id, comment, browser_id } = body;

    if (!girl_id || !comment || !browser_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'コメントが長すぎます' }, { status: 400 });
    }

    // 爆サイ自己言及スパム (パネマジ掲示板系) は shadow-drop: 成功に見せて保存しない。
    // create も update も走らせない (既存レビューの spam 上書きも防止)。
    if (isBakusaiSpam(comment)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // rate limit (IP / browser_id, 1時間 3件)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
    if (!checkLimit(ipBucket, ip, IP_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_ip' }, { status: 429 });
    }
    if (!checkLimit(browserBucket, String(browser_id), BROWSER_LIMIT)) {
      return NextResponse.json({ error: 'rate_limit_browser' }, { status: 429 });
    }

    // Try to update existing review first
    const existing = db.prepare(
      'SELECT id FROM reviews WHERE girl_id = ? AND browser_id = ?'
    ).get(girl_id, browser_id) as { id: number } | undefined;

    if (existing) {
      db.prepare('UPDATE reviews SET comment = ? WHERE id = ?').run(comment, existing.id);
    } else {
      // Create new review with comment only (no rating - use panel_diff as neutral default)
      const now = new Date().toISOString().split('T')[0];
      db.prepare(
        'INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id) VALUES (?, ?, ?, ?, ?)'
      ).run(girl_id, now, 'panel_diff', comment, browser_id);
    }

    revalidatePath(`/girl/${girl_id}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'コメントの追加に失敗しました' }, { status: 500 });
  }
}
