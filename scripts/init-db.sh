#!/bin/bash
# Initialize DB on persistent disk
# CRITICAL: Never overwrite existing DB - user reviews are the most important asset
#
# Strategy:
# - First deploy (no DB): download from GitHub Releases
# - Subsequent deploys: NEVER replace. User reviews live on persistent disk.
# - Master data updates happen via sync APIs or scheduled scripts, NOT by DB replacement.

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
DB_URL="https://github.com/sneed-ay/panemaji/releases/download/db-latest/panemaji.db.gz"

mkdir -p "$DB_DIR"

# Check if DB exists and is valid
DB_EXISTS=false
if [ -f "$DB_PATH" ]; then
  GIRL_COUNT=$(node -e "
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const r = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    console.log(r.c);
    db.close();
  } catch(e) { console.log('0'); }
  " 2>/dev/null || echo "0")

  if [ "$GIRL_COUNT" -gt 1000 ] 2>/dev/null; then
    DB_EXISTS=true
  fi
fi

if [ "$DB_EXISTS" = true ]; then
  # Merge strategy: download latest release DB, then merge user reviews into it
  echo "📦 Updating master data while preserving user reviews..."

  # Backup existing DB
  cp "$DB_PATH" "${DB_PATH}.bak"

  # Count ALL reviews before update
  OLD_REVIEWS=$(node -e "
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
    console.log(r.c);
    db.close();
  } catch(e) { console.log('0'); }
  " 2>/dev/null || echo "0")

  # Export ALL reviews to temp file (user + ext + import - preserve everything)
  node -e "
  const Database = require('better-sqlite3');
  const fs = require('fs');
  const db = new Database('$DB_PATH');
  const reviews = db.prepare('SELECT * FROM reviews').all();
  fs.writeFileSync('/tmp/all_reviews.json', JSON.stringify(reviews));
  console.log('Exported', reviews.length, 'reviews (all types)');
  db.close();
  " 2>/dev/null || true

  # 🚨 会員データ (users/sessions/favorites) も reviews と同様に永続保存する。
  #    これをやらないと、フレッシュ DB ダウンロードで会員テーブルが毎デプロイ全消去され、
  #    登録済み会員が消える / ログインできなくなる (過去に info@sneed.jp が消失)。
  node -e "
  const Database = require('better-sqlite3');
  const fs = require('fs');
  try {
    const db = new Database('$DB_PATH');
    const dump = (t) => { try { return db.prepare('SELECT * FROM ' + t).all(); } catch(e) { return []; } };
    const users = dump('users'), sessions = dump('sessions'), favorites = dump('favorites');
    fs.writeFileSync('/tmp/all_users.json', JSON.stringify(users));
    fs.writeFileSync('/tmp/all_sessions.json', JSON.stringify(sessions));
    fs.writeFileSync('/tmp/all_favorites.json', JSON.stringify(favorites));
    console.log('Exported members: users', users.length, '| sessions', sessions.length, '| favorites', favorites.length);
    db.close();
  } catch(e) { console.error('Member export error:', e.message); }
  " 2>/dev/null || true

  # Download fresh DB from releases
  node -e "
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const zlib = require('zlib');

  function dl(url) {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http;
      proto.get(url, {headers:{'User-Agent':'panemaji'}}, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          dl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error('HTTP '+res.statusCode)); return; }
        const gunzip = zlib.createGunzip();
        const file = fs.createWriteStream('$DB_PATH');
        res.pipe(gunzip).pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
        gunzip.on('error', reject);
      }).on('error', reject);
    });
  }

  dl('$DB_URL').then(() => {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
    const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    console.log('Downloaded fresh DB: Shops:', s.c, '| Girls:', g.c);
    db.close();
  }).catch(e => {
    console.error('Download failed, restoring backup:', e.message);
    require('fs').copyFileSync('${DB_PATH}.bak', '$DB_PATH');
  });
  " 2>/dev/null

  # Re-import ALL reviews (merge: INSERT OR IGNORE preserves new DB reviews, adds back any missing)
  node -e "
  const Database = require('better-sqlite3');
  const fs = require('fs');
  try {
    const reviews = JSON.parse(fs.readFileSync('/tmp/all_reviews.json', 'utf8'));
    if (reviews.length === 0) { console.log('No reviews to restore'); process.exit(0); }
    const db = new Database('$DB_PATH');
    const cols = Object.keys(reviews[0]);
    const placeholders = cols.map(() => '?').join(',');
    const insertSql = 'INSERT OR IGNORE INTO reviews (' + cols.join(',') + ') VALUES (' + placeholders + ')';
    const insert = db.prepare(insertSql);
    const tx = db.transaction((rows) => {
      let count = 0;
      for (const row of rows) {
        const result = insert.run(...cols.map(c => row[c]));
        count += result.changes;
      }
      return count;
    });
    const restored = tx(reviews);
    const total = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
    console.log('Restored', restored, 'new reviews from backup. Total now:', total.c);
    db.close();
  } catch(e) { console.error('Review restore error:', e.message); }
  " 2>/dev/null || true

  # Verify
  node -e "
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
    const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
    const ur = db.prepare(\"SELECT COUNT(*) as c FROM reviews WHERE browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'\").get();
    console.log('📊 Shops:', s.c, '| Girls:', g.c, '| Reviews:', r.c, '(user:', ur.c + ')');
    db.close();
  } catch(e) { console.log('❌', e.message); }
  " 2>/dev/null || true

