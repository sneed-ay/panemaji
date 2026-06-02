#!/usr/bin/env node
/**
 * 会員データ (users / sessions / favorites) を /tmp/all_*.json から復元する。
 * init-db.sh から呼ばれる。
 *
 * 🚨 重要: これは口コミ再取込 (reviews) より「前」に実行すること。
 *    会員口コミ (reviews.user_id) が参照する users 行が先に存在することで FK 整合が保証され、
 *    たとえ foreign_keys=ON でも会員口コミの取りこぼしが起きない。
 *    (過去: 会員復元が再取込より後だったため、再取込時に users が空で会員口コミが落ちていた)
 *
 * idempotent: INSERT OR IGNORE なので複数回呼んでも安全 (2回目以降は no-op)。
 * /tmp/all_*.json が無い場合 (初回デプロイ等) は何もしない。
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DB_PATH =
  process.env.DB_PATH ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'panemaji.db');

function restore(db, table, file) {
  if (!fs.existsSync(file)) return 0;
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return 0;
  }
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  // 取込先テーブルに実在する列のみ使う (schema 不整合での全滅を防ぐ)
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name));
  const cols = Object.keys(rows[0]).filter((c) => existing.has(c));
  if (cols.length === 0) return 0;
  const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
  const stmt = db.prepare(sql);
  const tx = db.transaction((rs) => {
    let n = 0;
    for (const r of rs) n += stmt.run(...cols.map((c) => r[c])).changes;
    return n;
  });
  return tx(rows);
}

try {
  const db = new Database(DB_PATH);
  // users → sessions/favorites の順 (sessions/favorites は users を参照するため)
  const u = restore(db, 'users', '/tmp/all_users.json');
  const s = restore(db, 'sessions', '/tmp/all_sessions.json');
  const f = restore(db, 'favorites', '/tmp/all_favorites.json');
  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  console.log('Restored members: +users', u, '| +sessions', s, '| +favorites', f, '(total users now:', total + ')');
  db.close();
} catch (e) {
  console.error('Member restore error:', e.message);
}
