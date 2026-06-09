/**
 * 会員フィードバック 操作API (週次ルーティン用・環境変数シークレット保護)
 *   GET  /api/admin/feedback-ops            (header: x-fb-ops: $FEEDBACK_OPS_SECRET) — open feedback + 対象の現状
 *   POST /api/admin/feedback-ops { ... }     — 反映 (全て復元可能・DELETEなし)
 *
 * 認証: process.env.FEEDBACK_OPS_SECRET が未設定 or 不一致なら 403 (= デフォルト無効)。
 * 投稿者PII(user_id/email)は返さない。reviews/users/favorites は fix_review(会員本人依頼の評価1件)以外触れない。
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

function authed(req: NextRequest): boolean {
  const secret = process.env.FEEDBACK_OPS_SECRET;
  return !!secret && secret.length >= 16 && req.headers.get('x-fb-ops') === secret;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'").get()) {
    return NextResponse.json({ feedback_table: false }, { headers: NO_STORE });
  }
  const items = db.prepare(`
    SELECT f.id, f.target_type, f.shop_id, f.girl_id, f.reason, substr(COALESCE(f.detail,''),1,200) AS detail, f.status, f.created_at,
           s.name AS shop_name, s.is_active AS shop_active,
           g.name AS girl_name, g.is_active AS girl_active
    FROM feedback f
    LEFT JOIN shops s ON f.shop_id = s.id
    LEFT JOIN girls g ON f.girl_id = g.id
    WHERE f.status='open'
    ORDER BY f.created_at
    LIMIT 300
  `).all();
  return NextResponse.json({ open: items.length, items }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE }); }

  const CAP = 100;
  const ids = (x: unknown): number[] => Array.isArray(x) ? x.slice(0, CAP).map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const ph = (a: number[]) => a.map(() => '?').join(',');
  const result: Record<string, unknown> = {};

  db.transaction(() => {
    const ra = ids(body.reactivate_shops); if (ra.length) result.reactivated_shops = db.prepare(`UPDATE shops SET is_active=1 WHERE is_active=0 AND id IN (${ph(ra)})`).run(...ra).changes;
    const da = ids(body.deactivate_shops); if (da.length) result.deactivated_shops = db.prepare(`UPDATE shops SET is_active=0 WHERE is_active=1 AND id IN (${ph(da)})`).run(...da).changes;
    const rg = ids(body.reactivate_girls); if (rg.length) result.reactivated_girls = db.prepare(`UPDATE girls SET is_active=1 WHERE is_active=0 AND id IN (${ph(rg)})`).run(...rg).changes;
    const dg = ids(body.deactivate_girls); if (dg.length) result.deactivated_girls = db.prepare(`UPDATE girls SET is_active=0 WHERE is_active=1 AND id IN (${ph(dg)})`).run(...dg).changes;

    // fix_review: 会員本人の依頼通りに評価を1件変更 (本人のreviewのみ・旧値返却で復元可)
    const fr = body.fix_review as { feedback_id?: number; rating?: string } | undefined;
    if (fr && fr.feedback_id && fr.rating && ['panel_match', 'panel_diff', 'jirai'].includes(fr.rating)) {
      const fb = db.prepare('SELECT user_id, girl_id FROM feedback WHERE id=?').get(Number(fr.feedback_id)) as { user_id?: number; girl_id?: number } | undefined;
      if (fb && fb.user_id && fb.girl_id) {
        const before = db.prepare('SELECT id, panel_rating FROM reviews WHERE user_id=? AND girl_id=?').all(fb.user_id, fb.girl_id);
        const changed = db.prepare('UPDATE reviews SET panel_rating=? WHERE user_id=? AND girl_id=?').run(fr.rating, fb.user_id, fb.girl_id).changes;
        result.fixed_review = { changed, before };
      } else { result.fixed_review = 'feedback/user/girl not found'; }
    }

    const rf = ids(body.resolve_feedback); if (rf.length) result.resolved_feedback = db.prepare(`UPDATE feedback SET status='resolved' WHERE id IN (${ph(rf)})`).run(...rf).changes;
  })();

  return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
}
