#!/usr/bin/env node
/**
 * マイページ機能用のテーブル/列を idempotent に追加
 *
 * 追加するもの:
 *   - users          : 会員 (email + password_hash + 登録日時 + 最終ログイン日時)
 *   - sessions       : ログインセッション (token, user_id, expires_at)
 *   - favorites      : 「気になる」嬢 (user_id, girl_id)
 *   - reviews.user_id: 会員口コミか未会員口コミかを識別
 *   - UNIQUE(user_id, girl_id) WHERE user_id IS NOT NULL: 会員は 1嬢1口コミ
 *
 * 実行: node scripts/migrate-users-tables.mjs
 *       (DB_PATH env で本番 DB 指定可、デフォルトは ./panemaji.db)
 *
 * Render 起動時に init-db.sh から自動呼び出しされる。
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.resolve('./panemaji.db');
console.log(`📦 マイページ機能 migration: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// === users ===
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
`);
console.log('  ✓ users');

// === sessions ===
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);
console.log('  ✓ sessions');

// === favorites ===
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    girl_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, girl_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (girl_id) REFERENCES girls(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_girl ON favorites(girl_id);
`);
console.log('  ✓ favorites');

// === reviews.user_id (ALTER TABLE は idempotent じゃないので PRAGMA で確認) ===
const cols = db.prepare("PRAGMA table_info(reviews)").all();
if (!cols.find((c) => c.name === 'user_id')) {
  db.exec(`ALTER TABLE reviews ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  console.log('  ✓ reviews.user_id 列追加');
} else {
  console.log('  · reviews.user_id 既存');
}

// === 会員口コミの1人1嬢 ユニーク制約 (partial index) ===
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_girl_unique
  ON reviews(user_id, girl_id) WHERE user_id IS NOT NULL;
`);
console.log('  ✓ idx_reviews_user_girl_unique (partial, user_id NOT NULL)');

// === 集計用インデックス (検索/管理ダッシュボード用) ===
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id) WHERE user_id IS NOT NULL;
`);
console.log('  ✓ idx_reviews_user_id (partial)');

// === Verify ===
const stats = {
  users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
  sessions: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
  favorites: db.prepare('SELECT COUNT(*) as c FROM favorites').get().c,
  reviews_with_user: db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id IS NOT NULL').get().c,
};
console.log(`\n📊 現状: users=${stats.users}, sessions=${stats.sessions}, favorites=${stats.favorites}, 会員reviews=${stats.reviews_with_user}`);
console.log('✅ Migration 完了');
db.close();