else
  # First deploy only - download initial DB
  echo "📦 First deploy: downloading database..."
  node -e "
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const zlib = require('zlib');

  function dl(url) {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http;
      proto.get(url, {headers:{'User-Agent':'panemaji'}}, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          dl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error('HTTP '+res.statusCode)); return; }
        const gunzip = zlib.createGunzip();
        const file = fs.createWriteStream('$DB_PATH');
        res.pipe(gunzip).pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
        gunzip.on('error', reject);
      }).on('error', reject);
    });
  }

  async function main() {
    await dl('$DB_URL');
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const check = db.prepare('PRAGMA integrity_check').get();
    const girls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    console.log('✅ Initial DB downloaded:', girls.c, 'girls, integrity:', check.integrity_check);
    db.close();
  }
  main().catch(e => console.error('❌ Download error:', e.message));
  " 2>/dev/null
fi

# マイページ機能のテーブル/列を idempotent に追加 (起動毎に実行、本番でも安全)
node scripts/migrate-users-tables.mjs 2>&1 || echo "[warn] users-tables migration failed"

# 🚨 会員データ (users/sessions/favorites) を復元。
#    migrate-users-tables.mjs で空テーブルが作られた後に INSERT OR IGNORE で戻す。
#    users → sessions/favorites の順 (FK 整合性)。id を保持するので reviews.user_id 等の紐付けも維持。
#    sessions も復元するため、既存ログイン Cookie がデプロイをまたいで有効なまま。
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
function restore(db, table, file) {
  if (!fs.existsSync(file)) return 0;
  let rows;
  try { rows = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return 0; }
  if (!rows || rows.length === 0) return 0;
  const cols = Object.keys(rows[0]);
  const sql = 'INSERT OR IGNORE INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')';
  const stmt = db.prepare(sql);
  const tx = db.transaction((rs) => { let n = 0; for (const r of rs) n += stmt.run(...cols.map(c => r[c])).changes; return n; });
  return tx(rows);
}
try {
  const db = new Database('$DB_PATH');
  const u = restore(db, 'users', '/tmp/all_users.json');
  const s = restore(db, 'sessions', '/tmp/all_sessions.json');
  const f = restore(db, 'favorites', '/tmp/all_favorites.json');
  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  console.log('Restored members: +users', u, '| +sessions', s, '| +favorites', f, '(total users now:', total + ')');
  db.close();
} catch(e) { console.error('Member restore error:', e.message); }
" 2>&1 || echo "[warn] member data restore failed"

# メモリ抑制 (Render Starter 512MB):
# - --max-old-space-size=400  ... V8 heap を 400MB に強制 cap (OS+SQLite+native で 100MB 確保)
# - --expose-gc               ... global.gc() を有効化 → memory-watchdog が定期 GC 強制
#                                (sitemap streaming で出る ArrayBuffer の lazy GC 蓄積を予防)
# - UV_THREADPOOL_SIZE=2      ... libuv worker pool を縮小 (デフォルト 4 → 2)
export NODE_OPTIONS="--max-old-space-size=400 --expose-gc"
export UV_THREADPOOL_SIZE=2

exec npm run start
