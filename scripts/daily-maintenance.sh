#!/bin/bash
# ============================================================================
# パネマジ掲示板 - 日次データメンテナンスパイプライン
#
# 使い方:
#   bash scripts/daily-maintenance.sh           # フル実行
#   bash scripts/daily-maintenance.sh --quick    # 差分更新のみ（force なし）
#   bash scripts/daily-maintenance.sh --force    # 全店舗を強制再取得
#
# 処理フロー:
#   Phase 1: データ収集（新規店舗・嬢の取得）
#   Phase 2: データ品質メンテナンス（重複排除・名前クリーニング）
#   Phase 3: DB圧縮・アップロード・デプロイ
#
# ルール（.claude/settings.md に準拠）:
#   - 口コミは収集しない（ユーザー投稿のみ）
#   - 重複店舗は嬢が多い方に統合
#   - 空名前・記号名・宣伝文名の嬢は非アクティブ化
#   - カテゴリは6種のみ（デリヘル/ソープ/ヘルス/ホテヘル/メンエス/エステ・アロマ）
#   - セクキャバは対象外
# ============================================================================

set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
# Render では /data/panemaji.db（env 経由）。ローカルは Google Drive破損回避のため $HOME 配下(ローカルディスク)に置く。
DB_PATH="${DB_PATH:-$HOME/panemaji-data/panemaji.db}"
export DB_PATH
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-$(date +%Y%m%d-%H%M).log"

# ----------------------------------------------------------------------
# 重複起動防止 (CLAUDE.md 絶対不可侵ルール #2 への対応)
#   - 既に daily-maintenance.sh が走っている場合は 何もせず exit
#   - 走ってない場合は LOCK_FILE に自分の PID を書く
#   - 終了時に LOCK_FILE を消す
#   - 過去事例: 手動 + 04:06 scheduled-task の二重起動で puppeteer 競合 +
#     DB lock + areas 膨張 (5/10 朝に発生)
# ----------------------------------------------------------------------
LOCK_FILE="$PROJECT_ROOT/.daily-maintenance.lock"
if [ -f "$LOCK_FILE" ]; then
  OTHER_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$OTHER_PID" ] && /bin/kill -0 "$OTHER_PID" 2>/dev/null; then
    echo "[lock] daily-maintenance.sh は既に PID $OTHER_PID で走行中 — 重複起動を回避して exit 0"
    exit 0
  else
    echo "[lock] stale lock file (PID $OTHER_PID is gone) — 削除して続行"
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT INT TERM

# ----------------------------------------------------------------------
# 🚨 外部 scraper 検知 (2026-06-03 恒久対策)
#   既存ロックは「他の daily-maintenance」しか見ないため、手動の ad-hoc scraper
#   (fill-missing-images-safe / scrape-* / update-all 等) と並行起動して
#   ローカル DB を破損させる事故が起きた (girls 40.7万→27.2万 の誤非アクティブ化)。
#   開始時点で外部 scraper が走行中なら衝突回避で exit する。
# ----------------------------------------------------------------------
EXT_SCRAPER=$(pgrep -f "fill-missing-images-safe|scrape-images|scrape-rankingdeli|scrape-purelovers|scrape-cityheaven|scrape-fuzoku|scrape-menesu|update-all|refetch-girls|refresh-source-girls|recheck-closed-shops" 2>/dev/null | grep -vx "$$" | head -1 || true)
if [ -n "$EXT_SCRAPER" ]; then
  echo "[lock] 外部 scraper (PID $EXT_SCRAPER) が走行中 — 衝突回避で exit 0 (trap が LOCK_FILE を掃除)"
  exit 0
fi

# macOS には GNU timeout がないので gtimeout（coreutils）にフォールバック。
# 両方とも無い場合は警告して素通し実行（タイムアウト無し）。
if command -v timeout &>/dev/null; then
  TIMEOUT="timeout"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT="gtimeout"
else
  echo "[warn] timeout / gtimeout どちらも見つからないためタイムアウト無しで実行します (brew install coreutils 推奨)"
  TIMEOUT=""
fi

# timeout が無い環境でも壊れないラッパ。
#   従来の `$TIMEOUT 14400 node ...` は TIMEOUT が空だと `14400 node ...` になり
#   「14400 というコマンドが無い」で即死していた (フォールバックが機能していなかった)。
#   併せて -k を付ける: SIGTERM を無視した puppeteer が居座って timeout が効かず
#   丸一日パイプラインが止まった事故があった (2026-07-08)。猶予後に SIGKILL する。
# 使い方: run_timeout <秒> <コマンド...>
run_timeout() {
  local secs="$1"; shift
  if [ -n "$TIMEOUT" ]; then
    "$TIMEOUT" -k 120 "$secs" "$@"
  else
    "$@"
  fi
}

FORCE_FLAG=""
QUICK_MODE=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE_FLAG="--force" ;;
    --quick) QUICK_MODE=true ;;
  esac
done

# ログ出力
log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

log "=========================================="
log "  パネマジ日次メンテナンス開始"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "=========================================="

