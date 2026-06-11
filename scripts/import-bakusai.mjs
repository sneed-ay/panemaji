#!/usr/bin/env node
// ============================================================================
// 爆サイ パネマジ言及の取り込み (shop_comments + reviews + 嬢の新規作成)
//
// 設計原則 (ユーザー合意):
//   - verbatim(元レスそのまま) / 出所 browser_id = ext-bakusai-{tid}-{res} を必ず保持
//   - 店レベル → shop_comments / 嬢名明記 → reviews(panel_rating)
//   - 個人スレで名指しされDB未在籍の嬢は create_girl:true で新規作成(出所フラグ付き)
//   - 冪等: 既存(browser_id一致)はスキップ。会員データ(users/favorites/sessions/会員review)は一切触らない
//   - 取り消し可能: 全て browser_id LIKE 'ext-bakusai%' / source_id LIKE 'ext-bk-g-%' で一括削除できる
//
// 使い方:
//   DB_PATH=... node scripts/import-bakusai.mjs            # 取り込み
//   DB_PATH=... node scripts/import-bakusai.mjs --dry      # 件数だけ(挿入しない)
//   入力: scripts/bakusai-import-data.json  ({shop_comments:[...], reviews:[...]})
// ============================================================================
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, '..', 'panemaji.db');
const DATA = process.env.BK_DATA || resolve(__dirname, 'bakusai-import-data.json');
const DRY = process.argv.includes('--dry');

if (!existsSync(DATA)) { console.log(`[import-bakusai] データ無し: ${DATA} → skip`); process.exit(0); }
const data = JSON.parse(readFileSync(DATA, 'utf8'));
const shopComments = Array.isArray(data.shop_comments) ? data.shop_comments : [];
const reviews = Array.isArray(data.reviews) ? data.reviews : [];

const db = new Database(DB_PATH);
db.pragma('busy_timeout = 5000');

// 🚨 会員データ保全: 取り込み前後でスナップショットを取り、減っていたら異常終了
const snap = () => ({
  users: tbl('users') ? db.prepare('SELECT COUNT(*) c FROM users').get().c : 0,
  favorites: tbl('favorites') ? db.prepare('SELECT COUNT(*) c FROM favorites').get().c : 0,
  memberReviews: hasCol('reviews', 'user_id') ? db.prepare('SELECT COUNT(*) c FROM reviews WHERE user_id IS NOT NULL').get().c : 0,
});
function tbl(n) { return db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(n); }
function hasCol(t, c) { try { return db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c); } catch { return false; } }
const before = snap();

const RATINGS = new Set(['panel_match', 'panel_diff', 'jirai']);
const activeShop = db.prepare('SELECT 1 FROM shops WHERE id=? AND is_active=1');
let nComment = 0, nReview = 0, nNewGirl = 0, skipped = 0;

const run = db.transaction(() => {
  // shop_comments (店レベル)
  const hasC = db.prepare('SELECT 1 FROM shop_comments WHERE shop_id=? AND browser_id=?');
  const insC = db.prepare('INSERT INTO shop_comments (shop_id, comment, browser_id, created_at) VALUES (?,?,?,?)');
  for (const c of shopComments) {
    if (!c.shop_id || !c.comment || !c.source || !activeShop.get(c.shop_id)) { skipped++; continue; }
    if (hasC.get(c.shop_id, c.source)) { skipped++; continue; }      // 冪等
    if (!DRY) insC.run(c.shop_id, String(c.comment).slice(0, 1000), c.source, c.date || null);
    nComment++;
  }
  // reviews (嬢別) + 未在籍嬢の新規作成
  const findGirl = db.prepare('SELECT id FROM girls WHERE shop_id=? AND name=? AND is_active=1');
  const insGirl = db.prepare("INSERT INTO girls (name, shop_id, source_id, is_active, created_at) VALUES (?,?,?,1,?)");
  const hasR = db.prepare('SELECT 1 FROM reviews WHERE girl_id=? AND browser_id=?');
  const insR = db.prepare('INSERT INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id, created_at) VALUES (?,?,?,?,?,?)');
  for (const r of reviews) {
    if (!r.shop_id || !r.girl_name || !RATINGS.has(r.panel_rating) || !r.source || !activeShop.get(r.shop_id)) { skipped++; continue; }
    let g = findGirl.get(r.shop_id, r.girl_name);
    if (!g && r.create_girl) {
      const sid = `ext-bk-g-${r.shop_id}-${r.girl_name}`;
      const exists = db.prepare('SELECT id FROM girls WHERE source_id=?').get(sid);
      if (exists) g = exists;
      else if (!DRY) { const info = insGirl.run(r.girl_name, r.shop_id, sid, r.date || null); g = { id: info.lastInsertRowid }; nNewGirl++; }
      else { nNewGirl++; g = { id: -1 }; }
    }
    if (!g) { skipped++; continue; }
    if (g.id !== -1 && hasR.get(g.id, r.source)) { skipped++; continue; } // 冪等
    if (!DRY && g.id !== -1) insR.run(g.id, r.date || '2024-01-01', r.panel_rating, r.comment ? String(r.comment).slice(0, 1000) : null, r.source, r.date || null);
    nReview++;
  }
});
run();

const after = snap();
if (after.users < before.users || after.favorites < before.favorites || after.memberReviews < before.memberReviews) {
  console.error(`[import-bakusai] 🛑 会員データ減少を検知 before=${JSON.stringify(before)} after=${JSON.stringify(after)} → 異常`);
  process.exit(3);
}
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
console.log(`[import-bakusai] ${DRY ? '(dry)' : ''} shop_comments:+${nComment} reviews:+${nReview} 新規嬢:+${nNewGirl} skip:${skipped} / 会員保全OK(users ${before.users}→${after.users})`);
