/**
 * POST /api/auth/login
 * Body: { email, password }
 * Response: { id, email } + Set-Cookie で session
 *
 * Rate limit: IP ごとに 10分 5回まで (brute force 対策)
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, createSession, SESSION_COOKIE, SESSION_TTL_DAYS } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// IP rate limit
const ipBucket = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (ipBucket.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) return false;
  arr.push(now);
  ipBucket.set(ip, arr);
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'rate_limit', message: '試行回数が多すぎます。少し時間を空けてからお試しください' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; email: string; password_hash: string }
    | undefined;
  if (!user) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).run(user.id);

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email });
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
