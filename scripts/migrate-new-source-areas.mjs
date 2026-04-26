#!/usr/bin/env node
/**
 * シティヘブン/駅ちか/ロビン/ぴゅあらば/m-este の一時エリア由来shopを
 * 既存独自エリアにマップしなおす MECE マイグレーション。
 *
 * 簡易版: 一時エリアの shops を {prefecture}-other にフォールバック集約。
 * その後 一時エリアを削除。
 *
 * 注意: 詳細なエリアマッピング（A1305=池袋等）は将来別途整理する。
 *
 * 使い方:
 *   node scripts/migrate-new-source-areas.mjs --dry-run
 *   node scripts/migrate-new-source-areas.mjs --apply
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'panemaji.db');
const APPLY = process.argv.includes('--apply');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
db.pragma('foreign_keys = ON');

console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}\n`);

// 対象一時エリアの判定 (-ch-A / -rd-pending / -pl-pending / -meste-pending / -robin-a / -fj-)
const tempAreas = db.prepare(`
  SELECT a.id, a.slug, a.prefecture,
         (SELECT COUNT(*) FROM shops s WHERE s.area_id=a.id) AS shop_cnt
  FROM areas a
  WHERE a.slug LIKE '%-ch-A%'
     OR a.slug LIKE '%-rd-pending'
     OR a.slug LIKE '%-pl-pending'
     OR a.slug LIKE '%-meste-pending'
     OR a.slug LIKE '%-robin-a%'
     OR a.slug LIKE '%-fj-%'
`).all();

console.log(`対象一時エリア: ${tempAreas.length}`);
const totalShops = tempAreas.reduce((s, a) => s + a.shop_cnt, 0);
console.log(`紐付くshop合計: ${totalShops}\n`);

// {pref}-other の id を取得（無ければ作成）
const otherCache = new Map();
function getOtherAreaId(pref) {
  if (otherCache.has(pref)) return otherCache.get(pref);
  let row = db.prepare(`SELECT id FROM areas WHERE slug=?`).get(`${pref}-other`);
  if (!row) {
    if (APPLY) {
      const r = db.prepare(`INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, 99)`).run(`${pref}その他`, `${pref}-other`, pref);
      row = { id: r.lastInsertRowid };
      console.log(`  + 作成: ${pref}-other (id ${row.id})`);
    } else {
      console.log(`  (would create: ${pref}-other)`);
      row = { id: -1 };
    }
  }
  otherCache.set(pref, row.id);
  return row.id;
}

const updateShopArea = db.prepare(`UPDATE shops SET area_id=? WHERE area_id=?`);
const deleteArea = db.prepare(`DELETE FROM areas WHERE id=?`);

let movedShops = 0, deletedAreas = 0;
const txn = db.transaction(() => {
  for (const t of tempAreas) {
    if (!t.prefecture) continue;
    const target = getOtherAreaId(t.prefecture);
    if (target === -1) continue;
    if (t.shop_cnt > 0) {
      updateShopArea.run(target, t.id);
      movedShops += t.shop_cnt;
    }
    deleteArea.run(t.id);
    deletedAreas++;
  }
});

if (APPLY) {
  txn();
  console.log(`\n✅ 移動shop: ${movedShops} / 削除エリア: ${deletedAreas}`);
} else {
  console.log(`\n(dry-run) 移動shop予定: ${totalShops} / 削除エリア予定: ${tempAreas.length}`);
}

const after = db.prepare(`SELECT COUNT(*) c FROM areas`).get().c;
const tempAfter = db.prepare(`
  SELECT COUNT(*) c FROM areas
  WHERE slug LIKE '%-ch-A%' OR slug LIKE '%-rd-pending' OR slug LIKE '%-pl-pending'
     OR slug LIKE '%-meste-pending' OR slug LIKE '%-robin-a%' OR slug LIKE '%-fj-%'
`).get().c;
console.log(`\n${APPLY ? 'After' : 'Predicted'}: areas total=${after}, 一時エリア残=${tempAfter}`);

db.close();
