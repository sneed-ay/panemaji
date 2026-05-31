/**
 * GET /api/mypage/favorites — 自分が気になる登録した嬢一覧
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
    SELECT g.id AS girl_id, g.name AS girl_name, g.image_url AS girl_image_url,
           s.id AS shop_id, s.name AS shop_name,
           a.name AS area_name,
           f.created_at AS favorited_at
    FROM favorites f
    JOIN girls g ON f.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(user.id);
  return NextResponse.json({ favorites: rows }, { headers: NO_STORE });
}
