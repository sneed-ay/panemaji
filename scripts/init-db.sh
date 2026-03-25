#!/bin/bash
# Initialize DB on persistent disk
# Strategy: Always try to download latest DB at startup if current is outdated
DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
DB_URL="https://github.com/sneed-ay/panemaji/releases/download/db-latest/panemaji.db.gz"

mkdir -p "$DB_DIR"

# Check current DB girl count using Node.js
CURRENT_GIRLS=$(node -e "
try {
  const Database = require('better-sqlite3');
  const db = new Database('$DB_PATH');
  console.log(db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get().c);
  db.close();
} catch(e) { console.log('0'); }
" 2>/dev/null || echo "0")

echo "📊 Current DB: $CURRENT_GIRLS girls"

# Download if DB is missing/outdated (< 100k girls means old data)
if [ "$CURRENT_GIRLS" -lt 100000 ] 2>/dev/null; then
  echo "🗾 Downloading latest database..."

  # Backup user reviews (not ext-trend) from existing DB
  node -e "
  const fs = require('fs');
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const reviews = db.prepare(\"SELECT * FROM reviews WHERE browser_id NOT LIKE 'ext-%'\").all();
    const settings = db.prepare('SELECT * FROM tweet_settings').all();
    fs.writeFileSync('/tmp/user_reviews.json', JSON.stringify({reviews, settings}));
    console.log('  💾 User reviews backed up:', reviews.length);
    db.close();
  } catch(e) { console.log('  No existing data to backup'); }
  " 2>/dev/null || true

  # Download using Node.js (handles redirects)
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
        const file = fs.createWriteStream('/tmp/panemaji_dl.db');
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
    const db = new Database('/tmp/panemaji_dl.db');
    const check = db.prepare('PRAGMA integrity_check').get();
    const girls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    db.close();

    if (check.integrity_check === 'ok' && girls.c > 100000) {
      fs.copyFileSync('/tmp/panemaji_dl.db', '$DB_PATH');
      console.log('✅ DB downloaded:', girls.c, 'girls');

      // Restore user reviews
      try {
        const backup = JSON.parse(fs.readFileSync('/tmp/user_reviews.json','utf-8'));
        if (backup.reviews && backup.reviews.length > 0) {
          const newDb = new Database('$DB_PATH');
          newDb.pragma('journal_mode = WAL');
          const ins = newDb.prepare('INSERT OR IGNORE INTO reviews (girl_id,visit_date,panel_rating,comment,browser_id,created_at) VALUES (?,?,?,?,?,?)');
          let c = 0;
          for (const r of backup.reviews) { if(ins.run(r.girl_id,r.visit_date,r.panel_rating,r.comment,r.browser_id,r.created_at).changes) c++; }
          console.log('  🔄 User reviews restored:', c);
          if (backup.settings) {
            const ins2 = newDb.prepare('INSERT OR REPLACE INTO tweet_settings (key,value) VALUES (?,?)');
            for (const s of backup.settings) ins2.run(s.key, s.value);
          }
          newDb.close();
        }
      } catch(e) {}
    } else {
      console.log('❌ Download failed integrity check');
    }
    try { fs.unlinkSync('/tmp/panemaji_dl.db'); } catch{}
    try { fs.unlinkSync('/tmp/user_reviews.json'); } catch{}
  }
  main().catch(e => console.error('❌ Download error:', e.message));
  " 2>/dev/null
fi

# Final stats
node -e "
try {
  const Database = require('better-sqlite3');
  const db = new Database('$DB_PATH');
  const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
  const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
  const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
  console.log('📊 Shops:', s.c, '| Girls:', g.c, '| Reviews:', r.c);
  db.close();
} catch(e) { console.log('❌', e.message); }
" 2>/dev/null || true

exec npm run start
