#!/bin/bash
# Initialize / update DB on persistent disk
# - First deploy: copy bundled DB
# - Subsequent deploys: merge master data (areas/shops/girls) while preserving reviews

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
BUNDLED_DB="./panemaji.db"

mkdir -p "$DB_DIR"

if [ ! -f "$DB_PATH" ]; then
  # First deploy: copy bundled DB as-is
  echo "📦 First deploy: copying database to $DB_PATH..."
  if [ -f "$BUNDLED_DB" ]; then
    cp "$BUNDLED_DB" "$DB_PATH"
    echo "✅ Database initialized on persistent disk"
  else
    echo "⚠️ No source database found, app will create empty DB"
  fi
elif [ -f "$BUNDLED_DB" ] && [ "$BUNDLED_DB" != "$DB_PATH" ]; then
  # Subsequent deploy: update master data, preserve reviews
  BUNDLED_SIZE=$(wc -c < "$BUNDLED_DB" | tr -d ' ')
  DISK_SIZE=$(wc -c < "$DB_PATH" | tr -d ' ')
  echo "📊 Bundled DB: ${BUNDLED_SIZE} bytes, Disk DB: ${DISK_SIZE} bytes"

  if [ "$BUNDLED_SIZE" != "$DISK_SIZE" ]; then
    echo "🔄 Updating master data (areas/shops/girls)..."

    # Backup reviews from persistent disk
    sqlite3 "$DB_PATH" ".dump reviews" > /tmp/reviews_backup.sql 2>/dev/null

    REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "0")
    echo "💾 Backed up $REVIEW_COUNT reviews"

    # Replace DB with new bundled version
    cp "$BUNDLED_DB" "$DB_PATH"

    # Restore reviews
    if [ -s /tmp/reviews_backup.sql ]; then
      # Drop the empty reviews table from new DB and restore from backup
      sqlite3 "$DB_PATH" "DELETE FROM reviews;" 2>/dev/null
      sqlite3 "$DB_PATH" < /tmp/reviews_backup.sql 2>/dev/null
      RESTORED=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "0")
      echo "✅ Restored $RESTORED reviews"
    fi

    rm -f /tmp/reviews_backup.sql
    echo "✅ Master data updated successfully"
  else
    echo "✅ Database unchanged (same size), skipping update"
  fi
else
  echo "✅ Database exists at $DB_PATH ($(du -h "$DB_PATH" | cut -f1))"
fi

# Start the app
exec npm run start
