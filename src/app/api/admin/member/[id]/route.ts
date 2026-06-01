/**
 * GET /api/admin/member/[id] — 指定会員のプロフィール + 口コミ + 気になる (管理者専用)
 *
 * 認証: ログイン中ユーザーが管理者 (isAdminEmail) であること。token 不要・no-store。
 * mypage の reviews/favorites と同じクエリを、対象 user_id で実行する管理者版。
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400, headers: NO_STORE });
  }

  const member = db
    .prepare('SELECT id, email, created_at, last_login_at FROM users WHERE id = ?')
    .get(id) as { id: number; email: string; created_at: string; last_login_at: string | null } | undefined;
  if (!member) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const reviews = db
    .prepare(
      `SELECT r.id, r.girl_id, r.visit_date, r.panel_rating, r.comment, r.created_at,
              g.name AS girl_name, g.image_url AS girl_image_url,
              s.id AS shop_id, s.name AS shop_name
       FROM reviews r
       JOIN girls g ON r.girl_id = g.id
       JOIN shops s ON g.shop_id = s.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(id);

  const favorites = db
    .prepare(
      `SELECT g.id AS girl_id, g.name AS girl_name, g.image_url AS girl_image_url,
              s.id AS shop_id, s.name AS shop_name, a.name AS area_name,
              f.created_at AS favorited_at
       FROM favorites f
       JOIN girls g ON f.girl_id = g.id
       JOIN shops s ON g.shop_id = s.id
       JOIN areas a ON s.area_id = a.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(id);

  return NextResponse.json({ member, reviews, favorites }, { headers: NO_STORE });
}