# 🚨 自己修復 (2026-06-03): ローカル DB が無い/破損していたら db-latest を再取得する。
#    (手動検証中に Google Drive 書き込みで $DB_PATH を破損させ daily-maintenance が
#     動けなくなった事故への対策。破損DBのまま走ると後続スクレイプ/メンテが全滅するため、
#     起動時に必ず検証し、無効なら種データから復旧、それでも無効なら安全に中止する。)
DB_VALID=$(node -e "try{const db=require('better-sqlite3')('$DB_PATH',{readonly:true});const c=db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;db.close();console.log(c>300000?'ok':'bad');}catch(e){console.log('bad');}" 2>/dev/null || echo bad)
if [ "$DB_VALID" != "ok" ]; then
  log "[self-heal] $DB_PATH が無効/破損 → db-latest を再取得"
  curl -sL "https://github.com/sneed-ay/panemaji/releases/download/db-latest/panemaji.db.gz" -o /tmp/_dm_dl.gz 2>/dev/null && gunzip -c /tmp/_dm_dl.gz > "$DB_PATH" 2>/dev/null
  rm -f /tmp/_dm_dl.gz
  RECHK=$(node -e "try{const db=require('better-sqlite3')('$DB_PATH',{readonly:true});const c=db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;db.close();console.log(c>300000?'ok':'bad');}catch(e){console.log('bad');}" 2>/dev/null || echo bad)
  if [ "$RECHK" != "ok" ]; then
    log "[self-heal] 再取得後も無効 → daily-maintenance を中止 (本番・db-latest は無傷)"
    exit 1
  fi
  log "[self-heal] db-latest 再取得で復旧"
fi

