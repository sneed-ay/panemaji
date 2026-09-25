#!/usr/bin/env node
/**
 * 破損した本番DBから読める行を全部救出して作り直し、安全確認のうえで差し替える (2026-09-25)
 *
 * 9/24 のデプロイで本番DBの表そのものが壊れ (REINDEX では直らない)、主要ページが 500 になった。
 * バックアップに戻すと会員・口コミが約1日分消えるので、壊れたDBから読める行を拾い直す。
 *
 * 手順:
 *  1. 元DBのスキーマで /tmp に新しいDBを作る (索引は後で)
 *  2. 表ごとに rowid の範囲で読み、読めない範囲は二分して、読める行を全部コピー (rowid/id は保持)
 *  3. 索引・sqlite_sequence・sqlite_stat1 を作り直す
 *  4. 安全確認: integrity_check=ok、かつ 退避表 (REFILLABLE) 以外の全表で1行も失っていない
 *  5. 合格したときだけ差し替え。元DBは消さずに <DB>.corrupt-<日付> として残す
 *     不合格なら何も差し替えない (元DBのまま起動)
 *
 * 使い方: node scripts/salvage-db.mjs <DB_PATH> [--dry-run]
 * exit: 0=差し替え成功 / 10=不合格で差し替えず / 1=エラー
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB = process.argv[2];
const DRY = process.argv.includes('--dry-run');
if (!DB || !fs.existsSync(DB)) { console.error(`[salvage] DB が無い: ${DB}`); process.exit(1); }

const WORK = process.env.SALVAGE_WORK || '/tmp/panemaji-salvage.db';
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const log = (...a) => console.log('[salvage]', ...a);

// 救出不要の退避表。これ以外で1行でも失ったら差し替えない。
// girls/shops/areas も「同期で埋め直せる」扱いにしてはいけない: 同期で入れ直すと新しい id が振られ、
// reviews.girl_id 等のひも付けが全部切れる (手元テストで girls 82万行を失ったまま合格しかけた)。
const REFILLABLE = new Set(['lost_and_found', 'areas_backup', 'shops_area_backup']);
const q = (s) => `"${s.replace(/"/g, '""')}"`;

const freeMB = (dir) => {
  try { const s = fs.statfsSync(dir); return Math.floor((s.bavail * s.bsize) / 1048576); } catch { return -1; }
};
const sizeMB = (p) => { try { return Math.round(fs.statSync(p).size / 1048576); } catch { return 0; } };

const t0 = Date.now();
const srcMB = sizeMB(DB);
log(`元DB ${srcMB}MB / 作業先 ${WORK} (空き ${freeMB(path.dirname(WORK))}MB) / ${path.dirname(DB)} 空き ${freeMB(path.dirname(DB))}MB`);
if (freeMB(path.dirname(WORK)) >= 0 && freeMB(path.dirname(WORK)) < srcMB + 100) {
  log('❌ 作業先の空きが足りない → 中止'); process.exit(10);
}

for (const p of [WORK, WORK + '-wal', WORK + '-shm', WORK + '-journal']) { try { fs.unlinkSync(p); } catch {} }
const src = new Database(DB, { readonly: true, fileMustExist: true });
// 整数は BigInt で読んで INTEGER のまま書く (number で渡すと型の無い列に REAL で入る: seq=820125.0 等)
src.defaultSafeIntegers(true);
const dst = new Database(WORK);
dst.pragma('journal_mode = OFF');
dst.pragma('synchronous = OFF');
dst.pragma('foreign_keys = OFF');

const schema = src.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL").all();
const tables = schema.filter((s) => s.type === 'table' && !s.name.startsWith('sqlite_'));
const others = schema.filter((s) => s.type !== 'table');

for (const t of tables) dst.exec(t.sql);

const report = [];
for (const t of tables) {
  const name = t.name;
  const info = src.pragma(`table_info(${q(name)})`);
  const cols = info.map((c) => c.name);
  const pk = info.filter((c) => c.pk > 0);
  // INTEGER PRIMARY KEY は rowid の別名なので、別途 rowid を入れない
  const ipk = pk.length === 1 && /^INTEGER$/i.test(pk[0].type);
  const insCols = ipk ? cols : ['rowid', ...cols];
  const ins = dst.prepare(`INSERT INTO ${q(name)} (${insCols.map(q).join(',')}) VALUES (${insCols.map(() => '?').join(',')})`);
  const sel = src.prepare(`SELECT rowid AS __rid, ${cols.map(q).join(',')} FROM ${q(name)} WHERE rowid >= ? AND rowid < ?`).raw(true);

  // 期待行数: 表を直接数えたもの (NOT INDEXED) と索引経由の COUNT の大きい方。
  // 壊れているのが索引だけなら前者が、表だけなら後者が正しい行数を返す。
  let expected = null;
  for (const sql of [`SELECT COUNT(*) FROM ${q(name)} NOT INDEXED`, `SELECT COUNT(*) FROM ${q(name)}`]) {
    try { const c = Number(src.prepare(sql).pluck().get()); expected = expected == null ? c : Math.max(expected, c); } catch {}
  }
  let maxRid = null;
  try { const m = src.prepare(`SELECT rowid FROM ${q(name)} ORDER BY rowid DESC LIMIT 1`).pluck().get(); maxRid = m == null ? null : Number(m); } catch {}
  if (maxRid == null) maxRid = expected === 0 ? 0 : 5_000_000;

  let copied = 0, badRanges = 0, lostRids = 0;
  const put = (row) => {
    const vals = ipk ? row.slice(1) : row;
    try { ins.run(vals); copied++; } catch { lostRids++; }
  };
  const copyRange = (lo, hi) => {
    let rows;
    try { rows = sel.all(lo, hi); }
    catch {
      // 親ページが壊れていると配下は rowid 検索では届かないので、細かく割り続けても無駄 (16件で打ち切り)
      if (hi - lo <= 16) { lostRids++; return; }
      badRanges++;
      const mid = Math.floor((lo + hi) / 2);
      copyRange(lo, mid); copyRange(mid, hi);
      return;
    }
    for (const r of rows) put(r);
  };
  const CHUNK = 2000;
  const tx = dst.transaction(() => {
    // rowid は負もあり得るが、このDBの表は正の連番のみ
    for (let lo = -1; lo <= maxRid; lo += CHUNK) copyRange(lo, lo + CHUNK);
  });
  tx();
  // 読めない rowid (破損ページ内) は、実在したかは分からないので「失った行」は COUNT との差で見る
  const lost = expected == null ? null : Math.max(0, expected - copied);
  report.push({ name, expected, copied, lost, badRanges });
  log(`${name}: 期待=${expected ?? '不明'} 救出=${copied} 欠損=${lost ?? '不明'}${badRanges ? ` (読めない範囲 ${badRanges})` : ''}`);
}

// ── 読めなかった行の埋め戻し ──
// 表のページが壊れても、索引のページは別の場所にあって読めることが多い (9/24 は girls 109行・reviews 63行)。
//  1. 表の各索引を「索引だけで」読み (covering scan)、新DBに無い rowid の列値を集める (id はそのまま)
//  2. 足りない列は master(db-latest) の同じ行で埋める。girls は source_id、reviews は id で引き、
//     索引から読めた列 (girl_id/browser_id 等) と master の値が食い違う行は使わない
//  → id を変えずに戻すので reviews.girl_id 等のひも付けは切れない
const MASTER = process.env.SALVAGE_MASTER;
const FILL_KEYS = { girls: 'source_id', reviews: 'id' };
let mdb = null;
if (MASTER && fs.existsSync(MASTER)) {
  try { mdb = new Database(MASTER, { readonly: true, fileMustExist: true }); mdb.defaultSafeIntegers(true); }
  catch (e) { log(`master open 失敗: ${e.message}`); }
}
for (const r of report) {
  if (!(r.lost > 0)) continue;
  const name = r.name;
  const dstCols = dst.pragma(`table_info(${q(name)})`).map((c) => c.name);
  const pkCol = dst.pragma(`table_info(${q(name)})`).find((c) => c.pk === 1)?.name;
  const exists = dst.prepare(`SELECT 1 FROM ${q(name)} WHERE rowid = ?`).pluck();
  const miss = new Map();
  for (const ix of schema.filter((s) => s.type === 'index' && s.tbl_name === name)) {
    const icols = src.pragma(`index_info(${q(ix.name)})`).map((c) => c.name);
    if (icols.some((c) => c == null)) continue;
    const where = /\bWHERE\b([\s\S]*)$/i.exec(ix.sql)?.[1];
    try {
      const it = src.prepare(`SELECT rowid, ${icols.map(q).join(',')} FROM ${q(name)} INDEXED BY ${q(ix.name)}${where ? ` WHERE ${where}` : ''}`).raw(true).iterate();
      for (const [rid, ...vals] of it) {
        if (exists.get(rid)) continue;
        const k = String(rid);
        const m = miss.get(k) || { __rid: rid };
        icols.forEach((c, i) => { if (!(c in m)) m[c] = vals[i]; });
        miss.set(k, m);
      }
    } catch (e) { log(`  ${name}: 索引 ${ix.name} は読めない (${e.code || e.message})`); }
  }
  const key = FILL_KEYS[name];
  let filled = 0, mismatch = 0, noMaster = 0;
  const mCols = mdb ? (() => { try { return mdb.pragma(`table_info(${q(name)})`).map((c) => c.name); } catch { return []; } })() : [];
  const mget = mdb && key && mCols.includes(key) ? mdb.prepare(`SELECT * FROM ${q(name)} WHERE ${q(key)} = ?`) : null;
  const fillTx = dst.transaction(() => {
    for (const m of miss.values()) {
      const keyVal = key === pkCol || key === 'id' ? m.__rid : m[key];
      const mr = mget && keyVal != null ? mget.get(keyVal) : null;
      if (!mr) { noMaster++; continue; }
      // 索引から読めた本番の値と master の値が食い違う = 別の行。使わない (shop_id/is_active は本番側を優先)
      const PROD_WINS = new Set(['shop_id', 'is_active', 'last_seen_at', 'user_id', 'name']);
      const conflict = Object.keys(m).some((c) => c !== '__rid' && !PROD_WINS.has(c) && c in mr && mr[c] != null && m[c] != null && String(mr[c]) !== String(m[c]));
      if (conflict) { mismatch++; continue; }
      const row = {};
      for (const c of dstCols) {
        if (c in m) row[c] = m[c];
        else if (c in mr) row[c] = mr[c];
      }
      if (pkCol) row[pkCol] = m.__rid;
      const cs = Object.keys(row);
      const insCols = pkCol ? cs : ['rowid', ...cs];
      const vals = pkCol ? cs.map((c) => row[c]) : [m.__rid, ...cs.map((c) => row[c])];
      try { dst.prepare(`INSERT INTO ${q(name)} (${insCols.map(q).join(',')}) VALUES (${insCols.map(() => '?').join(',')})`).run(vals); filled++; }
      catch (e) { log(`  ${name} rowid=${m.__rid} 埋め戻し失敗: ${e.message}`); }
    }
  });
  fillTx();
  r.copied += filled;
  r.lost = r.expected == null ? null : Math.max(0, r.expected - r.copied);
  log(`${name}: 索引から ${miss.size}行を特定 → master で埋め戻し ${filled} (不一致 ${mismatch} / master に無い ${noMaster}) → 残り欠損 ${r.lost ?? '不明'}`);
}
if (mdb) mdb.close();

// sqlite_sequence (AUTOINCREMENT の採番) を元の値で上書き
try {
  const seq = src.prepare('SELECT name, seq FROM sqlite_sequence').all();
  dst.exec('DELETE FROM sqlite_sequence');
  const insSeq = dst.prepare('INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)');
  for (const s of seq) insSeq.run(s.name, s.seq);
} catch (e) { log(`sqlite_sequence 復元失敗: ${e.message}`); }

let idxFail = 0;
for (const o of others) {
  try { dst.exec(o.sql); }
  catch (e) { idxFail++; log(`⚠️ ${o.type} ${o.name} 作成失敗: ${e.message}`); }
}

// クエリプランナの統計 (無いと遅いプランを選ぶことがある)
try {
  const stats = src.prepare('SELECT tbl, idx, stat FROM sqlite_stat1').all();
  dst.exec('ANALYZE sqlite_master');
  dst.exec('DELETE FROM sqlite_stat1');
  const insSt = dst.prepare('INSERT INTO sqlite_stat1(tbl, idx, stat) VALUES (?, ?, ?)');
  for (const s of stats) insSt.run(s.tbl, s.idx, s.stat);
} catch (e) { log(`sqlite_stat1 復元スキップ: ${e.message}`); }

const integ = dst.pragma('integrity_check(20)').map((r) => r.integrity_check);
const integOk = integ.length === 1 && integ[0] === 'ok';
log(`新DB integrity_check: ${integOk ? 'ok' : integ.join(' / ')}`);
dst.pragma('journal_mode = DELETE');
dst.close();
src.close();

const memberLoss = report.filter((r) => !REFILLABLE.has(r.name) && (r.lost == null || r.lost > 0));
log(`所要 ${Math.round((Date.now() - t0) / 1000)}s / 新DB ${sizeMB(WORK)}MB / 索引等の作成失敗 ${idxFail}`);
if (!integOk || memberLoss.length > 0) {
  log(`❌ 不合格 → 差し替えない (integrity=${integOk ? 'ok' : 'NG'}, 会員系の欠損=${memberLoss.map((r) => `${r.name}:${r.lost ?? '不明'}`).join(',') || 'なし'})`);
  process.exit(10);
}
log('✅ 合格 (integrity ok / 会員系の欠損なし)');
if (DRY) { log('--dry-run なので差し替えない'); process.exit(0); }

// ── 差し替え ── 元DBは消さずに別名で残す。途中で失敗したら元に戻す。
const dir = path.dirname(DB);
const keep = `${DB}.corrupt-${STAMP}`;
const moved = [];
try {
  for (const suf of ['', '-wal', '-shm']) {
    if (fs.existsSync(DB + suf)) { fs.renameSync(DB + suf, keep + suf); moved.push(suf); }
  }
  // .bak は壊れた状態のコピー (9/24 以降の再起動で壊れた本体を退避していた)。容量確保のため消す
  try { fs.unlinkSync(`${DB}.bak`); log('.bak (破損状態のコピー) を削除して容量確保'); } catch {}
  const need = sizeMB(WORK) + 50;
  const free = freeMB(dir);
  if (free >= 0 && free < need) throw new Error(`ディスク空き不足 (空き ${free}MB < 必要 ${need}MB)`);
  fs.copyFileSync(WORK, `${DB}.salvage-tmp`);
  const fd = fs.openSync(`${DB}.salvage-tmp`, 'r'); fs.fsyncSync(fd); fs.closeSync(fd);
  fs.renameSync(`${DB}.salvage-tmp`, DB);
  // 差し替え後に開けることを確認
  const chk = new Database(DB, { readonly: true });
  const qc = chk.pragma('quick_check').map((r) => r.quick_check);
  chk.close();
  if (!(qc.length === 1 && qc[0] === 'ok')) throw new Error(`差し替え後の quick_check NG: ${qc.join(' / ')}`);
  fs.unlinkSync(WORK);
  log(`✅ 差し替え完了。元の破損DBは ${keep} に保管`);
  process.exit(0);
} catch (e) {
  log(`❌ 差し替え失敗: ${e.message} → 元に戻す`);
  try { fs.unlinkSync(`${DB}.salvage-tmp`); } catch {}
  // 元DBを退避できていた場合だけ、置き場所にある途中コピーを消す (退避前なら DB は元DBそのもの)
  try { if (moved.includes('') && fs.existsSync(DB)) fs.unlinkSync(DB); } catch {}
  for (const suf of moved) { try { fs.renameSync(keep + suf, DB + suf); } catch (e2) { log(`  戻し失敗 ${suf}: ${e2.message}`); } }
  process.exit(1);
}
