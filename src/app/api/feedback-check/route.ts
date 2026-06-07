/**
 * 一時的なフィードバック状態 確認用エンドポイント (管理者ログイン不要・シークレット保護)
 *   GET /api/feedback-check  (header: x-fb-check: <secret>)
 * 投稿者PII(user_id/email)は返さない。状態確認後に削除する。
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };
const SECRET = 'pmj-fbchk-2026-7zq';

export async function GET(req: NextRequest) {
  if (req.headers.get('x-fb-check') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  let exists = false;
  try { exists = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'").get(); } catch { /* noop */ }
  if (!exists) {
    return NextResponse.json({ feedback_table: false }, { headers: NO_STORE });
  }
  const byStatus = db.prepare('SELECT status, COUNT(*) c FROM feedback GROUP BY status').all();
  const byReason = db.prepare("SELECT status, target_type, reason, COUNT(*) c FROM feedback GROUP BY status, target_type, reason ORDER BY status, c DESC").all();
  const total = (db.prepare('SELECT COUNT(*) c FROM feedback').get() as { c: number }).c;
  // 個別(投稿者PIIは除外。detailは内容判断用に80字まで)
  const items = db.prepare(
    "SELECT id, target_type, shop_id, girl_id, reason, substr(COALESCE(detail,''),1,80) AS detail, status, created_at FROM feedback ORDER BY (status='open') DESC, created_at DESC LIMIT 200"
  ).all();
  return NextResponse.json({ feedback_table: true, total, byStatus, byReason, items_returned: items.length, items }, { headers: NO_STORE });
}
