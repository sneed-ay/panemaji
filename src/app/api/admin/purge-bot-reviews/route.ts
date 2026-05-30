/**
 * Bot review 3rd round purge (闘値 5/日, post-deploy refresh)
 *
 * 完了後はこのファイルを削除する
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_TOKEN = 'purge-bot-round3-3f9a8e1c2b4d5f6e-20260530';

const BOT_CTE = `
  WITH bot_bid AS (
    SELECT DISTINCT browser_id FROM (
      SELECT browser_id, substr(created_at,1,10) AS day, COUNT(*) AS cnt
      FROM reviews
      WHERE created_at >= date('now','-30 days')
        AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'
        AND browser_id NOT LIKE 'test-%' AND browser_id NOT LIKE 'clean-%'
        AND browser_id NOT LIKE 'final-%' AND browser_id NOT LIKE 'url-param-%'
        AND browser_id NOT LIKE 'urlparam-%'
        AND user_id IS NULL  -- 会員投稿は対象外 (登録 + cookie 認証済なので)
      GROUP BY browser_id, day
      HAVING cnt >= 5
    )
  )
`;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('token') !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const action = sp.get('action') || 'count';

  const summary = db.prepare(`
    ${BOT_CTE}
    SELECT
      (SELECT COUNT(*) FROM bot_bid) AS bot_browser_count,
      COUNT(*) AS total_bot_reviews,
      COUNT(DISTINCT r.girl_id) AS girls_affected,
      MIN(r.created_at) AS earliest,
      MAX(r.created_at) AS latest
    FROM reviews r
    WHERE r.browser_id IN (SELECT browser_id FROM bot_bid)
  `).get() as Record<string, number | string>;

  if (action === 'count') {
    return NextResponse.json({ mode: 'dry-run', threshold: '5/day (anonymous only)', ...summary });
  }
  if (action === 'delete') {
    const result = db.prepare(`
      ${BOT_CTE}
      DELETE FROM reviews
      WHERE browser_id IN (SELECT browser_id FROM bot_bid)
    `).run();
    return NextResponse.json({ mode: 'deleted', pre_delete_summary: summary, deleted_rows: result.changes });
  }
  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}
