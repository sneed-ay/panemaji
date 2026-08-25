/**
 * POST /api/auth/register
 * Body: { email, password }
 * Response: { id, email } + Set-Cookie で session 自動付与
 *
 * メール認証はなし (要件: 「メアド認証はなくて良い」)
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, createSession, isValidEmail, isValidPassword, SESSION_COOKIE, SESSION_TTL_DAYS } from '@/lib/auth';
import { isMeirisConfigured } from '@/lib/meiris';
import { flushPending } from '@/lib/meiris-sync';

/**
 * メール配信システムへ連絡先を送る (広告メール同意者のみ)。
 *
 * 今回登録した会員は meiris_synced_at IS NULL なので flushPending の対象に入る。
 * あわせて直近7日ぶんの取りこぼし (通信断で送れなかった会員) も回収する。
 * 過去の会員へのまとめ送りにならないよう sinceDays で必ず期間を切る。
 *
 * 意図的に await しない: 配信システムは自宅回線経由で瞬断するとのことなので、
 * 会員登録のレスポンスを最大10秒待たせない (仕様書 6章: 本処理を API の成否に依存させない)。
 * Render は常駐 Node のためレスポンス返却後もイベントループ上で完走する。
 * 失敗しても meiris_synced_at が NULL のまま残り、次の登録か管理画面から再送される。
 */
function flushMailingListAsync(): void {
  if (!isMeirisConfigured()) return;
  void flushPending({ limit: 50, sinceDays: 7 })
    .then((r) => {
      if (r.skipped) return;
      if (r.batch_errors.length > 0) {
        console.error('[meiris] 送信エラー', JSON.stringify(r.batch_errors));
      }
      if (r.failures.length > 0) {
        console.error('[meiris] 登録できない連絡先', JSON.stringify(r.failures));
      }
      console.info('[meiris] 同期', JSON.stringify({ attempted: r.attempted, synced: r.marked_synced, ...r.summary }));
    })
    .catch((err) => console.error('[meiris] 到達不可', err));
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { email, password, adOptIn } = body as { email?: string; password?: string; adOptIn?: boolean };

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!password || !isValidPassword(password)) {
    return NextResponse.json({ error: 'invalid_password', message: '8文字以上' }, { status: 400 });
  }

  // 既存メアドチェック
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const hash = await hashPassword(password);
  // 広告メール同意(特電法オプトイン)を登録時のチェックボックスから記録。同意日時も保存(同意の証跡)。
  const optIn = adOptIn === true ? 1 : 0;
  const optInAt = optIn ? new Date().toISOString() : null;
  const result = db
    .prepare(`INSERT INTO users (email, password_hash, ad_opt_in, ad_opt_in_at) VALUES (?, ?, ?, ?)`)
    .run(email, hash, optIn, optInAt);
  const userId = Number(result.lastInsertRowid);

  // 広告メール同意者のみ、メール配信システムへ連絡先を送る (会員登録の成否には影響させない)
  if (optIn) flushMailingListAsync();

  // 自動ログイン
  const { token, expiresAt } = createSession(userId);
  const res = NextResponse.json({ id: userId, email });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
  return res;
}
