/**
 * GET /api/admin/user-stats — 会員データ基盤 (管理者向け)
 *
 * 認証: ?token=... が必要 (シンプルな共有秘密)
 *       将来的に admin ユーザーフラグで置き換える
 *
 * 返すデータ:
 *   - total: 累計会員数 + アクティブ会員 (last_login_at が直近30日以内)
 *   - daily_signups: 日別新規登録 (直近60日)
 *   - daily_active: 日別アクティブ (last_login_at ベース、直近60日)
 *   - daily_user_reviews: 会員 review 日別投稿数 (直近60日)
 *   - top_contributors: 投稿数 Top10 会員
 *   - top_favorited_girls: 「気になる」登録数 Top10 嬢
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_TOKEN = process.env.ADMIN_STATS_TOKEN || 'panemaji-admin-stats-default-change-me';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const total = {
    users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
    sessions_active: (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE expires_at > datetime('now')").get() as { c: number }).c,
    favorites: (db.prepare('SELECT COUNT(*) as c FROM favorites').get() as { c: number }).c,
    user_reviews: (db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id IS NOT NULL').get() as { c: number }).c,
    anonymous_reviews: (db.prepare("SELECT COUNT(*) as c FROM reviews WHERE user_id IS NULL AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'").get() as { c: number }).c,
  };

  const daily_signups = db.prepare(`
    SELECT substr(created_at, 1, 10) as date, COUNT(*) as cnt
    FROM users
    WHERE created_at >= date('now','-60 days')
    GROUP BY date
    ORDER BY date DESC
  `).all();

  const daily_active = db.prepare(`
    SELECT substr(last_login_at, 1, 10) as date, COUNT(*) as cnt
    FROM users
    WHERE last_login_at IS NOT NULL AND last_login_at >= date('now','-60 days')
    GROUP BY date
    ORDER BY date DESC
  `).all();

  const daily_user_reviews = db.prepare(`
    SELECT substr(created_at, 1, 10) as date, COUNT(*) as cnt
    FROM reviews
    WHERE user_id IS NOT NULL AND created_at >= date('now','-60 days')
    GROUP BY date
    ORDER BY date DESC
  `).all();

  const top_contributors = db.prepare(`
    SELECT u.id, u.email, u.created_at,
           COUNT(r.id) as review_count,
           (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) as favorite_count
    FROM users u
    LEFT JOIN reviews r ON r.user_id = u.id
    GROUP BY u.id
    ORDER BY review_count DESC, favorite_count DESC
    LIMIT 10
  `).all();

  const top_favorited_girls = db.prepare(`
    SELECT g.id as girl_id, g.name as girl_name,
           s.id as shop_id, s.name as shop_name,
           COUNT(f.user_id) as fav_count
    FROM favorites f
    JOIN girls g ON f.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    GROUP BY g.id
    ORDER BY fav_count DESC
    LIMIT 10
  `).all();

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    total,
    daily_signups,
    daily_active,
    daily_user_reviews,
    top_contributors,
    top_favorited_girls,
  });
}
