/**
 * POST /api/feedback — 会員からの情報修正報告 (閉店/退店/存在しない 等)
 * 会員(ログイン)限定。管理画面 (/admin) で確認する。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };
const REASONS = ['closed', 'departed', 'not_exist', 'wrong_info', 'other'];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401, headers: NO_STORE });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE }); }
  const { target_type, shop_id, girl_id, reason, detail } = body || {};

  if (target_type !== 'shop' && target_type !== 'girl') {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400, headers: NO_STORE });
  }
  if (!REASONS.includes(reason)) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 400, headers: NO_STORE });
  }
  const sid = target_type === 'shop' ? Number(shop_id) : null;
  const gid = target_type === 'girl' ? Number(girl_id) : null;
  if (target_type === 'shop' && (!Number.isInteger(sid) || (sid as number) <= 0)) {
    return NextResponse.json({ error: 'invalid_shop_id' }, { status: 400, headers: NO_STORE });
  }
  if (target_type === 'girl' && (!Number.isInteger(gid) || (gid as number) <= 0)) {
    return NextResponse.json({ error: 'invalid_girl_id' }, { status: 400, headers: NO_STORE });
  }
  const det = typeof detail === 'string' && detail.trim() ? detail.trim().slice(0, 500) : null;

  // 同一会員・同一対象・同一理由の未対応(open)報告が既にあれば重複として無視
  const dup = db.prepare(
    `SELECT id FROM feedback WHERE user_id=? AND target_type=? AND COALESCE(shop_id,0)=? AND COALESCE(girl_id,0)=? AND reason=? AND status='open'`
  ).get(user.id, target_type, sid || 0, gid || 0, reason);
  if (dup) return NextResponse.json({ ok: true, duplicate: true }, { headers: NO_STORE });

  db.prepare(
    `INSERT INTO feedback (user_id, target_type, shop_id, girl_id, reason, detail) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(user.id, target_type, sid, gid, reason, det);

  return NextResponse.json({ ok: true }, { status: 201, headers: NO_STORE });
}
