#!/bin/bash
# ============================================================================
# Overnight chained image fill orchestrator
#
# 走行順:
#   1. rd image fill (既に走ってる PID を 待つ。 死んだら次へ)
#   2. purelovers image fill (ベストエフォート ~600 images)
#   3. 最終 stats を logs/overnight-chain-summary.log に 書く
#
# nohup で 起動して 自分のセッション切断後も 走り続ける用。
# ============================================================================
set -u

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# 🚨 本番マスターは $HOME/panemaji-data/panemaji.db (daily-maintenance.sh:27 と同じ既定)。
#    リポジトリは Google Drive 上にあり、そこの panemaji.db は同期で壊れる。
#    export しないと fill-missing-images-safe.mjs が破損DBを read-write で開き、
#    ログのカバレッジ数値も死んだスナップショット由来の嘘になる (2026-09-06 判明)。
DB_PATH="${DB_PATH:-$HOME/panemaji-data/panemaji.db}"
export DB_PATH
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
SUMMARY="$LOG_DIR/overnight-chain-summary.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$SUMMARY"
}

# 既に他の overnight-chain が 走ってないか 確認 (二重起動防止)
SELF_PID=$$
PARENT_LOCK="$PROJECT_ROOT/.overnight-chain.lock"
if [ -f "$PARENT_LOCK" ]; then
  OTHER_PID=$(cat "$PARENT_LOCK" 2>/dev/null || echo "")
  if [ -n "$OTHER_PID" ] && /bin/kill -0 "$OTHER_PID" 2>/dev/null; then
    log "[lock] overnight-chain は 既に PID $OTHER_PID で走行中 — exit"
    exit 0
  else
    rm -f "$PARENT_LOCK"
  fi
fi
echo "$SELF_PID" > "$PARENT_LOCK"
trap 'rm -f "$PARENT_LOCK"' EXIT INT TERM

log "=========================================="
log "  Overnight image fill chain 開始"
log "=========================================="

# ─── Step 1: 既存 rd fill を 待つ ─────────────────
# 引数で PID を渡せる: ./overnight-image-chain.sh 14545
RD_PID="${1:-}"
if [ -z "$RD_PID" ]; then
  # 引数なしなら pgrep で 見つける
  RD_PID=$(pgrep -f "fill-missing-images-safe.mjs.*--source=rd" | head -1 || true)
fi

if [ -n "$RD_PID" ] && /bin/kill -0 "$RD_PID" 2>/dev/null; then
  log "[step 1] rd fill PID $RD_PID が 走行中 — 完了を待つ..."
  # ポーリングで 待つ (kill 0 で 死活確認)
  while /bin/kill -0 "$RD_PID" 2>/dev/null; do
    sleep 30
  done
  log "[step 1] rd fill PID $RD_PID 完了"
else
  log "[step 1] rd fill PID 見つからず — skip して step 2 へ"
fi

# 待機 (DB sync が 落ち着くまで)
sleep 5

# 中間 stats
NO_IMG_BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1 AND (image_url IS NULL OR image_url='')")
log "[stats] rd fill 後 no-img: $NO_IMG_BEFORE"

# ─── Step 2: purelovers fill ─────────────────────
log "[step 2] purelovers fill 開始 (ベストエフォート)"
PURE_LOG="$LOG_DIR/overnight-purelovers.log"
if node "$PROJECT_ROOT/scripts/fill-missing-images-safe.mjs" --source=purelovers > "$PURE_LOG" 2>&1; then
  log "[step 2] purelovers fill 完了 → $PURE_LOG"
else
  log "[step 2] purelovers fill エラー (exit=$?) — 詳細 $PURE_LOG"
fi

NO_IMG_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1 AND (image_url IS NULL OR image_url='')")
log "[stats] purelovers fill 後 no-img: $NO_IMG_AFTER (差分: $((NO_IMG_BEFORE - NO_IMG_AFTER)))"

# ─── Step 3: 最終サマリ ──────────────────────────
TOTAL_ACTIVE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM girls WHERE is_active=1")
IMG_PCT=$(echo "scale=1; (1 - $NO_IMG_AFTER / $TOTAL_ACTIVE) * 100" | bc 2>/dev/null || echo "?")

log "=========================================="
log "  Overnight image fill chain 完了"
log "  total active girls: $TOTAL_ACTIVE"
log "  画像なし girls: $NO_IMG_AFTER"
log "  画像カバレッジ: ${IMG_PCT}%"
log "=========================================="
