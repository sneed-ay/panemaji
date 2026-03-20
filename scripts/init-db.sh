#!/bin/bash
# Initialize / update DB on persistent disk
# CRITICAL: Never overwrite the persistent DB - reviews are the most important asset
#
# Strategy:
# - First deploy: copy bundled DB as-is
# - Subsequent deploys: NEVER replace the DB. Master data (areas/shops/girls)
#   is updated by the app's db.ts migration code at startup.
#   To update master data, use the scraping scripts or SQL migrations.

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
BUNDLED_DB="./panemaji.db"

mkdir -p "$DB_DIR"

if [ ! -f "$DB_PATH" ]; then
  # First deploy only: copy bundled DB
  echo "📦 First deploy: copying database to $DB_PATH..."
  if [ -f "$BUNDLED_DB" ]; then
    cp "$BUNDLED_DB" "$DB_PATH"
    echo "✅ Database initialized on persistent disk"
  else
    echo "⚠️ No source database found, app will create empty DB"
  fi
else
  # Subsequent deploys: NEVER touch the persistent DB
  DISK_SIZE=$(du -h "$DB_PATH" | cut -f1)
  REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "?")
  GIRL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1;" 2>/dev/null || echo "?")
  SHOP_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM shops WHERE is_active=1;" 2>/dev/null || echo "?")
  echo "✅ Using existing database at $DB_PATH ($DISK_SIZE)"
  echo "   📊 Shops: $SHOP_COUNT | Girls: $GIRL_COUNT | Reviews: $REVIEW_COUNT"
  echo "   ⚠️ DB is preserved across deploys - reviews are safe"
fi

# Start the app
exec npm run start
