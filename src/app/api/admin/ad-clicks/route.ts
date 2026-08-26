/**
 * GET /api/admin/ad-clicks — 広告バナーのクリック実績 (管理者専用・読み取り専用)
 *
 * ad_clicks は本番DBにしか蓄積されない (ローカルDBにも db-latest にも含まれない) ため、
 * 本番の実績を見る手段が無かった。GA も ADC 認証切れで参照できないので、
 * 最低限の集計をここから読めるようにする (2026-08-26)。
 *
 * 認証: 管理者セッション、または ?token= が ADMIN_STATS_TOKEN と一致すること。
 *
 * クエリ:
 *   ?days=N   集計期間 (既定 30・最大 365)
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const token = req.nextUrl.searchParams.get('token');
  const expected = process.env.ADMIN_STATS_TOKEN;
  if (expected && token && token === expected) return true;
  const user = await getCurrentUser();
  return !!user?.is_admin;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 365);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  // created_at は epoch ms (api/click/route.ts が Date.now() で入れている)
  const rows = <T,>(sql: string, ...args: unknown[]) => db.prepare(sql).all(...args) as T[];

  const total = (db.prepare('SELECT COUNT(*) c FROM ad_clicks').get() as { c: number }).c;
  const inPeriod = (db.prepare('SELECT COUNT(*) c FROM ad_clicks WHERE created_at >= ?').get(since) as { c: number }).c;

  const byType = rows<{ ad_type: string; clicks: number; uniq_browsers: number; first_at: number; last_at: number }>(
    `SELECT ad_type,
            COUNT(*) AS clicks,
            COUNT(DISTINCT browser_id) AS uniq_browsers,
            MIN(created_at) AS first_at,
            MAX(created_at) AS last_at
       FROM ad_clicks WHERE created_at >= ?
      GROUP BY ad_type ORDER BY clicks DESC`,
    since
  );

  const byDay = rows<{ day: string; clicks: number }>(
    `SELECT date(created_at/1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS clicks
       FROM ad_clicks WHERE created_at >= ?
      GROUP BY day ORDER BY day DESC LIMIT 60`,
    since
  );

  const byTypeDay = rows<{ day: string; ad_type: string; clicks: number }>(
    `SELECT date(created_at/1000, 'unixepoch', 'localtime') AS day, ad_type, COUNT(*) AS clicks
       FROM ad_clicks WHERE created_at >= ?
      GROUP BY day, ad_type ORDER BY day DESC, clicks DESC LIMIT 200`,
    since
  );

  const bySize = rows<{ ad_size: string | null; clicks: number }>(
    `SELECT ad_size, COUNT(*) AS clicks FROM ad_clicks WHERE created_at >= ?
      GROUP BY ad_size ORDER BY clicks DESC`,
    since
  );

  const byDest = rows<{ dest_host: string | null; clicks: number }>(
    `SELECT dest_host, COUNT(*) AS clicks FROM ad_clicks WHERE created_at >= ?
      GROUP BY dest_host ORDER BY clicks DESC LIMIT 20`,
    since
  );

  const topPages = rows<{ ad_page: string | null; clicks: number }>(
    `SELECT ad_page, COUNT(*) AS clicks FROM ad_clicks WHERE created_at >= ?
      GROUP BY ad_page ORDER BY clicks DESC LIMIT 20`,
    since
  );

  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

  return NextResponse.json(
    {
      period_days: days,
      total_all_time: total,
      clicks_in_period: inPeriod,
      by_ad_type: byType.map((r) => ({ ...r, first_at: iso(r.first_at), last_at: iso(r.last_at) })),
      by_day: byDay,
      by_type_day: byTypeDay,
      by_ad_size: bySize,
      by_dest_host: byDest,
      top_pages: topPages,
    },
    { headers: NO_STORE }
  );
}
