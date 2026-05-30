/**
 * Aggressive bot purge (anonymous + threshold 2/day)
 *
 * 直近30日のうち、ある日に2件以上投稿した匿名 browser_id を Bot 認定
 * (5/day では擦り抜ける軽量 Bot を捕捉)
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_TOKEN = 'purge-bot-aggro-5e3c8a1b9d7f2c4a-20260530';

const BOT_CTE = `
  WITH bot_bid AS (
    SELECT DISTINCT browser_id FROM (
      SELECT browser_id, substr(created_at,1,10) AS day, COUNT(*) AS cnt
      FROM reviews
      WHERE created_at >= date('now','-30 days')
        AND user_id IS NULL
        AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'
        AND browser_id NOT LIKE 'test-%' AND browser_id NOT LIKE 'clean-%'
        AND browser_id NOT LIKE 'final-%' AND browser_id NOT LIKE 'url-param-%'
        AND browser_id NOT LIKE 'urlparam-%'
      GROUP BY browser_id, day
      HAVING cnt >= 2
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
      COUNT(*) AS total_bot_reviews
    FROM reviews r WHERE r.browser_id IN (SELECT browser_id FROM bot_bid)
  `).get() as Record<string, number>;

  if (action === 'count') return NextResponse.json({ mode: 'dry-run', threshold: '2/day', ...summary });
  if (action === 'delete') {
    const r = db.prepare(`${BOT_CTE} DELETE FROM reviews WHERE browser_id IN (SELECT browser_id FROM bot_bid)`).run();
    return NextResponse.json({ mode: 'deleted', deleted_rows: r.changes, ...summary });
  }
  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}
