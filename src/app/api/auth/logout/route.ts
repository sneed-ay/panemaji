/**
 * POST /api/auth/logout
 * Response: 200 + Set-Cookie で session 消去
 */
import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  deleteSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
