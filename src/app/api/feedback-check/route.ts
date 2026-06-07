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

// POST: 一時的なフィードバック処理アクション (secret保護・全て復元可能・DELETEなし)
//   body: { reactivate_shops?:[id], resolve_feedback?:[id], fix_review?:{feedback_id, rating} }
export async function POST(req: NextRequest) {
  if (req.headers.get('x-fb-check') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  let body: { reactivate_shops?: number[]; resolve_feedback?: number[]; fix_review?: { feedback_id: number; rating: string } };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE }); }
  const result: Record<string, unknown> = {};

  // 店舗を再アクティブ化 (会員「閉店していない」訂正の反映 / is_active=0→1 のみ・DELETEなし)
  if (Array.isArray(body.reactivate_shops)) {
    const stmt = db.prepare('UPDATE shops SET is_active=1 WHERE id=? AND is_active=0');
    let n = 0; for (const id of body.reactivate_shops) n += stmt.run(Number(id)).changes;
    result.reactivated_shops = n;
  }
  // 会員の口コミ評価を本人の依頼通りに修正 (本人のreviewのみ・旧値をログして復元可)
  if (body.fix_review && body.fix_review.feedback_id) {
    const fb = db.prepare('SELECT user_id, girl_id FROM feedback WHERE id=?').get(Number(body.fix_review.feedback_id)) as { user_id?: number; girl_id?: number } | undefined;
    if (fb && fb.user_id && fb.girl_id) {
      const before = db.prepare('SELECT id, panel_rating FROM reviews WHERE user_id=? AND girl_id=?').all(fb.user_id, fb.girl_id);
      const changed = db.prepare('UPDATE reviews SET panel_rating=? WHERE user_id=? AND girl_id=?').run(body.fix_review.rating, fb.user_id, fb.girl_id).changes;
      result.fixed_review = { changed, before, new_rating: body.fix_review.rating };
    } else { result.fixed_review = 'feedback/user/girl not found'; }
  }
  // feedback を resolved に
  if (Array.isArray(body.resolve_feedback)) {
    const stmt = db.prepare("UPDATE feedback SET status='resolved' WHERE id=?");
    let n = 0; for (const id of body.resolve_feedback) n += stmt.run(Number(id)).changes;
    result.resolved_feedback = n;
  }
  return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
}
