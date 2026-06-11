#!/bin/bash
# Initialize DB on persistent disk
# CRITICAL: 既存の本番DBは唯一の source of truth。通常デプロイでは絶対に上書きしない。
#
# Strategy (恒久対策 2026-06-03):
# - First deploy (no DB): download db-latest from GitHub Releases as the initial seed.
# - Subsequent deploys (DB exists): DO NOTHING to the DB. No download, no overwrite, no merge.
#     旧方式 (毎デプロイ db-latest をDLして本番データをマージし直す) は、そのマージ過程で
#     user投稿(reviews) や 会員紐付け(reviews.user_id) を繰り返し取りこぼす事故を量産したため
#     完全に廃止した。本番ディスクのDBが正であり、デプロイはそれに一切触れない。
# - Master data updates (店舗/嬢/画像等) は「全DB置換」ではなく、対象だけを直接更新する
#     明示的な同期 (sync API / 専用スクリプト) で行うこと。

DB_PATH="${DB_PATH:-./panemaji.db}"
DB_DIR=$(dirname "$DB_PATH")
DB_URL="https://github.com/sneed-ay/panemaji/releases/download/db-latest/panemaji.db.gz"

mkdir -p "$DB_DIR"

# Check if DB exists and is valid (girls > 1000 = 正常な本番DBとみなす)
DB_EXISTS=false
if [ -f "$DB_PATH" ]; then
  GIRL_COUNT=$(node -e "
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const r = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    console.log(r.c);
    db.close();
  } catch(e) { console.log('0'); }
  " 2>/dev/null || echo "0")

  if [ "$GIRL_COUNT" -gt 1000 ] 2>/dev/null; then
    DB_EXISTS=true
  fi
fi

if [ "$DB_EXISTS" = true ]; then
  # ✅ 既存の本番DBがある = source of truth。一切上書きしない (DLもマージも再取込もしない)。
  #    これが「デプロイの度にデータが消える」問題クラスの恒久対策 (2026-06-03)。
  echo "✅ Existing production DB found ($GIRL_COUNT girls) — preserving AS-IS. No download / no overwrite / no merge."

  # 起動直前の本番DBスナップショットをローカル退避 (安全網)
  cp "$DB_PATH" "${DB_PATH}.bak" 2>/dev/null || true

  # 現状をログ出力 (データが保持されていることの可視化)
  node -e "
  try {
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const r = db.prepare('SELECT COUNT(*) as c FROM reviews').get();
    const ur = db.prepare(\"SELECT COUNT(*) as c FROM reviews WHERE browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'\").get();
    const mr = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE user_id IS NOT NULL').get();
    let u = 0; try { u = db.prepare('SELECT COUNT(*) as c FROM users').get().c; } catch(e) {}
    console.log('📊 Preserved — Reviews:', r.c, '(genuine:', ur.c, '| member-linked:', mr.c + ') | Users:', u);
    db.close();
  } catch(e) { console.log('verify skip:', e.message); }
  " 2>/dev/null || true

else
  # 初回デプロイ専用 (DBが無い時だけ db-latest を初期データとして取得)
  echo "📦 First deploy: downloading initial database from db-latest..."
  node -e "
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const zlib = require('zlib');

  function dl(url) {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http;
      proto.get(url, {headers:{'User-Agent':'panemaji'}}, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          dl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error('HTTP '+res.statusCode)); return; }
        const gunzip = zlib.createGunzip();
        const file = fs.createWriteStream('$DB_PATH');
        res.pipe(gunzip).pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
        gunzip.on('error', reject);
      }).on('error', reject);
    });
  }

  async function main() {
    await dl('$DB_URL');
    const Database = require('better-sqlite3');
    const db = new Database('$DB_PATH');
    const check = db.prepare('PRAGMA integrity_check').get();
    const girls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
    console.log('✅ Initial DB downloaded:', girls.c, 'girls, integrity:', check.integrity_check);
    db.close();
  }
  main().catch(e => console.error('❌ Download error:', e.message));
  " 2>/dev/null
fi

# マイページ機能のテーブル/列を idempotent に追加 (起動毎に実行、本番でも安全 / 既存列は no-op)
node scripts/migrate-users-tables.mjs 2>&1 || echo "[warn] users-tables migration failed"

# 会員データ復元 (restore-members.mjs)。
# 恒久対策後は通常デプロイで上書きしないため /tmp export が無く実質 no-op。
# 初回デプロイ等の保険として idempotent に残す (DBには既に会員がいるため二重でも安全)。
node scripts/restore-members.mjs 2>&1 || echo "[warn] member data restore failed"

