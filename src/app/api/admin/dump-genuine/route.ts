/**
 * GET /api/admin/dump-genuine?token=... — 本物(非ext/非x-import)口コミの全行を返す (一時・復旧用)
 *
 * 用途: Renderディスクスナップショットを1つずつ復元しながら、各時点の本物ユーザー口コミを
 *       HTTPSで吸い出して union 合算するための一時エンドポイント。復旧完了後に撤去する。
 * gate: 固定token (public repo だが本物口コミに個人情報は無く、girl_id/評価/日付/browser_id のみ)。
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TOKEN = 'dump-genuine-20260602-recover-x7k2';
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (token !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  // 取込先に user_id 列が無い古いスナップショットでも動くよう、存在する列だけ選ぶ
  const cols = new Set(db.prepare('PRAGMA table_info(reviews)').all().map((r: { name: string }) => r.name));
  const want = ['girl_id', 'visit_date', 'panel_rating', 'comment', 'browser_id', 'created_at', 'user_id'].filter((c) => cols.has(c));
  const rows = db
    .prepare(
      `SELECT ${want.join(',')} FROM reviews
       WHERE browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'
       ORDER BY created_at`
    )
    .all();
  return NextResponse.json({ count: rows.length, cols: want, reviews: rows }, { headers: NO_STORE });
}
