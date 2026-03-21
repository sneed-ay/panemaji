#!/bin/bash
# Initialize / update DB on persistent disk
# Downloads from GitHub Releases using Node.js (curl may not be available)

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
DB_URL="https://github.com/sneed-ay/panemaji/releases/download/db-v2/panemaji.db.gz"

mkdir -p "$DB_DIR"

# Use Node.js to check current girl count (sqlite3 CLI may not be available)
CURRENT_GIRLS=$(node -e "
try {
  const Database = require('better-sqlite3');
  const db = new Database('$DB_PATH');
  const r = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
  console.log(r.c);
  db.close();
} catch(e) { console.log('0'); }
" 2>/dev/null || echo "0")

echo "📊 Current DB: $CURRENT_GIRLS girls"

# Download fresh DB if missing or outdated (< 100k girls = old/corrupted data)
if [ "$CURRENT_GIRLS" -lt 100000 ] 2>/dev/null; then
  echo "🗾 Downloading 47-prefecture database..."

  # Backup existing reviews using Node.js
  node -e "
  try {
    const Database = require('better-sqlite3');
    const fs = require('fs');
    const db = new Database('$DB_PATH');
    const reviews = db.prepare('SELECT * FROM reviews').all();
    fs.writeFileSync('/tmp/reviews_backup.json', JSON.stringify(reviews));
    console.log('💾 Reviews backed up:', reviews.length);
    db.close();
  } catch(e) { console.log('💾 No reviews to backup'); }
  " 2>/dev/null

  # Download using Node.js (handles redirects properly)
  node -e "
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const zlib = require('zlib');

  function download(url, dest) {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http;
      proto.get(url, { headers: { 'User-Agent': 'panemaji-init' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log('  Redirect to:', res.headers.location.substring(0, 80) + '...');
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const gunzip = zlib.createGunzip();
        const file = fs.createWriteStream(dest);
        let bytes = 0;
        res.on('data', (chunk) => { bytes += chunk.length; });
        res.pipe(gunzip).pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('  Downloaded:', Math.round(bytes/1024/1024) + 'MB compressed');
          resolve();
        });
        file.on('error', reject);
        gunzip.on('error', reject);
      }).on('error', reject);
    });
  }

  async function main() {
    await download('$DB_URL', '/tmp/panemaji_new.db');

    // Verify integrity
    const Database = require('better-sqlite3');
    const db = new Database('/tmp/panemaji_new.db');
    const check = db.prepare('PRAGMA integrity_check').get();
    const girls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    console.log('  Integrity:', check.integrity_check);
    console.log('  Girls:', girls.c);
    db.close();

    if (check.integrity_check === 'ok' && girls.c > 100000) {
      // Copy to final location
      fs.copyFileSync('/tmp/panemaji_new.db', '$DB_PATH');
      console.log('✅ Database deployed successfully');

      // Restore reviews
      try {
        const backup = JSON.parse(fs.readFileSync('/tmp/reviews_backup.json', 'utf-8'));
        if (backup.length > 0) {
          const newDb = new Database('$DB_PATH');
          newDb.pragma('journal_mode = WAL');
          const insert = newDb.prepare('INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
          let restored = 0;
          for (const r of backup) {
            if (insert.run(r.girl_id, r.visit_date, r.panel_rating, r.comment, r.browser_id, r.created_at).changes > 0) restored++;
          }
          console.log('🔄 Reviews restored:', restored + '/' + backup.length);
          newDb.close();
        }
      } catch(e) { console.log('🔄 No reviews to restore'); }
    } else {
      console.log('❌ Downloaded DB failed verification');
    }

    // Cleanup
    try { fs.unlinkSync('/tmp/panemaji_new.db'); } catch {}
    try { fs.unlinkSync('/tmp/reviews_backup.json'); } catch {}
  }
  main().catch(e => console.error('❌ Download failed:', e.message));
  " 2>/dev/null

  # Final verification
  FINAL_GIRLS=$(node -e "
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
    const p = db.prepare('SELECT COUNT(DISTINCT prefecture) as c FROM areas WHERE prefecture IS NOT NULL').get();
    const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
    console.log('📊 Prefectures: ' + p.c + ' | Shops: ' + s.c + ' | Girls: ' + g.c + ' | Reviews: ' + r.c);
    db.close();
  } catch(e) { console.log('❌ DB verification failed: ' + e.message); }
  " 2>/dev/null)
  echo "$FINAL_GIRLS"
else
  echo "✅ Database is up to date"
fi

exec npm run start
