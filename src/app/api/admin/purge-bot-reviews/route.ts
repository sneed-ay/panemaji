/**
 * Bot 投稿された review を一括削除する管理用 endpoint
 *
 * 判定: 直近30日のうち、ある1日に >= 10件 投稿した browser_id を Bot 認定
 *        その browser_id の review を全て削除 (期間制限なし、その browser_id の過去全投稿)
 *
 * 使い方:
 *   GET /api/admin/purge-bot-reviews?token=XXX&action=count  → dry-run (件数のみ)
 *   GET /api/admin/purge-bot-reviews?token=XXX&action=delete → 実削除
 *
 * 認証: token query param が下記 ADMIN_TOKEN と一致すること
 *
 * NOTE: 削除完了後はこのルートファイルを削除すること (commit メッセージで明記)。
 *       他にも /api/reviews POST に rate-limit を実装するのが本対応。
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 一回限りの管理 token (このコミットでしか有効化しない)
const ADMIN_TOKEN = 'purge-bot-9f3a8e2c1b5d4e7a-20260530';

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
      HAVING cnt >= 10
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

  // Bot browser_id リスト + 全 review カウント (期間限定なし、その browser_id の全 review)
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
    return NextResponse.json({ mode: 'dry-run', ...summary });
  }

  if (action === 'delete') {
    // 削除実行
    const result = db.prepare(`
      ${BOT_CTE}
      DELETE FROM reviews
      WHERE browser_id IN (SELECT browser_id FROM bot_bid)
    `).run();
    return NextResponse.json({
      mode: 'deleted',
      pre_delete_summary: summary,
      deleted_rows: result.changes,
    });
  }

  return NextResponse.json({ error: 'invalid action (use count or delete)' }, { status: 400 });
}
