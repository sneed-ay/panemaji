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

# ONE-TIME: Force overwrite with 47-prefecture data (reviews already merged)
if [ -f "$BUNDLED_DB" ]; then
  echo "🗾 Deploying 47-prefecture database to $DB_PATH..."
  cp "$BUNDLED_DB" "$DB_PATH"
  GIRL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1;" 2>/dev/null || echo "?")
  SHOP_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM shops WHERE is_active=1;" 2>/dev/null || echo "?")
  REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "?")
  echo "✅ Database deployed: Shops=$SHOP_COUNT Girls=$GIRL_COUNT Reviews=$REVIEW_COUNT"
else
  echo "⚠️ No source database found"
fi

# Start the app
exec npm run start
