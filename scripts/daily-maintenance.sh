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
DB_PATH="$PROJECT_ROOT/panemaji.db"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-$(date +%Y%m%d-%H%M).log"

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

# ============================================================================
# Phase 1: データ収集
# ============================================================================
log ""
log "=== Phase 1: データ収集 ==="

# 1-1: cityheaven全国更新（デリヘル + 他カテゴリ差分）
log "  [1-1] cityheaven 全国更新..."
$TIMEOUT 14400 node scripts/update-all.mjs $FORCE_FLAG >> "$LOG_FILE" 2>&1 || log "  [warn] update-all.mjs がタイムアウトまたはエラー"

# 1-2: ソープ・ヘルス・ホテヘル・エステ（主要都道府県）
if [ "$QUICK_MODE" = false ]; then
  log "  [1-2] カテゴリ別スクレイプ（ソープ/ヘルス/ホテヘル/エステ）..."
  for pref in tokyo osaka kanagawa aichi hokkaido fukuoka miyagi saitama chiba hyogo kyoto hiroshima shizuoka niigata; do
    $TIMEOUT 1800 node scripts/scrape-category.mjs "$pref" all >> "$LOG_FILE" 2>&1 || true
  done
fi

# 1-3: メンエス（aromaesthe + fues）
log "  [1-3] メンエスデータ更新..."
$TIMEOUT 7200 node scripts/scrape-menesu.mjs all >> "$LOG_FILE" 2>&1 || log "  [warn] scrape-menesu がタイムアウト"

# 1-4: men-esthe.jp
log "  [1-4] men-esthe.jp データ更新..."
$TIMEOUT 3600 node scripts/scrape-menesthe.mjs girls >> "$LOG_FILE" 2>&1 || log "  [warn] scrape-menesthe がタイムアウト"

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

// 2-1: 空名前・1文字記号名の嬢を非アクティブ化
const r1 = db.prepare(\"UPDATE girls SET is_active = 0 WHERE is_active = 1 AND (name IS NULL OR name = '' OR length(name) <= 1)\").run();
total.cleaned += r1.changes;
console.log('  [2-1] 空/1文字名 非アクティブ化:', r1.changes);

// 2-2: 宣伝文が名前になっている嬢
const r2 = db.prepare(\"UPDATE girls SET is_active = 0 WHERE is_active = 1 AND (name LIKE '%ご新規%' OR name LIKE '%イベント開催%' OR name LIKE '%割引%' OR name LIKE '%入店予定%' OR name LIKE '%キャンペーン%' OR name LIKE '%募集中%' OR name LIKE '%求人%' OR name LIKE '%ヘブン見た%')\").run();
total.cleaned += r2.changes;
console.log('  [2-2] 宣伝文名 非アクティブ化:', r2.changes);

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

// Check 1: 空名前嬢
const c1 = db.prepare(\"SELECT COUNT(*) as c FROM girls WHERE is_active=1 AND (name IS NULL OR name = '' OR length(name) = 1)\").get().c;
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

# gzip圧縮
gzip -c "$DB_PATH" > "$DB_PATH.gz"
log "  DB圧縮: $(ls -lh "$DB_PATH.gz" | awk '{print $5}')"

# GitHub Releasesにアップロード
if command -v gh &> /dev/null; then
  gh release upload db-latest "$DB_PATH.gz" --repo sneed-ay/panemaji --clobber 2>&1 | tee -a "$LOG_FILE" || log "  [warn] GitHub Release upload failed"
  log "  GitHub Release: アップロード完了"
fi

# git push（コード変更があれば。新規記事やメンテ修正を含む）
if [ -d .git ]; then
  git add -A scripts/ src/app/guide/ 2>/dev/null || true
  git diff --staged --quiet 2>/dev/null || {
    git commit -m "chore: daily maintenance $(date +%Y-%m-%d)" 2>/dev/null || true
    git push origin main 2>/dev/null || log "  [warn] git push failed"
  }
fi

log ""
log "=========================================="
log "  日次メンテナンス完了"
log "  $(date '+%Y-%m-%d %H:%M:%S')"
log "=========================================="

# 古いログを削除（7日以上前）
find "$LOG_DIR" -name "daily-*.log" -mtime +7 -delete 2>/dev/null || true
