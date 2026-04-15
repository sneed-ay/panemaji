#!/bin/bash
# 全スクレイピング完了を待ってからDBをGitHub ReleasesにアップロードしRenderをデプロイする
#
# 使い方: nohup bash scripts/deploy-after-scrape.sh > /tmp/deploy-after-scrape.log 2>&1 &

set -e
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
DB_PATH="$PROJECT_ROOT/panemaji.db"

echo "=== deploy-after-scrape started at $(date) ==="
echo "Waiting for all scraping processes to complete..."

# 全プロセス完了待ち
while true; do
  RUNNING=$(ps aux | grep -E "refetch-girls\.mjs|scrape-menesu\.mjs|scrape-menesthe\.mjs" | grep -v grep | wc -l | tr -d ' ')
  if [ "$RUNNING" = "0" ]; then
    echo "All scraping processes completed at $(date)"
    break
  fi
  echo "  $(date '+%H:%M') - $RUNNING processes still running..."
  sleep 120
done

echo ""
echo "=== Scraping Logs Summary ==="
echo "--- refetch-girls ---"
tail -5 /tmp/refetch-girls.log 2>/dev/null || echo "(no log)"
echo "--- scrape-menesu ---"
tail -5 /tmp/scrape-menesu.log 2>/dev/null || echo "(no log)"
echo "--- scrape-menesthe ---"
tail -5 /tmp/scrape-menesthe.log 2>/dev/null || echo "(no log)"
echo ""

# DB統計
echo "=== DB Statistics ==="
node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');
const shops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
const girls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
const reviews = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
const zeroGirls = db.prepare(\"SELECT COUNT(*) as c FROM shops s WHERE s.is_active=1 AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)\").get();
const exactly100 = db.prepare(\"SELECT COUNT(*) as c FROM shops s WHERE s.is_active=1 AND (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1) = 100\").get();
console.log('  Shops:', shops.c);
console.log('  Girls:', girls.c);
console.log('  Reviews:', reviews.c);
console.log('  0-girl shops:', zeroGirls.c);
console.log('  Exactly 100-girl shops:', exactly100.c);
db.close();
"

# DBをgzip圧縮
echo ""
echo "=== Compressing DB ==="
gzip -c "$DB_PATH" > "$DB_PATH.gz"
ls -lh "$DB_PATH.gz"

# GitHub Releasesにアップロード
echo ""
echo "=== Uploading to GitHub Releases ==="
gh release upload db-latest "$DB_PATH.gz" --repo sneed-ay/panemaji --clobber
echo "Upload complete!"

# Renderデプロイトリガー（Renderはgit pushで自動デプロイ）
# DB更新のためにはRenderのデプロイを手動トリガーする必要がある
echo ""
echo "=== Triggering Render Deploy ==="
# 空コミットでデプロイトリガー
cd "$PROJECT_ROOT"
if [ -d .git ]; then
  git add -A scripts/refetch-girls.mjs scripts/scrape-menesthe.mjs 2>/dev/null || true
  git commit -m "chore: update scraping scripts and trigger deploy for new data" --allow-empty 2>/dev/null || true
  git push origin main 2>/dev/null || echo "Push skipped (may not be on main branch)"
fi

echo ""
echo "=== DONE at $(date) ==="
echo "DB uploaded to GitHub Releases (db-latest)"
echo "Render deploy triggered (will download new DB on next build)"
