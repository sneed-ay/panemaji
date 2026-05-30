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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { email, password } = body as { email?: string; password?: string };

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
  const result = db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`).run(email, hash);
  const userId = Number(result.lastInsertRowid);

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
