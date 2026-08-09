#!/bin/bash
# fuzoku.jp 全国 live 実行 → MECE マイグレーションまで一気通貫
# 使い方: bash scripts/run-fuzoku-live.sh [--parallel N]

set -eu
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)
LOG_DIR="logs/fuzoku-live-${TS}"
mkdir -p "$LOG_DIR"

# DBバックアップ
BACKUP="panemaji.db.bak_fuzoku_live_${TS}"
cp panemaji.db "$BACKUP"
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
sqlite3 panemaji.db "SELECT 'total shops', COUNT(*) FROM shops UNION ALL SELECT 'fj-areas残', COUNT(*) FROM areas WHERE slug LIKE '%-fj-%';"
echo "ログ: ${LOG_DIR}/"
echo "バックアップ: ${BACKUP}"
