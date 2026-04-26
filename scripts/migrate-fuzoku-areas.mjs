#!/usr/bin/env node
/**
 * fuzoku.jp 由来の一時エリア (prefCode-fj-*) の MECE 統合マイグレーション
 *
 * 使い方:
 *   node scripts/migrate-fuzoku-areas.mjs --dry-run   # 変更プレビューのみ
 *   node scripts/migrate-fuzoku-areas.mjs             # 実際に移行
 *
 * 動作:
 *   1. slug LIKE '%-fj-%' の一時エリアを列挙
 *   2. 各エリアの shop を、build-fuzoku-mapping.mjs と同じロジックで
 *      正規slug にマッピング（auto-match → override → -other / {pref}-city）
 *   3. shop の area_id を正規エリアに差し替え
 *   4. shop が0になった -fj- エリアを削除
 */

import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { OVERRIDES } from './fuzoku-area-overrides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');

const dryRun = process.argv.includes('--dry-run');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 10000');

// 正規slug（clean slug）一覧
const cleanAreas = db.prepare(`
  SELECT prefecture, slug, name
  FROM areas
  WHERE prefecture IS NOT NULL AND prefecture != ''
    AND slug NOT LIKE '%-fj-%'
    AND slug NOT GLOB '*-a[0-9][0-9][0-9][0-9]'
    AND slug NOT LIKE '%-other'
  ORDER BY prefecture, slug
`).all();

const byPref = {};
for (const a of cleanAreas) {
  if (!byPref[a.prefecture]) byPref[a.prefecture] = [];
  byPref[a.prefecture].push(a);
}

const otherByPref = {};
for (const o of db.prepare(`SELECT prefecture, slug FROM areas WHERE slug LIKE '%-other'`).all()) {
  otherByPref[o.prefecture] = o.slug;
}
// -other がない県のフォールバック
const fallbackByPref = {};
for (const a of cleanAreas) {
  if (!fallbackByPref[a.prefecture] && a.slug.endsWith('-city')) {
    fallbackByPref[a.prefecture] = a.slug;
  }
}
// さらに不足分は最初の clean slug
for (const p of Object.keys(byPref)) {
  if (!fallbackByPref[p] && !otherByPref[p]) {
    fallbackByPref[p] = byPref[p][0].slug;
  }
}
// tottori の legacy slug も許可
const allAreasById = new Map(
  db.prepare('SELECT id, slug FROM areas').all().map(r => [r.id, r.slug])
);
const allAreasBySlug = new Map(
  db.prepare('SELECT id, slug FROM areas').all().map(r => [r.slug, r.id])
);

function tokens(name) {
  return name.split(/[・\/／]/).map(t => t.trim()).filter(Boolean);
}
function score(fTokens, dbName) {
  let s = 0;
  for (const t of fTokens) if (dbName.includes(t)) s += t.length;
  return s;
}

function resolveSlug(pref, fuzokuAreaName) {
  // " 風俗" / "(風俗じゃぱん)" サフィックス除去
  const normalized = fuzokuAreaName
    .replace(/\s*\(風俗じゃぱん\)\s*$/, '')
    .replace(/\s*風俗\s*$/, '')
    .trim();

  // 1. override hit
  const overrideKey = `${pref}|${normalized}`;
  if (OVERRIDES[overrideKey]) {
    return { slug: OVERRIDES[overrideKey], via: 'OVERRIDE' };
  }

  // 2. fuzzy match
  const fTokens = tokens(normalized);
  const candidates = byPref[pref] || [];
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const sc = score(fTokens, c.name);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  if (best && bestScore >= normalized.length) {
    return { slug: best.slug, via: 'HIGH' };
  }
  if (best) return { slug: best.slug, via: 'MED' };

  // 3. fallback
  return {
    slug: otherByPref[pref] || fallbackByPref[pref] || null,
    via: 'FALLBACK',
  };
}

// ─── メイン ──────────────────────
console.log(`${dryRun ? '🔍 DRY-RUN' : '🚀 LIVE'} MECE 統合マイグレーション開始`);

const fjAreas = db.prepare(`
  SELECT a.id AS area_id, a.name AS area_name, a.slug AS area_slug, a.prefecture,
         COUNT(s.id) AS shop_count
  FROM areas a
  LEFT JOIN shops s ON s.area_id = a.id
  WHERE a.slug LIKE '%-fj-%'
  GROUP BY a.id
  ORDER BY a.prefecture, a.slug
`).all();

console.log(`対象一時エリア: ${fjAreas.length} 件`);
if (fjAreas.length === 0) {
  console.log('処理対象なし。終了。');
  process.exit(0);
}

const shopUpdateStmt = db.prepare('UPDATE shops SET area_id = ? WHERE area_id = ?');
const areaDeleteStmt = db.prepare('DELETE FROM areas WHERE id = ?');

const viaCount = {};
let totalShopsMoved = 0;
let totalAreasDeleted = 0;
let totalUnresolved = 0;

const txn = db.transaction(() => {
  for (const fj of fjAreas) {
    const r = resolveSlug(fj.prefecture, fj.area_name);
    const targetId = r.slug ? allAreasBySlug.get(r.slug) : null;
    viaCount[r.via] = (viaCount[r.via] || 0) + 1;

    if (!targetId) {
      console.log(`  ⚠️  UNRESOLVED [${fj.prefecture}] ${fj.area_name} (${fj.shop_count} shops) — no target`);
      totalUnresolved++;
      continue;
    }

    const targetSlug = allAreasById.get(targetId);
    console.log(`  [${r.via}] ${fj.prefecture}|${fj.area_name} (${fj.shop_count} shops) → ${targetSlug}`);

    if (!dryRun) {
      if (fj.shop_count > 0) {
        shopUpdateStmt.run(targetId, fj.area_id);
        totalShopsMoved += fj.shop_count;
      }
      areaDeleteStmt.run(fj.area_id);
      totalAreasDeleted++;
    } else {
      totalShopsMoved += fj.shop_count;
      totalAreasDeleted++;
    }
  }
});

txn();

console.log(`\n=== サマリー ===`);
console.log(`対象: ${fjAreas.length} エリア`);
console.log(`解決内訳: ${JSON.stringify(viaCount)}`);
console.log(`${dryRun ? '[dry-run] ' : ''}移動shop: ${totalShopsMoved}`);
console.log(`${dryRun ? '[dry-run] ' : ''}削除エリア: ${totalAreasDeleted}`);
console.log(`未解決: ${totalUnresolved}`);

db.close();
console.log(dryRun ? '\n✅ dry-run 完了（DB未変更）' : '\n✅ マイグレーション完了');
