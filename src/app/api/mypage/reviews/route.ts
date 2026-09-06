/**
 * GET /api/mypage/reviews — 自分が投稿した会員口コミ一覧
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401, headers: NO_STORE });
  const rows = db.prepare(`
    SELECT r.id, r.girl_id, r.visit_date, r.panel_rating, r.comment, r.created_at,
           g.name AS girl_name,
           s.id AS shop_id, s.name AS shop_name
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(user.id);
  return NextResponse.json({ reviews: rows }, { headers: NO_STORE });
}
