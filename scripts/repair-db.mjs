#!/usr/bin/env node
/**
 * 本番DBの破損検知 + 自動修復 (init-db.sh の最初に毎回実行)
 *
 * 2026-09-24 のデプロイ直後から本番DBが SQLITE_CORRUPT を返し、トップ/都道府県/ランキングが
 * 25時間 500 になっていた。Render のシェルに入れない状況でも直せるよう、起動時に自己修復する。
 *
 *  1. 軽い probe (主要テーブルの COUNT) を実行。全部通れば即 exit (毎回の起動を遅くしない)
 *  2. probe が落ちたら PRAGMA quick_check で破損箇所をログに出す
 *  3. REINDEX (索引の作り直し)。索引だけの破損なら、表のデータを一切失わずに直る
 *  4. 再 probe + quick_check。結果を $DB_DIR/.db-health に書く ("ok" / "corrupt")
 *     init-db.sh は "corrupt" の間は master-sync 等の書き込みを止める
 *
 * ★ DELETE / DROP TABLE / ファイル上書きは一切しない。REINDEX は索引を表から作り直すだけ。
 *
 * 使い方: node scripts/repair-db.mjs <DB_PATH>
 * exit は常に 0 (起動を止めない)。判定は .db-health ファイルで渡す。
 */
import Database from 'better-sqlite3';
import { existsSync, writeFileSync, readFileSync, statSync } from 'fs';
import path from 'path';

const DB = process.argv[2];
if (!DB || !existsSync(DB)) {
  console.log(`[repair-db] DB が無いのでスキップ (${DB})`);
  process.exit(0);
}
const healthFile = path.join(path.dirname(DB), '.db-health');
const setHealth = (s) => { try { writeFileSync(healthFile, s + '\n'); } catch {} };

const size = (p) => { try { return `${Math.round(statSync(p).size / 1048576)}MB`; } catch { return '-'; } };
console.log(`[repair-db] ${DB}=${size(DB)} wal=${size(DB + '-wal')} bak=${size(DB + '.bak')}`);

const PROBES = [
  'SELECT COUNT(*) c FROM reviews',
  'SELECT COUNT(*) c FROM girls WHERE is_active=1',
  'SELECT COUNT(*) c FROM shops WHERE is_active=1',
  'SELECT COUNT(*) c FROM areas',
  'SELECT COUNT(*) c FROM shop_comments',
  'SELECT COUNT(*) c FROM users',
  'SELECT COUNT(*) c FROM favorites',
];

function probe(db) {
  const fails = [];
  for (const sql of PROBES) {
    try { db.prepare(sql).get(); }
    catch (e) {
      // 表が無い環境 (users 等) は破損ではない
      if (/no such table/.test(e.message)) continue;
      fails.push(`${sql} → ${e.code || ''} ${e.message}`);
    }
  }
  return fails;
}

function quickCheck(db, label) {
  try {
    const rows = db.pragma('quick_check(40)').map((r) => r.quick_check);
    console.log(`[repair-db] quick_check(${label}): ${rows.length === 1 && rows[0] === 'ok' ? 'ok' : ''}`);
    if (!(rows.length === 1 && rows[0] === 'ok')) for (const r of rows) console.log(`[repair-db]   ${r}`);
    return rows.length === 1 && rows[0] === 'ok';
  } catch (e) {
    console.log(`[repair-db] quick_check(${label}) 実行失敗: ${e.code || ''} ${e.message}`);
    return false;
  }
}

let db;
try {
  db = new Database(DB);
  db.pragma('busy_timeout = 10000');
} catch (e) {
  console.log(`[repair-db] open 失敗: ${e.message}`);
  setHealth('corrupt');
  process.exit(0);
}

// probe は COUNT しか見ないので、索引の破損は素通りすることがある。
// このスクリプトの版ごとに1回だけは quick_check まで必ず走らせる (以後の起動は probe だけで速い)。
const VERSION = '1';
const markerFile = path.join(path.dirname(DB), '.repair-db-version');
let checkedThisVersion = false;
try { checkedThisVersion = readFileSync(markerFile, 'utf8').trim() === VERSION; } catch {}

const fails = probe(db);
if (fails.length === 0 && checkedThisVersion) {
  setHealth('ok');
  db.close();
  process.exit(0);
}

let beforeOk;
if (fails.length > 0) {
  console.log(`[repair-db] ⚠️ probe 失敗 ${fails.length}件 → 破損の疑い`);
  for (const f of fails) console.log(`[repair-db]   ${f}`);
  beforeOk = quickCheck(db, 'before');
} else {
  console.log(`[repair-db] 初回チェック (v${VERSION}): quick_check 実行`);
  beforeOk = quickCheck(db, 'before');
  if (beforeOk) {
    try { writeFileSync(markerFile, VERSION + '\n'); } catch {}
    setHealth('ok');
    db.close();
    process.exit(0);
  }
}

// 退避コピーの状態も見ておく (次の手を決めるための情報。ここでは触らない)
if (existsSync(DB + '.bak')) {
  try {
    const bak = new Database(DB + '.bak', { readonly: true, fileMustExist: true });
    const bf = probe(bak);
    console.log(`[repair-db] .bak probe: ${bf.length === 0 ? 'ok' : bf.length + '件失敗'}`);
    bak.close();
  } catch (e) {
    console.log(`[repair-db] .bak open 失敗: ${e.message}`);
  }
}

// WAL を本体に統合してから REINDEX (WAL 肥大でディスクを使い切らないように)
try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { console.log(`[repair-db] checkpoint 失敗: ${e.message}`); }

console.log('[repair-db] 🔧 REINDEX 開始');
const t0 = Date.now();
try {
  db.exec('REINDEX');
  console.log(`[repair-db] REINDEX 完了 (${Math.round((Date.now() - t0) / 1000)}s)`);
} catch (e) {
  console.log(`[repair-db] REINDEX 失敗: ${e.code || ''} ${e.message}`);
}
try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}

const after = probe(db);
const qcOk = quickCheck(db, 'after');
if (after.length === 0 && qcOk) {
  console.log('[repair-db] ✅ 修復成功 (probe / quick_check とも ok)');
  try { writeFileSync(markerFile, VERSION + '\n'); } catch {}
  setHealth('ok');
} else {
  console.log(`[repair-db] ❌ 修復できず (probe失敗=${after.length}, quick_check=${qcOk ? 'ok' : 'NG'}) → 書き込み系を止めて起動`);
  for (const f of after) console.log(`[repair-db]   ${f}`);
  setHealth('corrupt');
}
db.close();
