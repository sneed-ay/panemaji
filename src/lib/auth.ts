/**
 * マイページ機能用 認証ユーティリティ
 *
 * - パスワードは bcryptjs で salt round 10 で hash
 * - セッションは sessions テーブル + HttpOnly Cookie (30日)
 * - cookie 名: panemaji_session
 */
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import db from '@/lib/db';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'panemaji_session';
export const SESSION_TTL_DAYS = 30;

export interface User {
  id: number;
  email: string;
  created_at: string;
  last_login_at: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/** session を作成して token を返す */
export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).run(
    token, userId, expiresAt.toISOString()
  );
  return { token, expiresAt };
}

/** token から user 取得 (期限切れは null) */
export function getUserByToken(token: string | undefined): User | null {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.email, u.created_at, u.last_login_at, s.expires_at
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token) as (User & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    // 期限切れ → セッション削除
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, email: row.email, created_at: row.created_at, last_login_at: row.last_login_at };
}

/** App Router の cookies() からカレントユーザー取得 */
export async function getCurrentUser(): Promise<User | null> {
  const c = await cookies();
  return getUserByToken(c.get(SESSION_COOKIE)?.value);
}

export function deleteSession(token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** メアド validate (簡易) */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

/** パスワード validate (8文字以上) */
export function isValidPassword(p: string): boolean {
  return typeof p === 'string' && p.length >= 8 && p.length <= 200;
}
