/**
 * GET /api/admin/members — 会員リスト (管理者専用)
 *
 * 認証: ログイン中のユーザーが管理者 (isAdminEmail) であること。token 不要。
 *       public リポジトリでも漏れない (セッション cookie 必須・no-store)。
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  const members = db.prepare(`
    SELECT u.id, u.email, u.created_at, u.last_login_at,
           (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) AS review_count,
           (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorite_count
    FROM users u
    ORDER BY u.created_at DESC
  `).all();

  const totals = {
    users: (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c,
    sessions_active: (db.prepare("SELECT COUNT(*) c FROM sessions WHERE expires_at > datetime('now')").get() as { c: number }).c,
    total_reviews: (db.prepare('SELECT COUNT(*) c FROM reviews').get() as { c: number }).c,
    member_reviews: (db.prepare('SELECT COUNT(*) c FROM reviews WHERE user_id IS NOT NULL').get() as { c: number }).c,
    favorites: (db.prepare('SELECT COUNT(*) c FROM favorites').get() as { c: number }).c,
  };

  return NextResponse.json({ members, totals }, { headers: NO_STORE });
}
