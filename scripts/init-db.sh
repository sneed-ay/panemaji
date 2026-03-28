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
  # DB exists and is valid - NEVER overwrite
  echo "✅ Existing database preserved (user reviews safe)"
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
