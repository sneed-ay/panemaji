/**
 * 一時メンテ用エンドポイント (使用後に撤去)。secret token 必須。
 *
 *  ?action=audit               : 現 DB と /data/panemaji.db.bak の review 構成を比較 (破壊なし)
 *  ?action=restore-commentless : .bak からコメント無し(=爆サイでない)匿名 review を復元
 *                                (girl_id+browser_id で dedup・id は再採番・spam は comment 有りなので混入しない)
 *  ?action=delete-test-users   : 診断用 diag-login-*@example.com を削除
 */
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TOKEN = 'maint-20260531-r7k2x9q4';
const DB_PATH = process.env.DB_PATH || './panemaji.db';
const NO_STORE = { 'Cache-Control': 'no-store' };

const COMMENTLESS_ANON =
  "(comment IS NULL OR TRIM(comment)='') AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'";

type Conn = { prepare: (s: string) => { get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[]; run: (...a: unknown[]) => { changes: number } } };

function composition(conn: Conn) {
  const c = (sql: string) => (conn.prepare(sql).get() as { c: number }).c;
  return {
    total: c('SELECT COUNT(*) c FROM reviews'),
    ext: c("SELECT COUNT(*) c FROM reviews WHERE browser_id LIKE 'ext-%'"),
    commentless_anon: c(`SELECT COUNT(*) c FROM reviews WHERE ${COMMENTLESS_ANON}`),
    hascomment_anon: c("SELECT COUNT(*) c FROM reviews WHERE comment IS NOT NULL AND TRIM(comment)<>'' AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'"),
    max_id: c('SELECT COALESCE(MAX(id),0) c FROM reviews'),
  };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }
  const action = req.nextUrl.searchParams.get('action') || 'audit';
  const bakPath = `${DB_PATH}.bak`;

  if (action === 'audit') {
    const current = composition(db as unknown as Conn);
    let bak: ReturnType<typeof composition> | null = null;
    if (existsSync(bakPath)) {
      const b = new Database(bakPath, { readonly: true });
      try { bak = composition(b as unknown as Conn); } finally { b.close(); }
    }
    return NextResponse.json({ action, current, bak, bak_exists: existsSync(bakPath) }, { headers: NO_STORE });
  }

  if (action === 'restore-commentless') {
    if (!existsSync(bakPath)) {
      return NextResponse.json({ error: 'no_bak', bakPath }, { status: 404, headers: NO_STORE });
    }
    const b = new Database(bakPath, { readonly: true });
    let rows: { girl_id: number; visit_date: string; panel_rating: string; comment: string | null; browser_id: string }[] = [];
    try {
      rows = b.prepare(
        `SELECT girl_id, visit_date, panel_rating, comment, browser_id FROM reviews WHERE ${COMMENTLESS_ANON}`
      ).all() as typeof rows;
    } finally { b.close(); }
    // 念のため girl 存在チェックしつつ INSERT OR IGNORE (girl_id+browser_id UNIQUE で dedup)
    const ins = db.prepare(
      'INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id) VALUES (?, ?, ?, ?, ?)'
    );
    const tx = db.transaction((rs: typeof rows) => {
      let n = 0;
      for (const r of rs) n += ins.run(r.girl_id, r.visit_date, r.panel_rating, r.comment, r.browser_id).changes;
      return n;
    });
    const restored = tx(rows);
    return NextResponse.json({ action, candidates_in_bak: rows.length, restored }, { headers: NO_STORE });
  }

  if (action === 'delete-test-users') {
    const r = db.prepare("DELETE FROM users WHERE email LIKE 'diag-login-%@example.com'").run();
    return NextResponse.json({ action, deleted_users: r.changes }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: 'unknown_action', valid: ['audit', 'restore-commentless', 'delete-test-users'] }, { status: 400, headers: NO_STORE });
}
