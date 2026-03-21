#!/bin/bash
# Copy downloaded DB to persistent disk, preserving reviews
DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
BUNDLED_DB="./panemaji.db"

mkdir -p "$DB_DIR"

if [ -f "$BUNDLED_DB" ]; then
  BUNDLED_SIZE=$(wc -c < "$BUNDLED_DB" | tr -d ' ')
  echo "📦 Bundled DB: ${BUNDLED_SIZE} bytes"

  # If persistent DB exists, backup reviews before replacing
  if [ -f "$DB_PATH" ] && [ "$DB_PATH" != "$BUNDLED_DB" ]; then
    echo "💾 Backing up reviews from persistent DB..."
    # Use node to backup reviews (sqlite3 CLI not available on Render)
    node -e "
    const fs = require('fs');
    try {
      const Database = require('better-sqlite3');
      const db = new Database('$DB_PATH');
      const reviews = db.prepare('SELECT * FROM reviews').all();
      const settings = db.prepare('SELECT * FROM tweet_settings').all();
      fs.writeFileSync('/tmp/reviews.json', JSON.stringify({reviews, settings}));
      console.log('  Reviews:', reviews.length, '| Tweet settings:', settings.length);
      db.close();
    } catch(e) { console.log('  No data to backup:', e.message); }
    " 2>/dev/null || true
  fi

  # Copy new DB (only if different or larger)
  if [ "$BUNDLED_SIZE" -gt 30000000 ] 2>/dev/null; then
    cp "$BUNDLED_DB" "$DB_PATH"
    echo "✅ Database deployed (47 prefectures)"

    # Restore reviews
    if [ -f /tmp/reviews.json ]; then
      node -e "
      const fs = require('fs');
      try {
        const Database = require('better-sqlite3');
        const db = new Database('$DB_PATH');
        db.pragma('journal_mode = WAL');
        const backup = JSON.parse(fs.readFileSync('/tmp/reviews.json', 'utf-8'));
        if (backup.reviews && backup.reviews.length > 0) {
          const ins = db.prepare('INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
          let c = 0;
          for (const r of backup.reviews) { if (ins.run(r.girl_id, r.visit_date, r.panel_rating, r.comment, r.browser_id, r.created_at).changes) c++; }
          console.log('  🔄 Reviews restored:', c);
        }
        if (backup.settings && backup.settings.length > 0) {
          const ins2 = db.prepare('INSERT OR REPLACE INTO tweet_settings (key, value) VALUES (?, ?)');
          for (const s of backup.settings) ins2.run(s.key, s.value);
        }
        db.close();
      } catch(e) { console.log('  Restore error:', e.message); }
      " 2>/dev/null || true
      rm -f /tmp/reviews.json
    fi
  else
    echo "⚠️ Bundled DB too small (${BUNDLED_SIZE}), keeping existing"
  fi
fi

# Show final stats
node -e "
try {
  const Database = require('better-sqlite3');
  const db = new Database('$DB_PATH');
  const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
  const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
  const p = db.prepare('SELECT COUNT(DISTINCT prefecture) as c FROM areas WHERE prefecture IS NOT NULL').get();
  const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
  console.log('📊 Prefs:', p.c, '| Shops:', s.c, '| Girls:', g.c, '| Reviews:', r.c);
  db.close();
} catch(e) { console.log('❌', e.message); }
" 2>/dev/null || true

exec npm run start
