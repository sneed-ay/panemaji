#!/bin/bash
# Initialize / update DB on persistent disk
# Downloads from GitHub Releases to avoid Git binary corruption

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
DB_URL="https://github.com/sneed-ay/panemaji/releases/download/db-v2/panemaji.db.gz"

mkdir -p "$DB_DIR"

# Check if DB needs update by checking girl count
CURRENT_GIRLS=0
if [ -f "$DB_PATH" ]; then
  CURRENT_GIRLS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1;" 2>/dev/null || echo "0")
fi

echo "📊 Current DB: $CURRENT_GIRLS girls"

# Download fresh DB if missing, corrupted, or outdated (< 100k girls = old data)
if [ ! -f "$DB_PATH" ] || [ "$CURRENT_GIRLS" -lt 100000 ] 2>/dev/null; then
  echo "🗾 Downloading 47-prefecture database from GitHub Releases..."

  # Backup existing reviews first
  if [ -f "$DB_PATH" ] && [ "$CURRENT_GIRLS" -gt 0 ]; then
    echo "💾 Backing up existing reviews..."
    sqlite3 "$DB_PATH" ".dump reviews" > /tmp/reviews_backup.sql 2>/dev/null || true
    REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "0")
    echo "   Reviews backed up: $REVIEW_COUNT"
  fi

  # Download and decompress
  curl -sL "$DB_URL" -o /tmp/panemaji.db.gz
  if [ $? -eq 0 ] && [ -s /tmp/panemaji.db.gz ]; then
    gunzip -f /tmp/panemaji.db.gz

    # Verify integrity
    INTEGRITY=$(sqlite3 /tmp/panemaji.db "PRAGMA integrity_check;" 2>/dev/null)
    if [ "$INTEGRITY" = "ok" ]; then
      cp /tmp/panemaji.db "$DB_PATH"
      echo "✅ Database downloaded and verified"

      # Restore reviews from backup
      if [ -f /tmp/reviews_backup.sql ]; then
        echo "🔄 Restoring reviews..."
        sqlite3 "$DB_PATH" < /tmp/reviews_backup.sql 2>/dev/null || true
        NEW_REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "0")
        echo "   Reviews restored: $NEW_REVIEW_COUNT"
      fi
    else
      echo "❌ Downloaded DB failed integrity check, keeping existing"
    fi
    rm -f /tmp/panemaji.db /tmp/panemaji.db.gz /tmp/reviews_backup.sql
  else
    echo "❌ Download failed, keeping existing DB"
  fi
else
  echo "✅ Database is up to date ($CURRENT_GIRLS girls)"
fi

# Final stats
if [ -f "$DB_PATH" ]; then
  GIRL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1;" 2>/dev/null || echo "?")
  SHOP_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM shops WHERE is_active=1;" 2>/dev/null || echo "?")
  REVIEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM reviews;" 2>/dev/null || echo "?")
  PREF_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT prefecture) FROM areas WHERE prefecture IS NOT NULL;" 2>/dev/null || echo "?")
  echo "📊 Prefectures: $PREF_COUNT | Shops: $SHOP_COUNT | Girls: $GIRL_COUNT | Reviews: $REVIEW_COUNT"
fi

exec npm run start
