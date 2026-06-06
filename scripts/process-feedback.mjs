#!/usr/bin/env node
/**
 * 会員フィードバック処理: open な報告を反映し resolved 化する。
 *
 *  - shop  closed / not_exist   → 該当 shop を is_active=0 (★DELETE しない / 行は残す)
 *  - girl  departed / not_exist → 該当 girl を is_active=0
 *  - wrong_info / other (自由記述) → 内容をログするだけ・open のまま (人間レビュー用)
 *  - 反映したものだけ status='resolved'
 *  - reviews / users / sessions / favorites には一切触れない (before/after で検証)
 *  - feedback テーブルが無い環境 (local/db-latest) では no-op
 *  - 非アクティブ化は「行を残して is_active=0」なので reviews.girl_id 等のリンクは壊れない & 復元可能
 *
 * 使い方: node scripts/process-feedback.mjs <DB>
 * exit:  0=成功 / 1=引数不足 / 3=会員データ変化を検知(要調査)
 */
import Database from 'better-sqlite3';

const DB = process.argv[2];
if (!DB) { console.error('usage: node scripts/process-feedback.mjs <DB>'); process.exit(1); }

const db = new Database(DB);
db.pragma('foreign_keys = OFF');

// feedback テーブルが無ければ何もしない (ローカル/db-latest は prod-only の feedback を持たない)
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'").get()) {
  console.log('feedback テーブル無し → skip');
  db.close();
  process.exit(0);
}

const memSnap = () => {
  const s = {};
  for (const [k, q] of [
    ['reviews', 'SELECT COUNT(*) c FROM reviews'],
    ['genuine', "SELECT COUNT(*) c FROM reviews WHERE browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%'"],
    ['userLinked', 'SELECT COUNT(*) c FROM reviews WHERE user_id IS NOT NULL'],
    ['users', 'SELECT COUNT(*) c FROM users'],
    ['favorites', 'SELECT COUNT(*) c FROM favorites'],
  ]) { try { s[k] = db.prepare(q).get().c; } catch { /* 列/表が無い環境ではスキップ */ } }
  return s;
};
const before = memSnap();

const open = db.prepare("SELECT id, target_type, shop_id, girl_id, reason, detail FROM feedback WHERE status='open' ORDER BY created_at").all();
console.log(`open feedback: ${open.length} 件`);

const deactShop = db.prepare('UPDATE shops SET is_active=0 WHERE id=? AND is_active=1');
const deactGirl = db.prepare('UPDATE girls SET is_active=0 WHERE id=? AND is_active=1');
const resolveFb = db.prepare("UPDATE feedback SET status='resolved' WHERE id=?");
const SHOP_CLOSE = new Set(['closed', 'not_exist']);
const GIRL_CLOSE = new Set(['departed', 'not_exist']);
let dShops = 0, dGirls = 0, resolved = 0, leftOpen = 0;

db.transaction(() => {
  for (const f of open) {
    if (f.target_type === 'shop' && SHOP_CLOSE.has(f.reason) && f.shop_id) {
      dShops += deactShop.run(f.shop_id).changes;
      resolveFb.run(f.id); resolved++;
      console.log(`  [shop#${f.shop_id}] ${f.reason} → 非アクティブ化 + resolved (fb#${f.id})`);
    } else if (f.target_type === 'girl' && GIRL_CLOSE.has(f.reason) && f.girl_id) {
      dGirls += deactGirl.run(f.girl_id).changes;
      resolveFb.run(f.id); resolved++;
      console.log(`  [girl#${f.girl_id}] ${f.reason} → 非アクティブ化 + resolved (fb#${f.id})`);
    } else {
      // wrong_info / other → 自動適用せず open 維持・内容ログ (人間レビュー用)
      leftOpen++;
      console.log(`  [${f.target_type}#${f.shop_id || f.girl_id}] ${f.reason} (open維持/要レビュー): ${(f.detail || '').slice(0, 120)}`);
    }
  }
})();

const after = memSnap();
const memOk = before.reviews === after.reviews
  && before.genuine === after.genuine
  && (before.userLinked ?? 0) === (after.userLinked ?? 0)
  && (before.users ?? 0) === (after.users ?? 0)
  && (before.favorites ?? 0) === (after.favorites ?? 0);

console.log(`\n結果: 非アクティブ化 shops=${dShops} girls=${dGirls} / resolved=${resolved} / open維持(要レビュー)=${leftOpen}`);
console.log(memOk ? '✅ 会員データ不変を確認 (reviews/genuine/userLinked/users/favorites)' : '❌ 会員データが変化! 要調査');
if (!memOk) process.exitCode = 3;
db.close();