# Before stats
log ""
log "=== Phase 0: Before Stats ==="
node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');
const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
const z = db.prepare(\"SELECT COUNT(*) as c FROM shops s WHERE s.is_active=1 AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)\").get();
const d = db.prepare(\"SELECT COUNT(*) FROM (SELECT name, category, COUNT(*) as c FROM shops WHERE is_active=1 GROUP BY name, category HAVING c > 1)\").get();
const dg = db.prepare(\"SELECT COUNT(*) FROM (SELECT shop_id, name, COUNT(*) as c FROM girls WHERE is_active=1 GROUP BY shop_id, name HAVING c > 1)\").get();
console.log('  店舗:', s.c, '| 嬢:', g.c, '| 評価:', r.c, '| 0人店:', z.c, '| 店重複:', Object.values(d)[0], '| 嬢重複:', Object.values(dg)[0]);
db.close();
" 2>&1 | tee -a "$LOG_FILE"

# 🚨 サニティガード用 (2026-06-03): 開始時の active girls 数を記録。
#    Phase 4 で「大量減」を検知したら db-latest 上書きを止め、破損データの伝播を防ぐ。
BEFORE_GIRLS=$(node -e "const db=require('better-sqlite3')('$DB_PATH',{readonly:true});console.log(db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c);db.close();" 2>/dev/null || echo 0)
log "  [guard] 開始時 active girls = $BEFORE_GIRLS"

# ============================================================================
# Phase 1: データ収集
# ============================================================================
log ""
log "=== Phase 1: データ収集 ==="

# ----------------------------------------------------------------------
# puppeteer hang watchdog (二重監視: stall + browser-death error rate)
#
# 過去事例:
#   5/3, 5/5, 5/8: "Attempted to use detached Frame" 連発で全店舗 retry 失敗
#   → 30 分タイムアウト × 14 都道府県 = 7h 浪費 → GH Actions 5h cancel
#
# 5/9 v1 watchdog (stall のみ) は不十分:
#   → "detached Frame" がエラーログを 15s 内で大量に吐くと「進捗あり」と誤判定
#
# v2: 二重監視
#   (1) stall_secs (default 90s) 進捗ゼロ → kill
#   (2) 直近の追加ログに detached Frame / Target closed / Protocol error が
#       20 回以上 → browser 死んでるので即 kill (return 125)
# ----------------------------------------------------------------------
run_with_stall_watchdog() {
  local label="$1"
  local stall_secs="${2:-90}"   # 何秒新ログ無しなら kill するか
  local hard_timeout="${3:-3600}"
  shift 3
  local pre_lines
  pre_lines=$(/usr/bin/wc -l < "$LOG_FILE" 2>/dev/null || /bin/echo 0)
  local start_epoch
  start_epoch=$(/bin/date +%s)

  # 子プロセスを background 起動
  ( $TIMEOUT "$hard_timeout" "$@" >> "$LOG_FILE" 2>&1 ) &
  local pid=$!

  local last_lines=$pre_lines
  local stall_count=0
  local cumulative_browser_errors=0
  local consecutive_shop_failures=0
  while /bin/kill -0 $pid 2>/dev/null; do
    /bin/sleep 15
    local cur
    cur=$(/usr/bin/wc -l < "$LOG_FILE" 2>/dev/null || /bin/echo 0)
    if [ "$cur" -gt "$last_lines" ]; then
      local lines_added=$((cur - last_lines))
      local recent_log
      recent_log=$(/usr/bin/tail -n "$lines_added" "$LOG_FILE" 2>/dev/null)

      # (2) browser-death detection v2: 15s 以内に 10件+ で 即 kill (旧 20→10 に 感度UP)
      local err_count
      err_count=$(/bin/echo "$recent_log" | /usr/bin/grep -cE 'detached Frame|Target closed|Session closed|Protocol error|Connection closed' 2>/dev/null || true)
      if [ "$err_count" -ge 10 ]; then
        log "  [browser-dead-watchdog v2] $label で browser-death エラー ${err_count}件/15s → 即 kill"
        /usr/bin/pkill -P $pid 2>/dev/null
        /bin/kill $pid 2>/dev/null
        /bin/sleep 2
        /bin/kill -9 $pid 2>/dev/null
        /usr/bin/pkill -f "puppeteer|chrome.*--user-data" 2>/dev/null
        return 125
      fi
      # (3) cumulative browser-death (slow drip): 1 run 累計 60件 で kill (今日10時間 stuck 対策)
      cumulative_browser_errors=$((cumulative_browser_errors + err_count))
      if [ "$cumulative_browser_errors" -ge 60 ]; then
        log "  [browser-dead-cumulative] $label 累計 browser-death ${cumulative_browser_errors}件 → kill"
        /usr/bin/pkill -P $pid 2>/dev/null
        /bin/kill $pid 2>/dev/null
        /bin/sleep 2
        /bin/kill -9 $pid 2>/dev/null
        /usr/bin/pkill -f "puppeteer|chrome.*--user-data" 2>/dev/null
        return 126
      fi
      # (4) 連続 shop 失敗 検出 (各 shop の "error:" 行 を 数えて 10連続 で kill)
      local recent_errors
      recent_errors=$(/bin/echo "$recent_log" | /usr/bin/grep -cE '^error: |error: Attempted' 2>/dev/null || true)
      local recent_success
      recent_success=$(/bin/echo "$recent_log" | /usr/bin/grep -cE 'girls=\[|active=[1-9]|inserted [0-9]|updated [0-9]' 2>/dev/null || true)
      if [ "$recent_errors" -gt 0 ] && [ "$recent_success" -eq 0 ]; then
        consecutive_shop_failures=$((consecutive_shop_failures + recent_errors))
        if [ "$consecutive_shop_failures" -ge 10 ]; then
          log "  [consecutive-fail-watchdog] $label 直近 ${consecutive_shop_failures} shop 連続失敗 (新成功 0) → kill"
          /usr/bin/pkill -P $pid 2>/dev/null
          /bin/kill $pid 2>/dev/null
          /bin/sleep 2
          /bin/kill -9 $pid 2>/dev/null
          /usr/bin/pkill -f "puppeteer|chrome.*--user-data" 2>/dev/null
          return 127
        fi
      else
        consecutive_shop_failures=0  # success が 1件でも出たら reset
      fi
      last_lines=$cur
      stall_count=0
    else
      stall_count=$((stall_count + 15))
      if [ "$stall_count" -ge "$stall_secs" ]; then
        log "  [stall-watchdog] $label が ${stall_secs}s 進捗無し → kill"
        /usr/bin/pkill -P $pid 2>/dev/null
        /bin/kill $pid 2>/dev/null
        /bin/sleep 2
        /bin/kill -9 $pid 2>/dev/null
        /usr/bin/pkill -f "puppeteer|chrome.*--user-data" 2>/dev/null
        return 124
      fi
    fi
  done
  /bin/wait $pid 2>/dev/null
  return $?
}

# 1-1: cityheaven全国更新（デリヘル + 他カテゴリ差分）
#
# 🚨 2026-09-05: 時間配分を見直した。
#   それまでは毎晩フル実行していたが、実測 (2026-09-05 のログ) では
#   04:07→07:26 の 3時間19分をほぼ全部「店舗一覧ページの巡回」(scrapeShops) が
#   消費し、肝心の嬢の更新にほとんど時間が残っていなかった。
#   店舗の新規開店・閉店は日単位ではほぼ動かないのに対し、嬢の在籍は毎日変わる。
#   → 平日は --skip-shops で嬢の更新に全振りし、店舗探索は週1回 (日曜) だけ回す。
#   店舗の非アクティブ化 (deactivateStaleShops) は scrapedCount=0 だと自動でスキップ
#   されるため、--skip-shops の晩に誤って店舗が消えることはない。
#
# 🚨 timeout に -k を付ける (2026-07-08 の 24時間 hang 再発防止)。
#   SIGTERM を無視した puppeteer が居座り timeout が効かず、丸一日パイプラインが
#   止まった事故があった。-k 120 で猶予後に SIGKILL する。
if [ "$(date +%u)" = "7" ] || [ "$FORCE_FLAG" = "--force" ]; then
  log "  [1-1] cityheaven 全国更新 (週次フル: 店舗探索あり)..."
  UPDATE_ALL_MODE=""
else
  log "  [1-1] cityheaven 全国更新 (嬢の在籍更新のみ / 店舗探索は日曜)..."
  UPDATE_ALL_MODE="--skip-shops"
fi
run_timeout 14400 node scripts/update-all.mjs $FORCE_FLAG $UPDATE_ALL_MODE >> "$LOG_FILE" 2>&1 || log "  [warn] update-all.mjs がタイムアウトまたはエラー"

# 1-1b: cityheaven 以外のソースの在籍更新 (2026-09-05 新設)
#
# これまで update-all.mjs (cityheaven 専用) しか巡回しておらず、
# 在籍嬢の 51% にあたる ranking-deli / fuzoku.jp / purelovers は
# **更新経路が1つも無かった**。最終確認が 2026-04-26 のまま止まり、
# sitemap の lastmod も4月のままで Google がクロールを絞る原因になっていた。
#
# fetch ベース (puppeteer 不使用) なので detached-frame 破損の心配はない。
# 1周が7日で終わる程度に --limit を配って毎晩少しずつ回す:
#   ranking-deli 2,518店 ÷ 7 ≒ 360   (約10秒/店 → 約60分)
#   fuzoku.jp    1,295店 ÷ 7 ≒ 185   (約4秒/店  → 約12分)
#   purelovers     879店 ÷ 7 ≒ 125   (約2秒/店  → 約4分)
#   esthe-zukan    641店 ÷ 7 ≒  92   (約4分)
#   fues.jp        214店 ÷ 7 ≒  31   (約2分)
#   aromaesthe      83店 ÷ 7 ≒  12   (約1分)
# 対象は「嬢の最終取得が古い順」なので、毎晩自然に巡回する。
log "  [1-1b] 他ソース在籍更新 (駅ちか/風俗じゃぱん/ぴゅあらば/エステ図鑑/フーズ/アロマエステ)..."
run_timeout 5400 node scripts/refresh-source-girls.mjs --source rd     --limit 400 >> "$LOG_FILE" 2>&1 || log "  [warn] refresh rd 失敗/タイムアウト"
run_timeout 1800 node scripts/refresh-source-girls.mjs --source fuzoku --limit 200 >> "$LOG_FILE" 2>&1 || log "  [warn] refresh fuzoku 失敗/タイムアウト"
run_timeout 1200 node scripts/refresh-source-girls.mjs --source pl     --limit 150 >> "$LOG_FILE" 2>&1 || log "  [warn] refresh pl 失敗/タイムアウト"
run_timeout  900 node scripts/refresh-source-girls.mjs --source ez     --limit 100 >> "$LOG_FILE" 2>&1 || log "  [warn] refresh ez 失敗/タイムアウト"
run_timeout  600 node scripts/refresh-source-girls.mjs --source fues   --limit  50 >> "$LOG_FILE" 2>&1 || log "  [warn] refresh fues 失敗/タイムアウト"
run_timeout  600 node scripts/refresh-source-girls.mjs --source ar     --limit  20 >> "$LOG_FILE" 2>&1 || log "  [warn] refresh ar 失敗/タイムアウト"

# 1-2: ソープ・ヘルス・ホテヘル・エステ（主要都道府県）— puppeteer 系
# stall watchdog 経由で hang 自動回避
# 2026-05-17: Phase 1-2 全体 hard cap 追加 (1時間 = 14 pref に 平均 4分強)
#   過去事故: 1 pref 30min × 14 = 7h 連続失敗 → 全体 cap で 強制 abort
if [ "$QUICK_MODE" = false ] && [ "${ENABLE_PUPPETEER:-false}" = true ]; then
  log "  [1-2] カテゴリ別スクレイプ（ソープ/ヘルス/ホテヘル/エステ）..."
  phase12_start=$(/bin/date +%s)
  for pref in tokyo osaka kanagawa aichi hokkaido fukuoka miyagi saitama chiba hyogo kyoto hiroshima shizuoka niigata; do
    elapsed=$(($(/bin/date +%s) - phase12_start))
    if [ "$elapsed" -gt 3600 ]; then
      log "  [phase12-cap] 1-2 全体 1h 超過 (${elapsed}s) → 残 pref スキップ"
      break
    fi
    run_with_stall_watchdog "scrape-category $pref" 90 1800 node scripts/scrape-category.mjs "$pref" all || true
  done
fi

# 🚨 2026-09-06 追記: 1-3 / 1-4 を既定OFFにした理由「detached-frame で DB を破損させる」は
#    真因ではなかった可能性が高い。SQLITE_CORRUPT の正体は scrape-category / scrape-menesu が
#    DB_PATH を無視して Google Drive 上のリポジトリ内 panemaji.db を掴んでいたこと (commit b04a238 で修正)。
#    ただし再有効化はしていない: update-all だけで既に4時間枠を使い切って13県で
#    打ち切られている状態なので、これ以上 puppeteer 系を足す余地が無い。
#    巡回が全県に行き渡ってから、1本ずつ様子を見て戻すこと。

# 1-3: メンエス（aromaesthe + fues）— puppeteer 系 (★detached-frame破損源・既定OFF。ENABLE_PUPPETEER=true で有効化)
if [ "${ENABLE_PUPPETEER:-false}" = true ]; then
  log "  [1-3] メンエスデータ更新..."
  run_with_stall_watchdog "scrape-menesu" 120 7200 node scripts/scrape-menesu.mjs all || log "  [warn] scrape-menesu stall/timeout"
else log "  [1-3] スキップ (既定OFF: 時間枠が無い)"; fi

# 1-4: men-esthe.jp — puppeteer 系 (★detached-frame破損源・既定OFF)
if [ "${ENABLE_PUPPETEER:-false}" = true ]; then
  log "  [1-4] men-esthe.jp データ更新..."
  run_with_stall_watchdog "scrape-menesthe" 120 3600 node scripts/scrape-menesthe.mjs girls || log "  [warn] scrape-menesthe stall/timeout"
else log "  [1-4] スキップ (既定OFF: 時間枠が無い)"; fi

# 1-4c: 誤閉店の洗い直し
#   ここで戻した店は嬢0人になるので、直後の [1-5] refetch-girls が同じ晩に在籍を埋める。
#   (以前は [1-6] の後ろに置いていたため、埋まるのが翌晩になっていた)
#   deactivateStaleShops の県単位絞り (2026-09-06 に修正) で作られた誤閉店が
#   cityheaven だけで 1,914 店たまっており、抜き取り20店中18店が実際には営業中だった。
#   「日曜のフル巡回で自動回復する」と考えていたが、その巡回自体が13県で
#   打ち切られていたため回復していなかった。毎晩少しずつ洗って戻す。
#   古い last_seen_at 順に見るので、放置が長い店から順に回復していく。
#   復帰は「掲載元が200を返し・閉店語が無く・嬢リンクがあり・URLが転送されていない」時のみ。
log "  [1-4c] 誤閉店の洗い直し (cityheaven 300店)..."
$TIMEOUT 2400 node scripts/recheck-closed-shops.mjs --source cityheaven --limit 300 --apply >> "$LOG_FILE" 2>&1 || log "  [warn] recheck-closed-shops がタイムアウト"

#   他ソースも同様に誤閉店を抱えている (2026-09-06 抜き取り30店の実測):
#     fuzoku     3,144店が閉店扱い / うち 22店 (73%) が営業中
#     purelovers 1,384店が閉店扱い / うち 27店 (90%) が営業中
#     ranking-deli は判定不能のため対象外 (嬢一覧が店トップに無い / 詳細は recheck-closed-shops.mjs)
#   年齢確認ゲートが無いので --no-browser (fetch のみ) で速い。
#   一度に全部戻すと「嬢0人の店」が数千件生まれ、在籍を埋める側が追いつかない。
#   毎晩少しずつに絞って、refetch-girls / refresh-source-girls が埋められる速度に合わせる。
for _src in fuzoku purelovers; do
  log "  [1-4d] 誤閉店の洗い直し ($_src 150店)..."
  $TIMEOUT 1200 node scripts/recheck-closed-shops.mjs --source "$_src" --limit 150 --no-browser --apply >> "$LOG_FILE" 2>&1 || log "  [warn] recheck-closed-shops ($_src) がタイムアウト"
done

# 1-5: 0人店・100人上限店の再取得
log "  [1-5] 0人/100人上限店の再取得..."
$TIMEOUT 7200 node scripts/refetch-girls.mjs >> "$LOG_FILE" 2>&1 || log "  [warn] refetch-girls がタイムアウト"

# 1-6: 画像URL補完
log "  [1-6] 画像URL補完..."
$TIMEOUT 3600 node scripts/scrape-images.mjs >> "$LOG_FILE" 2>&1 || log "  [warn] scrape-images がタイムアウト"

# ============================================================================
# Phase 2: データ品質メンテナンス
# ============================================================================
log ""
log "=== Phase 2: データ品質メンテナンス ==="

node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');
db.pragma('journal_mode = WAL');

let total = { cleaned: 0, deduped: 0, deactivated: 0 };

// 2-1: 空名前・1文字「記号/英数字/絵文字」名の嬢を非アクティブ化
//      旧: length(name)<=1 で deactivate → 1文字漢字 (椿/愛/凛/桜 等の valid な源氏名) も
//      誤 deactivate していた (130K件規模)。
//      旧々: GLOB '[!-~?]' (ASCII印字可能のみ) → ◆☆◇♦①🔰🌸 等の全角/絵文字記号名が
//            毎日すり抜けて Phase3 で恒久 NG 化 (2026-06-25 に 79件確認)。
//      現: 1文字 name のうち CJK漢字 / かな 以外 (= unicode 範囲外) を全部 deactivate。
//          19968-40959=CJK統合, 12352-12543=かな, 13312-19903=CJK拡張A, 63744-64255=CJK互換。
const r1 = db.prepare(\"UPDATE girls SET is_active = 0 WHERE is_active = 1 AND (name IS NULL OR name = '' OR (length(name) = 1 AND NOT (unicode(name) BETWEEN 19968 AND 40959 OR unicode(name) BETWEEN 12352 AND 12543 OR unicode(name) BETWEEN 13312 AND 19903 OR unicode(name) BETWEEN 63744 AND 64255)))\").run();
total.cleaned += r1.changes;
console.log('  [2-1] 空/1文字記号 非アクティブ化:', r1.changes);

// 2-2: 宣伝文・記号枠が名前になっている嬢
//      「【」「】」 を含む name (ヘッダ/タグ抽出 bug の残骸) も deactivate に追加
const r2 = db.prepare(\"UPDATE girls SET is_active = 0 WHERE is_active = 1 AND (name LIKE '%ご新規%' OR name LIKE '%イベント開催%' OR name LIKE '%割引%' OR name LIKE '%入店予定%' OR name LIKE '%キャンペーン%' OR name LIKE '%募集中%' OR name LIKE '%求人%' OR name LIKE '%ヘブン見た%' OR name LIKE '%【%' OR name LIKE '%】%' OR name LIKE '%出勤%' OR name LIKE '%イベント%')\").run();
total.cleaned += r2.changes;
console.log('  [2-2] 宣伝文/記号名 非アクティブ化:', r2.changes);

// 2-3: 名前の【以降の宣伝コピーを除去
const r3 = db.prepare(\"UPDATE girls SET name = substr(name, 1, instr(name, '【') - 1) WHERE is_active = 1 AND name LIKE '%【%' AND instr(name, '【') > 1 AND instr(name, '【') <= 15\").run();
total.cleaned += r3.changes;
console.log('  [2-3] 【以降カット:', r3.changes);

// 2-4: セクキャバを非アクティブ化
const r4 = db.prepare(\"UPDATE shops SET is_active = 0 WHERE category = 'セクキャバ' AND is_active = 1\").run();
total.deactivated += r4.changes;
if (r4.changes > 0) {
  db.prepare(\"UPDATE girls SET is_active = 0 WHERE is_active = 1 AND shop_id IN (SELECT id FROM shops WHERE is_active = 0)\").run();
  console.log('  [2-4] セクキャバ非アクティブ化:', r4.changes);
}

// 2-5: 重複処理は dedup-shops.mjs + dedup-girls.mjs に外出し（Phase 2 後半で呼ぶ）

// 2-6: スクレイプ済み0人の非cityheaven店を非アクティブ化（30日以上0人のまま）
const threshold = new Date(Date.now() - 30 * 86400000).toISOString();
const r6 = db.prepare(\"UPDATE shops SET is_active = 0 WHERE is_active = 1 AND source_url NOT LIKE '%cityheaven%' AND last_seen_at < ? AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id = shops.id AND g.is_active = 1)\").run(threshold);
total.deactivated += r6.changes;
if (r6.changes > 0) console.log('  [2-6] 30日以上0人の非CH店:', r6.changes);

console.log('');
console.log('  メンテナンス合計: クリーニング=' + total.cleaned + ' 非アクティブ化=' + total.deactivated);

db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
" 2>&1 | tee -a "$LOG_FILE"

# 2-6b: 店舗名サフィックス除去（「〜の超割引クーポン」等、fues.jp 由来のノイズ）
#       dedup 前に走らせないと同一店舗が dedup 対象に拾えない
log "  [2-6b] 店舗名クリーンアップ..."
node scripts/fix-shop-names.mjs --apply 2>&1 | tee -a "$LOG_FILE" || log "  [warn] fix-shop-names 失敗"

# 2-7: 店舗重複統合（同名+同カテゴリ → 嬢が多い方に統合）
log "  [2-7] 店舗重複統合..."
node scripts/dedup-shops.mjs 2>&1 | tee -a "$LOG_FILE" || log "  [warn] dedup-shops 失敗"

# 2-8: 嬢重複統合（同店内同名 → 情報量が多い方を残す）
#      Phase 2-7 で店舗統合した結果、同店内に同名嬢が発生するため必ず順序遵守
log "  [2-8] 嬢重複統合..."
node scripts/dedup-girls.mjs 2>&1 | tee -a "$LOG_FILE" || log "  [warn] dedup-girls 失敗"

# 2-9: 【絶対ルール】 MECE再分配 (159エリア固定)
#      どのスクレイパーがレガシー area (`-fj-`, `-aXXXX` 等) を作っても 毎日リセット
#      CLAUDE.md「エリア数は159で固定」に強制準拠
log "  [2-9] 【MECE強制】エリア再分配 (159固定)..."
node scripts/migrate-areas-mece.mjs --apply 2>&1 | tee -a "$LOG_FILE" || log "  [warn] migrate-areas-mece 失敗"

# 2-10: 表記ゆれ嬢の統合 (normalize_girl ベース)
log "  [2-10] 表記ゆれ嬢統合..."
node scripts/merge-duplicate-girls.mjs --apply 2>&1 | tee -a "$LOG_FILE" || log "  [warn] merge-girls 失敗"

# 2-11: 表記ゆれ店舗統合 (normalize_shop ベース)
log "  [2-11] 表記ゆれ店舗統合..."
node scripts/merge-duplicate-shops.mjs --apply 2>&1 | tee -a "$LOG_FILE" || log "  [warn] merge-shops 失敗"

# 2-12: 健全性チェック (レポートのみ、 areas=159 検証)
log "  [2-12] 健全性チェック..."
node scripts/health-check.mjs 2>&1 | tee -a "$LOG_FILE" || true

# 2-13: ANALYZE+VACUUM で DB最適化
log "  [2-13] DB最適化 (ANALYZE+VACUUM)..."
sqlite3 "$DB_PATH" "ANALYZE; VACUUM;" 2>&1 | tee -a "$LOG_FILE" || true

# ============================================================================
# Phase 2.5: 記事処理（新規作成10本 + メンテナンス）
# ============================================================================
log ""
log "=== Phase 2.5: 記事処理 ==="

# 2.5-1: 記事メンテナンス（閉店リンク修正・古い年号更新）
log "  [2.5-1] 記事メンテナンス..."
node scripts/maintain-articles.mjs 2>&1 | tee -a "$LOG_FILE" || log "  [warn] 記事メンテ失敗"

# 2.5-2: 新規記事作成（1日10本、空白地帯優先）
log "  [2.5-2] 新規記事作成（10本）..."
node scripts/generate-articles.mjs --count=10 2>&1 | tee -a "$LOG_FILE" || log "  [warn] 記事生成失敗"

# ============================================================================
# Phase 3: 品質チェック（settings.md 準拠）
# ============================================================================
log ""
log "=== Phase 3: 品質チェック ==="

node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH', { readonly: true });

// Check 1: 空名前嬢 (Phase 2-1 と同一定義: 1文字でも CJK漢字/かな は valid な源氏名なので除外)
const c1 = db.prepare(\"SELECT COUNT(*) as c FROM girls WHERE is_active=1 AND (name IS NULL OR name = '' OR (length(name) = 1 AND NOT (unicode(name) BETWEEN 19968 AND 40959 OR unicode(name) BETWEEN 12352 AND 12543 OR unicode(name) BETWEEN 13312 AND 19903 OR unicode(name) BETWEEN 63744 AND 64255)))\").get().c;
console.log('  [CHECK] 空/1文字名嬢:', c1, c1 === 0 ? 'OK' : 'NG');

// Check 2: 重複店舗（同名+同カテゴリ）
const c2 = db.prepare(\"SELECT COUNT(*) as c FROM (SELECT name, category, COUNT(*) as cnt FROM shops WHERE is_active=1 GROUP BY name, category HAVING cnt > 1)\").get().c;
console.log('  [CHECK] 重複店舗:', c2, c2 === 0 ? 'OK' : 'NG');

// Check 2b: 重複嬢（同店内同名）
const c2b = db.prepare(\"SELECT COUNT(*) as c FROM (SELECT shop_id, name, COUNT(*) as cnt FROM girls WHERE is_active=1 GROUP BY shop_id, name HAVING cnt > 1)\").get().c;
console.log('  [CHECK] 重複嬢:', c2b, c2b === 0 ? 'OK' : 'NG');

// Check 3: 0人店舗数
const c3 = db.prepare(\"SELECT COUNT(*) as c FROM shops s WHERE s.is_active=1 AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)\").get().c;
console.log('  [CHECK] 0人店舗:', c3);

// Check 4: カテゴリ分布
const cats = db.prepare('SELECT category, COUNT(*) as c FROM shops WHERE is_active=1 GROUP BY category ORDER BY c DESC').all();
console.log('  [CHECK] カテゴリ:', cats.map(c => c.category + ':' + c.c).join(' / '));

db.close();
" 2>&1 | tee -a "$LOG_FILE"

# ============================================================================
# Phase 4: DB圧縮・アップロード・デプロイ
# ============================================================================
log ""
log "=== Phase 4: デプロイ ==="

# After stats
node -e "
const Database = require('better-sqlite3');
const db = new Database('$DB_PATH');
const s = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
const g = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
console.log('  After: 店舗:', s.c, '| 嬢:', g.c, '| 評価:', r.c);
db.close();
" 2>&1 | tee -a "$LOG_FILE"

# 🚨 サニティガード (2026-06-03 恒久対策): scrape 後の active girls が開始時の 80% 未満 =
#    異常な大量減 (並行衝突 / scrape 失敗 / browser 死 等)。db-latest 上書き & backup を
#    中止し、破損データが種データ(db-latest)へ伝播するのを防ぐ。
AFTER_GIRLS=$(node -e "const db=require('better-sqlite3')('$DB_PATH',{readonly:true});console.log(db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c);db.close();" 2>/dev/null || echo 0)
MIN_GIRLS=$(( ${BEFORE_GIRLS:-0} * 80 / 100 ))
ABS_FLOOR=300000   # 🚨 絶対下限: 破損した基準値でも 30万未満なら必ず中止。相対閾値(80%)だけだと "破損base→破損" が素通りして db-latest を汚す欠陥(2026-06-10判明)を塞ぐ。
DB_OK=true
if [ "$AFTER_GIRLS" -lt "$ABS_FLOOR" ]; then
  log "  [GUARD-ABORT] active girls=${AFTER_GIRLS} が絶対下限 ${ABS_FLOOR} 未満 = 破損とみなし db-latest 上書き/backup を中止。"
  DB_OK=false
elif [ "${BEFORE_GIRLS:-0}" -gt 1000 ] && [ "$AFTER_GIRLS" -lt "$MIN_GIRLS" ]; then
  log "  [GUARD-ABORT] active girls ${BEFORE_GIRLS}→${AFTER_GIRLS} (相対閾値 ${MIN_GIRLS} 未満) = 異常な大量減。db-latest 上書き/backup を中止。"
  DB_OK=false
fi

# gzip圧縮
gzip -c "$DB_PATH" > "$DB_PATH.gz"
log "  DB圧縮: $(ls -lh "$DB_PATH.gz" | awk '{print $5}')"

# GitHub Releasesにアップロード (latest + 日次backup tag) — サニティガード通過時のみ
if [ "$DB_OK" = true ] && command -v gh &> /dev/null; then
  gh release upload db-latest "$DB_PATH.gz" --repo sneed-ay/panemaji --clobber 2>&1 | tee -a "$LOG_FILE" || log "  [warn] GitHub Release upload failed"
  log "  GitHub Release(db-latest): アップロード完了"

  # 🔄 本番同期の版数を bump (アップロード成功=DB_OK時のみ)。
  #    次回 Render デプロイ時に init-db.sh が版数差を検知し db-latest を本番へ同期(会員保全UPSERT)する。
  #    この自動bumpが未実装だったため、db-latest は毎日更新されても本番へ届かず 2026-05-21 で凍結していた。
  #    → 恒久修正 (2026-06-29): 毎回の健全なアップロード後に版数を更新し、本番が自動追従するようにする。
  date +%Y%m%d%H%M%S > scripts/.master-sync-version
  log "  master-sync-version bump: $(cat scripts/.master-sync-version) (次回デプロイで本番反映)"

  # 日次バックアップ: db-YYYY-MM-DD タグで別保管 (万一の Restore用)
  BACKUP_TAG="db-$(date +%Y-%m-%d)"
  if ! gh release view "$BACKUP_TAG" --repo sneed-ay/panemaji &>/dev/null; then
    gh release create "$BACKUP_TAG" --repo sneed-ay/panemaji \
      --title "DB Daily Backup $(date +%Y-%m-%d)" \
      --notes "Automated daily backup. Restore via: gh release download $BACKUP_TAG -p panemaji.db.gz" \
      "$DB_PATH.gz" 2>&1 | tee -a "$LOG_FILE" || log "  [warn] backup tag create failed"
    log "  GitHub Release($BACKUP_TAG): 日次backup作成"
  else
    gh release upload "$BACKUP_TAG" "$DB_PATH.gz" --repo sneed-ay/panemaji --clobber 2>&1 | tee -a "$LOG_FILE" || true
    log "  GitHub Release($BACKUP_TAG): 既存tag更新"
  fi

  # 30日以上前のbackupタグ削除 (容量管理)
  CUTOFF_DATE=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)
  for old in $(gh release list --repo sneed-ay/panemaji --limit 60 --json tagName --jq '.[].tagName' | grep -E '^db-2[0-9]{3}-[0-9]{2}-[0-9]{2}$'); do
    if [[ "${old#db-}" < "$CUTOFF_DATE" ]]; then
      gh release delete "$old" --repo sneed-ay/panemaji --yes --cleanup-tag 2>/dev/null && log "  古いbackup削除: $old" || true
    fi
  done
fi

# git auto-commit (コード変更: scripts/・guide記事)
#   .git はローカル(separate-git-dir/pointer)化済 → -e で file/dir 両対応 ([ -d ] だと pointer を見落とす)。
#   Google Drive working tree のスキャンは遅く稀に hang するため: add は timeout で上限を切り、
#   commit は plumbing (write-tree→commit-tree→update-ref) で working tree 非スキャン化し hang を回避 (2026-06-10)。
#   日次データ本体は上記 db-latest 経由で別途反映済。
if [ -e .git ]; then
  timeout 300 git add -A scripts/ src/app/guide/ 2>/dev/null || log "  [git] add timeout → commitスキップ"
  if ! git diff --cached --quiet 2>/dev/null; then
    TREE=$(git write-tree 2>/dev/null) && PARENT=$(git rev-parse HEAD 2>/dev/null) && \
    CMT=$(printf 'chore: daily maintenance %s' "$(date +%Y-%m-%d)" | git commit-tree "$TREE" -p "$PARENT" 2>/dev/null) && \
    git update-ref refs/heads/main "$CMT" 2>/dev/null && \
    { timeout 120 git push origin main 2>/dev/null && log "  [git] commit+push: ${CMT:0:8}" || log "  [warn] git push失敗(commitはlocalに保持)"; }
  fi
fi

log ""
log "=========================================="
log "  日次メンテナンス完了"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "=========================================="

# 古いログを削除（7日以上前）
find "$LOG_DIR" -name "daily-*.log" -mtime +7 -delete 2>/dev/null || true
