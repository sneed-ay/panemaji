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

exec npm run start
