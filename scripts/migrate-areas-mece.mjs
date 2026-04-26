#!/usr/bin/env node
/**
 * 全 active shops を 独自MECEエリア (lib/unified-areas.mjs) に再分配する。
 *
 * 1. 各都道府県の正規エリアを ensureArea (なければ作成、name と display_order を統一)
 * 2. 全 active shops を pickArea() でルーティング → area_id を更新
 * 3. shop=0 のエリアを削除
 * 4. レガシー -aXXXX / pending / -ch / -rd / -pl / -meste / -robin / -fj 系を全削除
 *
 * 使い方:
 *   node scripts/migrate-areas-mece.mjs --dry-run
 *   node scripts/migrate-areas-mece.mjs --apply
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { UNIFIED_AREAS, pickArea, getAllAreas } from './lib/unified-areas.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const APPLY = process.argv.includes('--apply');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
db.pragma('foreign_keys = ON');

console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}\n`);

// ─── Step 1: 正規エリアを ensure ───────────────────────────────
function ensureArea(pref, slug, name, order) {
  // 1) slug一致で既存検索
  let existing = db.prepare(`SELECT id, name, slug, display_order, prefecture FROM areas WHERE slug=?`).get(slug);
  if (existing) {
    if (existing.name !== name || existing.display_order !== order || existing.prefecture !== pref) {
      if (APPLY) db.prepare(`UPDATE areas SET name=?, display_order=?, prefecture=? WHERE id=?`).run(name, order, pref, existing.id);
    }
    return existing.id;
  }
  // 2) name一致で既存検索 (UNIQUE制約対応: 同名エリアの slug を 正規slug に書き換え)
  existing = db.prepare(`SELECT id, name, slug, display_order FROM areas WHERE name=? AND prefecture=?`).get(name, pref);
  if (existing) {
    if (APPLY) db.prepare(`UPDATE areas SET slug=?, display_order=?, prefecture=? WHERE id=?`).run(slug, order, pref, existing.id);
    return existing.id;
  }
  // 3) 新規INSERT
  if (APPLY) {
    const r = db.prepare(`INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, ?)`).run(name, slug, pref, order);
    return r.lastInsertRowid;
  }
  return -1;
}

console.log('=== Step 1: 正規エリアを ensure ===');
const slugToId = new Map();
let createdCnt = 0;
for (const a of getAllAreas()) {
  const id = ensureArea(a.prefecture, a.slug, a.name, a.order);
  slugToId.set(a.slug, id);
}

// ─── Step 2: 全 active shops を 再分配 ──────────────────────────
console.log('\n=== Step 2: 全 active shops を 再分配 ===');
const shops = db.prepare(`
  SELECT s.id, s.name, s.area_id, s.source_url, a.prefecture, a.name AS old_area_name, a.slug AS old_slug
  FROM shops s LEFT JOIN areas a ON s.area_id=a.id
`).all(); // active不問: inactive shops も含めて再分配しないと FK 削除不可

const updateShopArea = db.prepare(`UPDATE shops SET area_id=? WHERE id=?`);
let moved = 0, kept = 0, unmapped = 0;
const moveStat = {}; // {pref: {dest_slug: count}}

const txn = db.transaction(() => {
  for (const s of shops) {
    if (!s.prefecture) { unmapped++; continue; }
    const target = pickArea(s.prefecture, s.name, s.source_url, s.old_area_name);
    if (!target) { unmapped++; continue; }
    const targetId = slugToId.get(target.slug);
    if (!targetId || targetId === -1) { unmapped++; continue; }
    if (targetId !== s.area_id) {
      if (APPLY) updateShopArea.run(targetId, s.id);
      moved++;
      const k = `${s.prefecture}:${target.slug}`;
      moveStat[k] = (moveStat[k] || 0) + 1;
    } else {
      kept++;
    }
  }
});
if (APPLY) txn();

console.log(`  移動: ${moved}, 維持: ${kept}, マップ不可: ${unmapped}`);

// ─── Step 3: 空エリア削除 ───────────────────────────────────
console.log('\n=== Step 3: 空エリア削除 ===');
const allAreas = db.prepare(`
  SELECT a.id, a.slug, a.prefecture,
    (SELECT COUNT(*) FROM shops s WHERE s.area_id=a.id) AS shop_cnt
  FROM areas a
`).all();

let deletedEmpty = 0, deletedLegacy = 0;
const validSlugs = new Set([...slugToId.keys()]);

const deleteArea = db.prepare(`DELETE FROM areas WHERE id=?`);
const txn2 = db.transaction(() => {
  for (const a of allAreas) {
    const isLegacy = /(-fj-|-ch-|-rd-|-pl-|-meste-|-robin-|-pending|^.+-a\d{4}$)/.test(a.slug) ||
                     /^.+-a\d{4}$/.test(a.slug);
    const isEmpty = a.shop_cnt === 0;
    const isUnified = validSlugs.has(a.slug);

    if (isLegacy && isEmpty) {
      if (APPLY) deleteArea.run(a.id);
      deletedLegacy++;
    } else if (isEmpty && !isUnified) {
      if (APPLY) deleteArea.run(a.id);
      deletedEmpty++;
    }
  }
});
if (APPLY) txn2();
console.log(`  レガシー空削除: ${deletedLegacy}, その他空削除: ${deletedEmpty}`);

// ─── 結果サマリ ───
const after = db.prepare(`SELECT COUNT(*) c FROM areas`).get().c;
const tempAfter = db.prepare(`
  SELECT COUNT(*) c FROM areas
  WHERE slug LIKE '%-pending' OR slug LIKE '%-fj-%' OR slug LIKE '%-ch-A%'
     OR slug LIKE '%-rd-%' OR slug LIKE '%-pl-%' OR slug LIKE '%-meste-%' OR slug LIKE '%-robin-%'
     OR slug GLOB '*-a[0-9][0-9][0-9][0-9]'
`).get().c;
console.log(`\n${APPLY ? 'After' : 'Predicted'}: areas total=${after}, レガシー残=${tempAfter}`);
console.log(`  正規定義 (unified-areas.mjs): ${slugToId.size}`);

db.close();
