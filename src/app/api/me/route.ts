/**
 * GET /api/me — 現在のユーザー情報 (ログイン状態 + 統計)
 * Response: { user: User | null, stats: { reviews_count, favorites_count } }
 *
 * フロントエンドが「ログイン中か?」を判定する根本 endpoint
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 個人化レスポンスは絶対にキャッシュさせない (ログイン状態のキャッシュ汚染防止)
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null, stats: null }, { headers: NO_STORE });
  const stats = {
    reviews_count: (db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id = ?').get(user.id) as { c: number }).c,
    favorites_count: (db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(user.id) as { c: number }).c,
  };
  // 「毎月1件でも投稿していれば見放題」仕様: 直近30日に会員投稿があるか
  const recent = (db.prepare("SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND created_at >= datetime('now','-30 days')").get(user.id) as { c: number }).c;
  const reviewed_recently = recent > 0;
  return NextResponse.json({ user, stats, reviewed_recently }, { headers: NO_STORE });
}
