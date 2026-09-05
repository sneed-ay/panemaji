#!/usr/bin/env node
/**
 * 「閉店」扱い (is_active=0) になっている店が、掲載元では今も営業していないかを洗い直す。
 *
 * 背景 (2026-09-06):
 *   会員フィードバックに「閉店していない」という報告が繰り返し届いていた
 *   (#5 / #84 / #85 …)。掲載元を確認すると、実際に今も営業中だった:
 *     shop 1071 名古屋デリヘル GOLDニット … 掲載元 HTTP 200 / 嬢31人 / 閉店表記なし
 *     shop 18099 アラビアンナイト        … 掲載元 HTTP 200 / 嬢35人 / 閉店表記なし
 *
 *   原因は update-all.mjs の deactivateStaleShops。県単位でしか絞っていなかったため、
 *   県の途中でエリア巡回が失敗すると未走査エリアの店の last_seen_at が更新されず、
 *   30日後にまとめて is_active=0 にされていた。
 *   (例: 名古屋駅周辺は掲載元に今も載る29店のうち22店が is_active=0)
 *   → 恒久対策として「実際に店を拾えたエリア配下しか落とさない」ガードを
 *     update-all.mjs に入れた。本スクリプトは、それ以前に作られた誤閉店の後始末。
 *
 * 使い方:
 *   node scripts/recheck-closed-shops.mjs --source cityheaven --limit 200          # 確認のみ
 *   node scripts/recheck-closed-shops.mjs --source cityheaven --limit 200 --apply  # 復帰させる
 *
 * 安全設計:
 *   - 既定は dry-run。--apply を付けたときだけ書き込む。
 *   - 復帰させるのは「掲載元が HTTP 200 を返し」「閉店を示す語が無く」「嬢のリンクが1件以上ある」場合のみ。
 *     1つでも欠ければ触らない (取得失敗を営業中と誤認しない)。
 *   - 同名・同エリアで既に is_active=1 の店がある場合は重複を作らないよう復帰させない。
 *   - is_active を 0→1 にするだけで、行の削除も他テーブルの変更も一切しない。
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(1500 + Math.random() * 900);

/** 掲載元ごとの「営業中」判定 */
const SOURCES = {
  cityheaven: {
    match: '%cityheaven.net%',
    // 嬢の個別リンク。1件も無ければ「店ページとして生きていない」とみなす
    girlRe: /girlid-\d+/g,
  },
  'ranking-deli': { match: '%ranking-deli%', girlRe: /class="girls-name/g },
  fuzoku: { match: '%fuzoku.jp%', girlRe: /\/girl\/\d+\//g },
  purelovers: { match: '%purelovers%', girlRe: /\/girl\/\d+\//g },
};
/** これが本文にあれば掲載終了とみなす */
const CLOSED_WORDS = ['閉店', '掲載終了', '営業終了', 'ページは存在しません', '見つかりませんでした'];

function parseArgs() {
  const a = process.argv.slice(2);
  const val = (k) => a.find((x, i) => a[i - 1] === k) || null;
  return {
    source: val('--source') || 'cityheaven',
    limit: Number(val('--limit') || 200),
    apply: a.includes('--apply'),
  };
}

async function fetchPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (r.status === 404 || r.status === 410) return { status: r.status, html: null };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { status: r.status, html: await r.text() };
    } catch {
      if (i === 2) return { status: 0, html: null };
      await sleep(2000 * (i + 1));
    }
  }
  return { status: 0, html: null };
}

const opts = parseArgs();
const src = SOURCES[opts.source];
if (!src) {
  console.error(`--source は ${Object.keys(SOURCES).join(' | ')} のいずれか`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

// 対象: そのソースの is_active=0 の店。誤閉店は古い last_seen_at に集中するので古い順。
const shops = db
  .prepare(
    `SELECT id, name, area_id, source_url, last_seen_at
       FROM shops
      WHERE is_active = 0 AND source_url LIKE ?
      ORDER BY last_seen_at ASC
      LIMIT ?`
  )
  .all(src.match, opts.limit);

const totalClosed = db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active = 0 AND source_url LIKE ?').get(src.match).c;
console.log(`\n=== 誤閉店の洗い直し (${opts.source}) ===`);
console.log(`  閉店扱い ${totalClosed} 店 / 今回 ${shops.length} 店を確認${opts.apply ? '' : '  [DRY-RUN]'}`);

// 同名・同エリアで既にアクティブな店があるか (重複を作らないため)
const dupQ = db.prepare(
  'SELECT id FROM shops WHERE is_active = 1 AND area_id = ? AND name = ? AND id <> ? LIMIT 1'
);
const revive = db.prepare('UPDATE shops SET is_active = 1, last_seen_at = ? WHERE id = ?');

let alive = 0, gone = 0, unknown = 0, dup = 0, revived = 0;
const aliveList = [];

for (const s of shops) {
  const { status, html } = await fetchPage(s.source_url);
  await delay();

  if (status === 404 || status === 410) { gone++; continue; }
  if (!html) { unknown++; continue; }

  const closed = CLOSED_WORDS.some((w) => html.includes(w));
  const girls = new Set(html.match(src.girlRe) || []).size;
  if (closed || girls === 0) { gone++; continue; }

  alive++;
  const d = dupQ.get(s.area_id, s.name, s.id);
  if (d) {
    dup++;
    console.log(`  [重複のため据え置き] #${s.id} ${s.name} (同エリアに稼働中の #${d.id} あり)`);
    continue;
  }
  aliveList.push({ id: s.id, name: s.name, girls, last: (s.last_seen_at || '').slice(0, 10) });
  if (opts.apply) {
    revive.run(new Date().toISOString(), s.id);
    revived++;
  }
}

console.log(`\n  掲載元で営業中 : ${alive}`);
console.log(`  掲載終了/404   : ${gone}`);
console.log(`  取得できず     : ${unknown}  (触っていない)`);
console.log(`  重複で据え置き : ${dup}`);
console.log(`  ${opts.apply ? '復帰させた' : '復帰対象'}     : ${opts.apply ? revived : aliveList.length}`);
if (aliveList.length) {
  console.log('\n  --- 営業中と判定した店 (先頭30件) ---');
  for (const a of aliveList.slice(0, 30)) console.log(`    #${String(a.id).padStart(6)} ${a.name.slice(0, 34).padEnd(36)} 嬢${String(a.girls).padStart(3)}人  最終${a.last}`);
  if (aliveList.length > 30) console.log(`    … 他 ${aliveList.length - 30} 件`);
}
db.close();
