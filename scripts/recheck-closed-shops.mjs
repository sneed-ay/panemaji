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
 *   cityheaven は年齢確認ゲートがあり curl では突破できないため、既定で puppeteer を使う。
 *   --no-browser を付けると fetch のみ (他ソース向け・高速)。
 *
 * 安全設計:
 *   - 既定は dry-run。--apply を付けたときだけ書き込む。
 *   - 復帰させるのは「掲載元が HTTP 200 を返し」「閉店を示す語が無く」「嬢のリンクが1件以上ある」場合のみ。
 *     1つでも欠ければ触らない (取得失敗を営業中と誤認しない)。
 *   - 同名・同エリアで既に is_active=1 の店がある場合は重複を作らないよう復帰させない。
 *   - is_active を 0→1 にするだけで、行の削除も他テーブルの変更も一切しない。
 */
import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import { withChromePath } from './lib/chrome-path.mjs';
import path from 'path';
import fs from 'fs';
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
  // 🚨 ranking-deli は本スクリプトでは判定できないので外してある (2026-09-06)。
  //    嬢一覧は店トップではなく {shop_url}/girlslist/ にあり、店トップには嬢の要素が1つも無い。
  //    そのため girlRe が何であれ全店「嬢0人 = 掲載終了」になる (抜き取り30店が全滅した)。
  //    girlslist/ を見ても class="data-name" が営業中・閉店扱いの双方で100件出てしまい、
  //    店自身の在籍なのかサイト共通のウィジェットなのか切り分けられなかった。
  //    復帰させるには refresh-source-girls.mjs の rd アダプタ相当の解析が要る。
  //    誤って営業中の店を「閉店のまま」にする分には害が無いので、判定できるまで対象外とする。
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
    // cityheaven は年齢確認ゲートのため既定でブラウザ。--no-browser で無効化。
    browser: !a.includes('--no-browser'),
  };
}

/**
 * 🚨 cityheaven は年齢確認ゲートを持つ。
 *   一定数のリクエストを超えると店ページが 302 で
 *   http://img.cityheaven.net/cs/nenrei/ に飛ばされ、5KB ほどの確認ページが返る。
 *   curl では `nenrei=y` cookie も `?nenrei=y` も効かず突破できなかった (2026-09-06 実測)。
 *   update-all.mjs は puppeteer で cookie nenrei=y を張った実ブラウザ・セッションを使うので通る。
 *   → ゲートに当たった場合は「確認不能」として**絶対に閉店扱いにしない**。
 *      嬢0人と同じ扱いにすると、生きている店を閉店のまま放置してしまう。
 */
function isAgeGate(url, html) {
  if (/img\.cityheaven\.net\/cs\/nenrei/.test(url || '')) return true;
  return !!html && html.length < 20000 && html.includes('18歳未満');
}

async function fetchPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (r.status === 404 || r.status === 410) return { status: r.status, html: null, gated: false };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const html = await r.text();
      if (isAgeGate(r.url, html)) return { status: r.status, html: null, gated: true };
      return { status: r.status, html, gated: false, finalUrl: r.url };
    } catch {
      if (i === 2) return { status: 0, html: null, gated: false };
      await sleep(2000 * (i + 1));
    }
  }
  return { status: 0, html: null, gated: false };
}


/**
 * puppeteer 版の取得。cityheaven の年齢確認ゲートは cookie nenrei=y を張った
 * 実ブラウザなら通る (update-all.mjs と同じ手口)。
 * 404/410 は response.status() から判定する。
 */
async function makeBrowserFetcher() {
  const browser = await puppeteer.launch(
    withChromePath({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    })
  );
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setCookie({ name: 'nenrei', value: 'y', domain: '.cityheaven.net' });
  await page.setViewport({ width: 1280, height: 800 });

  const get = async (url) => {
    for (let i = 0; i < 2; i++) {
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const status = res ? res.status() : 0;
        if (status === 404 || status === 410) return { status, html: null, gated: false };
        const html = await page.content();
        if (isAgeGate(page.url(), html)) return { status, html: null, gated: true };
        return { status, html, gated: false, finalUrl: page.url() };
      } catch {
        if (i === 1) return { status: 0, html: null, gated: false };
        await sleep(2000);
      }
    }
    return { status: 0, html: null, gated: false };
  };
  return { get, close: () => browser.close() };
}


/**
 * 「掲載元でも本当に終わっていた」と確定した店の記録。
 *
 * 本スクリプトは is_active=0 の店を last_seen_at の古い順に見る。
 * 本当に閉店した店は復帰しないので last_seen_at も変わらず、毎晩ずっと行列の先頭に居座る。
 * 夜間バッチで毎回 300店ずつ流すと、数日で先頭が確定済みの閉店店で埋まり前に進めなくなる。
 * → 確定した店は 30日間スキップして、未確認の店に順番を回す。
 *   取得できなかった店 (unknown/ゲート/転送) は記録しない。次回また見る。
 */
