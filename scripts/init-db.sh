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

# メモリ抑制 (Render Starter 512MB):
# - --max-old-space-size=400  ... V8 heap を 400MB に強制 cap
# - --expose-gc               ... global.gc() を有効化 → memory-watchdog が定期 GC 強制
# - UV_THREADPOOL_SIZE=2      ... libuv worker pool を縮小 (デフォルト 4 → 2)
export NODE_OPTIONS="--max-old-space-size=400 --expose-gc"
export UV_THREADPOOL_SIZE=2

exec npm run start
