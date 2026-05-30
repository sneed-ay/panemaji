/**
 * 「気になる」嬢 (favorites) API — 会員のみ
 *
 * POST   /api/favorites      body: { girl_id }    → 追加
 * DELETE /api/favorites      body: { girl_id }    → 削除
 * GET    /api/favorites?girl_id=N → このユーザーが気になる登録済みか { is_favorite: bool }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const girlId = Number(body?.girl_id);
  if (!Number.isInteger(girlId) || girlId <= 0) {
    return NextResponse.json({ error: 'invalid_girl_id' }, { status: 400 });
  }
  // 嬢存在チェック
  const g = db.prepare('SELECT id FROM girls WHERE id = ? AND is_active = 1').get(girlId);
  if (!g) return NextResponse.json({ error: 'girl_not_found' }, { status: 404 });
  // INSERT OR IGNORE (重複時無視)
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, girl_id) VALUES (?, ?)').run(user.id, girlId);
  return NextResponse.json({ ok: true, is_favorite: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const girlId = Number(body?.girl_id);
  if (!Number.isInteger(girlId) || girlId <= 0) {
    return NextResponse.json({ error: 'invalid_girl_id' }, { status: 400 });
  }
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND girl_id = ?').run(user.id, girlId);
  return NextResponse.json({ ok: true, is_favorite: false });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ is_favorite: false, user: null });
  const girlId = Number(req.nextUrl.searchParams.get('girl_id'));
  if (!Number.isInteger(girlId) || girlId <= 0) {
    return NextResponse.json({ error: 'invalid_girl_id' }, { status: 400 });
  }
  const row = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND girl_id = ?').get(user.id, girlId);
  return NextResponse.json({ is_favorite: !!row });
}
