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

// 管理者は email allowlist で判定 (DB列・migration 不要で、列欠落による認証破壊リスクが無い)
export const ADMIN_EMAILS = ['info@sneed.jp'];
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export interface User {
  id: number;
  email: string;
  created_at: string;
  last_login_at: string | null;
  is_admin: boolean;
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
  return { id: row.id, email: row.email, created_at: row.created_at, last_login_at: row.last_login_at, is_admin: isAdminEmail(row.email) };
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
/**
 * メアド validate。
 *
 * 2026-08-25: ピリオド起因の不正アドレスが実際に会員登録を通っていたため厳格化。
 *   `sougorou1010.@icloud.com` / `kagakou.2026..@gmail.com` 等が6件混入し、
 *   メール配信システム側で invalid として弾かれた (実在しないので永久に届かない)。
 *   うち4件は同一人物が「既に登録済み」を回避するためピリオドを増やして登録した跡。
 *   RFC 5322 では以下が無効:
 *     - ピリオドの連続        (abc..def@example.com)
 *     - local/domain の先頭・末尾がピリオド (abc.@example.com / abc@.example.com)
 *
 * 注意: これは登録時のみの検証。login では使っていないので、
 *       既に登録済みの不正アドレス会員がログインできなくなることはない。
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length > 255) return false;
  // 全体の形 (この正規表現の時点で @ はちょうど1個に限定される)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  // ピリオドの連続
  if (email.includes('..')) return false;
  const [local, domain] = email.split('@');
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

/** パスワード validate (8文字以上) */
export function isValidPassword(p: string): boolean {
  return typeof p === 'string' && p.length >= 8 && p.length <= 200;
}