const STATE_FILE = path.join(ROOT, 'logs', '.recheck-confirmed-closed.json');
const CONFIRM_TTL_DAYS = 30;

function loadConfirmed() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const cutoff = Date.now() - CONFIRM_TTL_DAYS * 86400000;
    const keep = {};
    for (const [id, iso] of Object.entries(raw)) {
      if (Date.parse(iso) >= cutoff) keep[id] = iso;
    }
    return keep;
  } catch {
    return {};
  }
}

function saveConfirmed(map) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(map, null, 1));
  } catch (e) {
    console.log('  [warn] 確定済みリストを保存できませんでした:', e.message);
  }
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
const confirmedClosed = loadConfirmed();
const shops = db
  .prepare(
    `SELECT id, name, area_id, source_url, last_seen_at
       FROM shops
      WHERE is_active = 0 AND source_url LIKE ?
      ORDER BY last_seen_at ASC
      LIMIT ?`
  )
  .all(src.match, opts.limit + Object.keys(confirmedClosed).length)
  .filter((r) => !confirmedClosed[r.id])
  .slice(0, opts.limit);

const totalClosed = db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active = 0 AND source_url LIKE ?').get(src.match).c;
console.log(`\n=== 誤閉店の洗い直し (${opts.source}) ===`);
console.log(`  閉店扱い ${totalClosed} 店 / 今回 ${shops.length} 店を確認${opts.apply ? '' : '  [DRY-RUN]'}`);

// 同名・同エリアで既にアクティブな店があるか (重複を作らないため)
const dupQ = db.prepare(
  'SELECT id FROM shops WHERE is_active = 1 AND area_id = ? AND name = ? AND id <> ? LIMIT 1'
);
const revive = db.prepare('UPDATE shops SET is_active = 1, last_seen_at = ? WHERE id = ?');

let alive = 0, gone = 0, unknown = 0, dup = 0, revived = 0, gatedCount = 0, redirected = 0;
const aliveList = [];

const bf = opts.browser ? await makeBrowserFetcher() : null;
if (bf) console.log('  取得方法: puppeteer (年齢確認ゲート突破)');
const getPage = bf ? bf.get : fetchPage;

for (const s of shops) {
  const { status, html, gated, finalUrl } = await getPage(s.source_url);
  await delay();

  if (gated) { gatedCount++; unknown++; continue; }  // 年齢確認ゲート = 判定不能。触らない
  if (status === 404 || status === 410) { gone++; confirmedClosed[s.id] = new Date().toISOString(); continue; }
  if (!html) { unknown++; continue; }

  // 掲載終了の店がエリア一覧へリダイレクトされると、嬢リンクが大量にあり閉店語も無いため
  // 「営業中」と誤判定しうる。最終 URL が要求した店ページのままであることを必ず確認する。
  const norm = (u) => String(u || '').replace(/[?#].*$/, '').replace(/\/$/, '');
  if (finalUrl && norm(finalUrl) !== norm(s.source_url)) {
    redirected++; unknown++;
    continue;
  }

  const closed = CLOSED_WORDS.some((w) => html.includes(w));
  const girls = new Set(html.match(src.girlRe) || []).size;
  if (closed || girls === 0) { gone++; confirmedClosed[s.id] = new Date().toISOString(); continue; }

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
console.log(`  取得できず     : ${unknown}  (触っていない / 年齢確認ゲート ${gatedCount} / 別ページへ転送 ${redirected})`);
if (gatedCount > shops.length * 0.3) {
  console.log('\n  ⚠ 年齢確認ゲートが多すぎて全件は確認できていません。');
  console.log('    cityheaven は連続アクセスでゲートを出すため curl ベースの本スクリプトには限界があります。');
  console.log('    誤閉店の回復は update-all.mjs の店舗巡回 (日曜のフル実行) が本命です。');
  console.log('    updateShopSeen が「エリア一覧で見つけた店」を is_active=1 に戻すため自動で復帰します。');
}
console.log(`  重複で据え置き : ${dup}`);
console.log(`  ${opts.apply ? '復帰させた' : '復帰対象'}     : ${opts.apply ? revived : aliveList.length}`);
if (aliveList.length) {
  console.log('\n  --- 営業中と判定した店 (先頭30件) ---');
  for (const a of aliveList.slice(0, 30)) console.log(`    #${String(a.id).padStart(6)} ${a.name.slice(0, 34).padEnd(36)} 嬢${String(a.girls).padStart(3)}人  最終${a.last}`);
  if (aliveList.length > 30) console.log(`    … 他 ${aliveList.length - 30} 件`);
}
if (opts.apply) saveConfirmed(confirmedClosed);
if (bf) await bf.close();
db.close();
