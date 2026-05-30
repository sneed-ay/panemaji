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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null, stats: null });
  const stats = {
    reviews_count: (db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id = ?').get(user.id) as { c: number }).c,
    favorites_count: (db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(user.id) as { c: number }).c,
  };
  return NextResponse.json({ user, stats });
}
