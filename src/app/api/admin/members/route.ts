/**
 * GET /api/admin/members — 会員リスト (管理者専用)
 *
 * 認証: ログイン中のユーザーが管理者 (isAdminEmail) であること。token 不要。
 *       public リポジトリでも漏れない (セッション cookie 必須・no-store)。
 *
 * クエリ:
 *   q      … メールアドレスの部分一致 (省略可)
 *   limit  … 取得件数 (既定 100 / 最大 500)
 *   offset … 取得開始位置 (既定 0)
 *
 * 2026-09-06: 以前は全件 (3,344人) を LIMIT 無しで返していた。
 *   1人につき相関サブクエリ2本を回すうえに、その全件を JSON にしてスマホへ送り、
 *   さらに 3,344 行を DOM に描いていたため管理画面が実用にならなかった。
 *   → 検索 + ページングに変更。totals は従来どおり全体の集計を返す。
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim().slice(0, 100);
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 500);
  const offset = Math.max(Number(sp.get('offset')) || 0, 0);

  const where = q ? 'WHERE u.email LIKE ?' : '';
  const like = `%${q}%`;
  const args: (string | number)[] = q ? [like] : [];

  const matched = (
    db.prepare(`SELECT COUNT(*) c FROM users u ${where}`).get(...args) as { c: number }
  ).c;

  const members = db
    .prepare(
      `SELECT u.id, u.email, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) AS review_count,
              (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorite_count
         FROM users u
         ${where}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`
    )
    .all(...args, limit, offset);

  const totals = {
    users: (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c,
    sessions_active: (db.prepare("SELECT COUNT(*) c FROM sessions WHERE expires_at > datetime('now')").get() as { c: number }).c,
    total_reviews: (db.prepare('SELECT COUNT(*) c FROM reviews').get() as { c: number }).c,
    member_reviews: (db.prepare('SELECT COUNT(*) c FROM reviews WHERE user_id IS NOT NULL').get() as { c: number }).c,
    favorites: (db.prepare('SELECT COUNT(*) c FROM favorites').get() as { c: number }).c,
  };

  // 日別の新規登録 (日本時間・直近60日、末尾が今日)。管理画面の初回表示でだけ返す。
  // 2026-09-13: 推移を見るには全会員を500件ずつ取得して手元で集計するしかなかったため追加。
  //   created_at は datetime('now') = UTC なので、+9時間してから日付にする。
  let daily_signups: { date: string; count: number }[] | undefined;
  if (offset === 0 && !q) {
    const rows = db
      .prepare(
        `SELECT date(created_at, '+9 hours') AS d, COUNT(*) AS c
           FROM users
          WHERE created_at >= datetime('now', '-61 days')
          GROUP BY d`
      )
      .all() as { d: string; c: number }[];
    const byDate = new Map(rows.map((r) => [r.d, r.c]));
    const nowJst = Date.now() + 9 * 3600 * 1000;
    daily_signups = [];
    for (let i = 59; i >= 0; i--) {
      const date = new Date(nowJst - i * 86400 * 1000).toISOString().slice(0, 10);
      daily_signups.push({ date, count: byDate.get(date) ?? 0 });
    }
  }

  return NextResponse.json({ members, totals, matched, limit, offset, daily_signups }, { headers: NO_STORE });
}
