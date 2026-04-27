#!/usr/bin/env node
/**
 * 同一 shop_id × 正規化name 一致 の girls を統合
 *
 * 原因: 「胡蝶 あげは」「胡蝶　あげは」「胡蝶あげは」 等の表記ゆれで別 girl扱い
 *
 * 処理:
 *   1. shop_id × normalize_girl(name) で重複グループ抽出
 *   2. 各グループから「正」を選定 (image_url有り → reviews多 → 古いid)
 *   3. reviews.girl_id を「正」に書き換え
 *   4. 「正」の image_url が空なら 他から補完
 *   5. 統合された girl は is_active=0
 *
 * 使い方:
 *   node scripts/merge-duplicate-girls.mjs            # dry-run
 *   node scripts/merge-duplicate-girls.mjs --apply    # 実行
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'panemaji.db');
const APPLY = process.argv.includes('--apply');

// 嬢名の正規化 (clean-shop-name より攻撃的、 嬢名は短いので)
function normalizeGirlName(raw) {
  if (!raw) return '';
  let n = String(raw).normalize('NFKC').trim();
  // 装飾削除
  n = n.replace(/[★☆♡♥♦♢♪♬◆◇●○■□▲▽△▼※#＃@＠＊*&＆+＝/／\\￥]/g, '');
  // 中黒・ハイフン・波線・引用 削除
  n = n.replace(/[・･\-―—‐ーｰ~～〜!！?？.,，、。'"`]/g, '');
  // 括弧と中身 削除
  n = n.replace(/[（(\[【〔『「][^）)\]】〕』」]*[）)\]】〕』」]/g, '');
  // スペース全削除
  n = n.replace(/[\s　]/g, '');
  // ひらがな→カタカナ
  n = n.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  // lower
  return n.toLowerCase();
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
db.pragma('foreign_keys = ON');
db.function('normalize_girl', { deterministic: true }, (s) => normalizeGirlName(s || ''));

console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}\n`);

// 重複グループ抽出
const dups = db.prepare(`
  WITH n AS (
    SELECT g.id, g.shop_id, g.name, g.image_url,
           normalize_girl(g.name) AS nk
    FROM girls g WHERE g.is_active=1 AND length(normalize_girl(g.name)) >= 1
  )
  SELECT shop_id, nk, GROUP_CONCAT(id) as ids, COUNT(*) cnt
  FROM n GROUP BY shop_id, nk HAVING cnt >= 2
`).all();

console.log(`重複グループ: ${dups.length}`);
const totalDup = dups.reduce((s, d) => s + d.cnt, 0);
const toMerge = totalDup - dups.length;
console.log(`重複 girls: ${totalDup} / 統合される: ${toMerge}\n`);

const pickPrimary = (idsCsv) => {
  const ids = idsCsv.split(',').map(Number);
  const candidates = db.prepare(`
    SELECT g.id, g.image_url,
      (SELECT COUNT(*) FROM reviews r WHERE r.girl_id=g.id) as rev_cnt
    FROM girls g WHERE g.id IN (${ids.map(() => '?').join(',')})
    ORDER BY (CASE WHEN g.image_url IS NOT NULL AND g.image_url != '' THEN 1 ELSE 0 END) DESC,
             rev_cnt DESC, g.id ASC
    LIMIT 1
  `).all(...ids);
  return candidates[0]?.id;
};

const updateReview = db.prepare('UPDATE reviews SET girl_id=? WHERE girl_id=?');
const updateImage = db.prepare(`UPDATE girls SET image_url=COALESCE(NULLIF(image_url, ''), (SELECT image_url FROM girls WHERE id=? AND image_url IS NOT NULL AND image_url != '')) WHERE id=? AND (image_url IS NULL OR image_url = '')`);
const deactivate = db.prepare('UPDATE girls SET is_active=0 WHERE id=?');

let mergedCount = 0;
const txn = db.transaction(() => {
  for (const d of dups) {
    const ids = d.ids.split(',').map(Number);
    const primary = pickPrimary(d.ids);
    if (!primary) continue;
    const others = ids.filter((id) => id !== primary);

    // 正の image_url が空なら 他のgirlの image_url を借用
    for (const o of others) {
      updateImage.run(o, primary);
    }

    for (const o of others) {
      updateReview.run(primary, o);
      deactivate.run(o);
      mergedCount++;
    }
  }
});

if (APPLY) {
  txn();
  console.log(`✅ ${mergedCount} girls を is_active=0 に統合`);
} else {
  console.log('--dry-run-- 統合プレビュー (Top 5):');
  for (const d of dups.slice(0, 5)) {
    const ids = d.ids.split(',').map(Number);
    const primary = pickPrimary(d.ids);
    const names = db.prepare(`SELECT name FROM girls WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(r => r.name);
    console.log(`  shop=${d.shop_id} primary=${primary} merge=${ids.length - 1} [${names.join(' | ')}]`);
  }
}

const after = db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;
console.log(`\n${APPLY ? 'After' : 'Predicted'} active girls: ${after}`);

db.close();
