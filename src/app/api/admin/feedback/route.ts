/**
 * GET  /api/admin/feedback — 会員フィードバック一覧 (管理者専用)
 * POST /api/admin/feedback { id, status } — ステータス更新 (open|resolved)
 *
 * 認証: ログイン中の管理者 (isAdminEmail) のみ。
 */
import { NextRequest, NextResponse } from 'next/server';
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
  const feedback = db.prepare(`
    SELECT f.id, f.target_type, f.shop_id, f.girl_id, f.reason, f.detail, f.status, f.created_at,
           u.email AS user_email, s.name AS shop_name, g.name AS girl_name, g.shop_id AS girl_shop_id
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    LEFT JOIN shops s ON f.shop_id = s.id
    LEFT JOIN girls g ON f.girl_id = g.id
    ORDER BY (f.status = 'open') DESC, f.created_at DESC
    LIMIT 300
  `).all();
  const open_count = (db.prepare("SELECT COUNT(*) c FROM feedback WHERE status='open'").get() as { c: number }).c;
  return NextResponse.json({ feedback, open_count }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE }); }
  const id = Number(body?.id);
  const status = body?.status === 'resolved' ? 'resolved' : 'open';
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400, headers: NO_STORE });
  }
  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, id);
  return NextResponse.json({ ok: true, id, status }, { headers: NO_STORE });
}
