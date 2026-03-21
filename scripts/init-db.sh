#!/bin/bash
DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
BUNDLED_DB="./panemaji.db"

mkdir -p "$DB_DIR"

# Force update: deploy 47-prefecture DB (reviews merged)
if [ -f "$BUNDLED_DB" ]; then
  echo "🗾 Deploying 47-prefecture database..."
  cp "$BUNDLED_DB" "$DB_PATH"
  echo "✅ Database updated"
fi

if false; then
  DISK_SIZE=$(du -h "$DB_PATH" | cut -f1)
  REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "?")
  GIRL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1;" 2>/dev/null || echo "?")
  SHOP_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM shops WHERE is_active=1;" 2>/dev/null || echo "?")
  PREF_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT prefecture) FROM areas WHERE prefecture IS NOT NULL;" 2>/dev/null || echo "?")
  echo "✅ Using existing database at $DB_PATH ($DISK_SIZE)"
  echo "   📊 Prefectures: $PREF_COUNT | Shops: $SHOP_COUNT | Girls: $GIRL_COUNT | Reviews: $REVIEW_COUNT"
  echo "   ⚠️ DB is preserved across deploys - reviews are safe"
fi

exec npm run start
