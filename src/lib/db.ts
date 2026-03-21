import Database from 'better-sqlite3';
import path from 'path';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // During build on Render, DB file may not exist - try to open, fall through if missing

  // Support persistent disk: use DB_PATH env var if set, fallback to cwd
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'panemaji.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area_id INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'デリヘル',
      description TEXT,
      source_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (area_id) REFERENCES areas(id)
    );
    CREATE TABLE IF NOT EXISTS girls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shop_id INTEGER NOT NULL,
      age INTEGER,
      height INTEGER,
      bust INTEGER,
      waist INTEGER,
      hip INTEGER,
      cup TEXT,
      image_url TEXT,
      source_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_girls_source_id ON girls(source_id) WHERE source_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      girl_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL,
      panel_rating TEXT NOT NULL CHECK(panel_rating IN ('panel_match', 'panel_diff', 'jirai')),
      comment TEXT,
      browser_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (girl_id) REFERENCES girls(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique ON reviews(girl_id, browser_id);

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_girls_shop_id ON girls(shop_id);
    CREATE INDEX IF NOT EXISTS idx_girls_shop_active ON girls(shop_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_girls_is_active ON girls(is_active);
    CREATE INDEX IF NOT EXISTS idx_reviews_girl_id ON reviews(girl_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_girl_rating ON reviews(girl_id, panel_rating);
    CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shops_area_active ON shops(area_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_shops_is_active ON shops(is_active);
    CREATE INDEX IF NOT EXISTS idx_shops_name ON shops(name);
    CREATE INDEX IF NOT EXISTS idx_areas_slug ON areas(slug);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      category TEXT NOT NULL DEFAULT '一般的なお問い合わせ',
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add twitter_url column if missing
  const girlCols = (_db.prepare('PRAGMA table_info(girls)').all() as { name: string }[]).map((c) => c.name);
  if (!girlCols.includes('twitter_url')) {
    _db.exec('ALTER TABLE girls ADD COLUMN twitter_url TEXT');
  }

  // Add tweet_settings table for rate limiting
  _db.exec(`
    CREATE TABLE IF NOT EXISTS tweet_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Add prefecture column to areas if missing
  const areaCols = (_db.prepare('PRAGMA table_info(areas)').all() as { name: string }[]).map((c) => c.name);
  if (!areaCols.includes('prefecture')) {
    _db.exec("ALTER TABLE areas ADD COLUMN prefecture TEXT NOT NULL DEFAULT '東京'");
    // Set Kanagawa areas (id 27-37)
    _db.exec("UPDATE areas SET prefecture = '神奈川' WHERE id >= 27 AND id <= 37");
  }

  // Optimize SQLite for read-heavy workload
  _db.pragma('cache_size = -20000'); // 20MB cache
  _db.pragma('temp_store = MEMORY');

  return _db;
}

const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

export default db;

export type Area = {
  id: number;
  name: string;
  slug: string;
  prefecture: string;
};

export type Shop = {
  id: number;
  name: string;
  area_id: number;
  area_name?: string;
  area_slug?: string;
  category: string;
  description: string | null;
  source_url: string | null;
  is_active: number;
  last_seen_at: string | null;
  girl_count?: number;
  review_count?: number;
  panel_match_count?: number;
  panel_diff_count?: number;
  jirai_count?: number;
  real_pct?: number;
};

export type Girl = {
  id: number;
  name: string;
  shop_id: number;
  shop_name?: string;
  area_name?: string;
  area_slug?: string;
  age: number | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  cup: string | null;
  image_url: string | null;
  source_id: string | null;
  twitter_url: string | null;
  is_active: number;
  last_seen_at: string | null;
  review_count?: number;
  panel_match_count?: number;
  panel_diff_count?: number;
  jirai_count?: number;
  real_pct?: number;
};

export type Review = {
  id: number;
  girl_id: number;
  girl_name?: string;
  shop_name?: string;
  girl_image_url?: string | null;
  visit_date: string;
  panel_rating: 'panel_match' | 'panel_diff' | 'jirai';
  comment: string | null;
  created_at: string;
};
