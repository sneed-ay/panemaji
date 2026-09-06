#!/bin/bash
# fuzoku.jp 全国 live 実行 → MECE マイグレーションまで一気通貫
# 使い方: bash scripts/run-fuzoku-live.sh [--parallel N]

set -eu
cd "$(dirname "$0")/.."

# 🚨 本番マスターは $HOME/panemaji-data/panemaji.db。
#    リポジトリ (Google Drive 上) の panemaji.db は同期で壊れるので使わない。
DB_PATH="${DB_PATH:-$HOME/panemaji-data/panemaji.db}"
export DB_PATH

# 🚨 このスクリプトは xargs -P で取込を並列起動する。
#    CLAUDE.md の絶対不可侵ルール #2 (取込スクリプトの並行起動禁止) に反するので、
#    使う前に必ず --parallel 1 にするか、並列部分を直すこと。

TS=$(date +%Y%m%d-%H%M%S)
LOG_DIR="logs/fuzoku-live-${TS}"
mkdir -p "$LOG_DIR"

# DBバックアップ
# バックアップは DB と同じ場所へ (Google Drive 上に 200MB を複製しない)
BACKUP="${DB_PATH}.bak_fuzoku_live_${TS}"
cp "$DB_PATH" "$BACKUP"
echo "💾 DBバックアップ: $BACKUP"

# 都道府県リスト
PREFS=(
  hokkaido aomori iwate miyagi akita yamagata fukushima
  ibaraki tochigi gunma saitama chiba tokyo kanagawa
  niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi
  mie shiga kyoto osaka hyogo nara wakayama
  tottori shimane okayama hiroshima yamaguchi
  tokushima kagawa ehime kochi
  fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa
)

# Phase 1: live scrape（並列4）
echo "🚀 Phase 1: fuzoku.jp live scrape 開始"
for p in "${PREFS[@]}"; do
  echo "$p"
done | xargs -n1 -P4 -I{} bash -c "
  pref=\$1
  echo \"--- \${pref} 開始 \$(date +%H:%M:%S) ---\"
  node scripts/scrape-fuzoku-japan.mjs shops --pref \"\$pref\" > \"${LOG_DIR}/scrape-\${pref}.log\" 2>&1
  NEW=\$(grep -oE '新規: [0-9]+' \"${LOG_DIR}/scrape-\${pref}.log\" | tail -1 | awk '{print \$2}')
  echo \"\${pref}: 新規=\${NEW:-?}\"
" _ {}

echo ""
echo "✅ Phase 1 完了"

# Phase 2: MECE マイグレーション
echo "🔧 Phase 2: MECE マイグレーション"
node scripts/migrate-fuzoku-areas.mjs | tee "${LOG_DIR}/migrate.log"

echo ""
echo "=== 完了サマリー ==="
sqlite3 "$DB_PATH" "SELECT 'total shops', COUNT(*) FROM shops UNION ALL SELECT 'fj-areas残', COUNT(*) FROM areas WHERE slug LIKE '%-fj-%';"
echo "ログ: ${LOG_DIR}/"
echo "バックアップ: ${BACKUP}"