# ── マスターデータ同期 (会員データ非破壊) ────────────────────────────
# scripts/.master-sync-version が prod 適用済と違う時だけ db-latest を取得し、
# shops/girls/areas のみ source キーで UPSERT する (reviews/users/favorites は不可侵)。
# 失敗時は起動時 backup へ即復元。本番DBが在る時(=2回目以降のデプロイ)だけ走る。
SYNC_VER_FILE="scripts/.master-sync-version"
APPLIED_FILE="$DB_DIR/.applied-sync-version"
if [ "$DB_EXISTS" = true ] && [ -f "$SYNC_VER_FILE" ]; then
  WANT_VER=$(tr -d '[:space:]' < "$SYNC_VER_FILE" 2>/dev/null)
  HAVE_VER=$(tr -d '[:space:]' < "$APPLIED_FILE" 2>/dev/null || echo "none")
  if [ -n "$WANT_VER" ] && [ "$WANT_VER" != "$HAVE_VER" ]; then
    echo "🔄 master-sync v$WANT_VER (適用済: ${HAVE_VER:-none}) — db-latest 取得中..."
    if curl -sL "$DB_URL" -o /tmp/_sync.gz && gunzip -f /tmp/_sync.gz; then
      if node scripts/sync-master-to-prod.mjs "$DB_PATH" /tmp/_sync; then
        echo "$WANT_VER" > "$APPLIED_FILE"
        echo "✅ master-sync v$WANT_VER 適用完了"
      else
        echo "❌ master-sync 失敗 → 起動時 backup へ復元 (本番データ保護)"
        cp "${DB_PATH}.bak" "$DB_PATH" 2>/dev/null && echo "  復元完了" || echo "  [warn] backup 復元失敗"
      fi
      rm -f /tmp/_sync
    else
      echo "⚠️ db-latest 取得失敗 → master-sync skip"
    fi
  fi
fi

# ── 会員フィードバック処理 (sync とは独立した gate で発火) ──────────────
# scripts/.feedback-process-version が prod 適用済と違う時だけ実行。
# 明確な閉店/退店/不存在 → 非アクティブ化(is_active=0・復元可・★DELETEしない)、
# 自由記述(wrong_info/other)は内容ログのみ open維持。reviews/会員テーブルは不可侵。
FB_VER_FILE="scripts/.feedback-process-version"
FB_APPLIED="$DB_DIR/.applied-feedback-version"
if [ "$DB_EXISTS" = true ] && [ -f "$FB_VER_FILE" ]; then
  FB_WANT=$(tr -d '[:space:]' < "$FB_VER_FILE" 2>/dev/null)
  FB_HAVE=$(tr -d '[:space:]' < "$FB_APPLIED" 2>/dev/null || echo "none")
  if [ -n "$FB_WANT" ] && [ "$FB_WANT" != "$FB_HAVE" ]; then
    echo "🔄 feedback処理 v$FB_WANT (適用済: ${FB_HAVE:-none})..."
    if node scripts/process-feedback.mjs "$DB_PATH"; then
      echo "$FB_WANT" > "$FB_APPLIED"
      echo "✅ feedback処理 v$FB_WANT 完了"
    else
      echo "[warn] feedback処理 失敗 (本番データは非破壊・削除なし設計)"
    fi
  fi
fi

# ── 爆サイ パネマジ取り込み (独立 gate) ──────────────────────────────────
# scripts/.bakusai-import-version が prod 適用済と違う時だけ実行。
# scripts/bakusai-import-data.json から shop_comments/reviews を冪等INSERT。
# 個人スレ名指しの未在籍嬢は新規作成(source_id=ext-bk-g-)。出所 browser_id=ext-bakusai-* 保持。
# 会員データ(users/favorites/会員review=user_id付)は不可侵・DELETEなし。import側が会員数減を検知したら異常終了。
BK_VER_FILE="scripts/.bakusai-import-version"
BK_APPLIED="$DB_DIR/.applied-bakusai-version"
if [ "$DB_EXISTS" = true ] && [ -f "$BK_VER_FILE" ]; then
  BK_WANT=$(tr -d '[:space:]' < "$BK_VER_FILE" 2>/dev/null)
  BK_HAVE=$(tr -d '[:space:]' < "$BK_APPLIED" 2>/dev/null || echo "none")
  if [ -n "$BK_WANT" ] && [ "$BK_WANT" != "$BK_HAVE" ]; then
    echo "🔄 爆サイ取り込み v$BK_WANT (適用済: ${BK_HAVE:-none})..."
    if DB_PATH="$DB_PATH" node scripts/import-bakusai.mjs; then
      echo "$BK_WANT" > "$BK_APPLIED"
      echo "✅ 爆サイ取り込み v$BK_WANT 完了"
    else
      echo "[warn] 爆サイ取り込み 失敗 (会員データ保全チェックで中断の可能性・非破壊設計)"
    fi
  fi
fi

# メモリ抑制 (Render Starter 512MB):
# - --max-old-space-size=400  ... V8 heap を 400MB に強制 cap
# - --expose-gc               ... global.gc() を有効化 → memory-watchdog が定期 GC 強制
# - UV_THREADPOOL_SIZE=2      ... libuv worker pool を縮小 (デフォルト 4 → 2)
export NODE_OPTIONS="--max-old-space-size=400 --expose-gc"
export UV_THREADPOOL_SIZE=2

exec npm run start
