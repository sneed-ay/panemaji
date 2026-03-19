#!/bin/bash
# Initialize DB on persistent disk if not exists
# This runs before the app starts on Render

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")

# Create directory if needed
mkdir -p "$DB_DIR"

# If DB doesn't exist on disk yet, copy the bundled one
if [ ! -f "$DB_PATH" ]; then
  echo "📦 Initializing database at $DB_PATH..."
  if [ -f "./panemaji.db" ]; then
    cp ./panemaji.db "$DB_PATH"
    echo "✅ Database copied to persistent disk"
  else
    echo "⚠️ No source database found, app will create empty DB"
  fi
else
  echo "✅ Database already exists at $DB_PATH ($(du -h "$DB_PATH" | cut -f1))"
fi

# Start the app
exec npm run start
