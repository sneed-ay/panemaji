/**
 * Bot 投稿 review 一括削除 (闘値 5件/日, 2nd round)
 *
 * 判定: 直近30日のうち、ある1日に >= 5件 投稿した browser_id
 *       1日3件以下しか書かない=人間想定、5件以上は機械投稿想定
 *
 * 使い方:
 *   GET /api/admin/purge-bot-reviews?token=XXX&action=count
 *   GET /api/admin/purge-bot-reviews?token=XXX&action=delete
 *
 * 完了後は同様にコミット削除する
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_TOKEN = 'purge-bot-round2-7e4a9c3b8d1f6e2a-20260530';

// 闘値 5/日 (前回は 10/日)
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
      GROUP BY browser_id, day
      HAVING cnt >= 5
    )
  )
`;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get('token');
  const action = sp.get('action') || 'count';

  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const summary = db.prepare(`
    ${BOT_CTE}
    SELECT
      (SELECT COUNT(*) FROM bot_bid) AS bot_browser_count,
      COUNT(*) AS total_bot_reviews,
      COUNT(DISTINCT r.girl_id) AS girls_affected,
      COUNT(DISTINCT g.shop_id) AS shops_affected,
      MIN(r.created_at) AS earliest,
      MAX(r.created_at) AS latest
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    WHERE r.browser_id IN (SELECT browser_id FROM bot_bid)
  `).get() as Record<string, number | string>;

  if (action === 'count') {
    return NextResponse.json({ mode: 'dry-run', threshold: '5/day', ...summary });
  }

  if (action === 'delete') {
    const result = db.prepare(`
      ${BOT_CTE}
      DELETE FROM reviews
      WHERE browser_id IN (SELECT browser_id FROM bot_bid)
    `).run();
    return NextResponse.json({
      mode: 'deleted',
      threshold: '5/day',
      pre_delete_summary: summary,
      deleted_rows: result.changes,
    });
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}
