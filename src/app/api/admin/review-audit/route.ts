/**
 * GET /api/admin/review-audit?token=... — 本番 reviews の構成を実数で集計 (読み取り専用・件数のみ・PIIなし)
 * 「コメント無し評価が本当に欠けているか」を確定診断するための一時エンドポイント。使用後に撤去。
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TOKEN = 'review-audit-20260601-x9k2';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  const CL = "(comment IS NULL OR TRIM(comment)='')";
  const data = {
    total: c('SELECT COUNT(*) c FROM reviews'),
    ext: c("SELECT COUNT(*) c FROM reviews WHERE browser_id LIKE 'ext-%'"),
    ximport: c("SELECT COUNT(*) c FROM reviews WHERE browser_id LIKE 'x-import-%'"),
    commentless_total: c(`SELECT COUNT(*) c FROM reviews WHERE ${CL}`),
    commentless_ext: c(`SELECT COUNT(*) c FROM reviews WHERE ${CL} AND browser_id LIKE 'ext-%'`),
    commentless_genuine: c(`SELECT COUNT(*) c FROM reviews WHERE ${CL} AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'`),
    hascomment_total: c("SELECT COUNT(*) c FROM reviews WHERE comment IS NOT NULL AND TRIM(comment)<>''"),
    girls_with_review: c('SELECT COUNT(DISTINCT girl_id) c FROM reviews'),
  };
  return NextResponse.json(data, { headers: NO_STORE });
}
