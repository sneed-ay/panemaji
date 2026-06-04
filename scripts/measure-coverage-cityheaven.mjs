#!/usr/bin/env node
/**
 * 網羅率測定 (cityheaven 分母) — counts-only / read-only
 *
 * 目的:
 *   「世の中の全店舗数」の近似分母として、cityheaven の pref×biz ごとの
 *   掲載総数 (pager_info の id 数) を取得する。DBには一切書き込まない。
 *
 * 仕組み:
 *   cityheaven の pref-level shop-list ページ /{pref}/shop-list/{biz}/ には
 *   <input id="pager_info" name="ids" value="...space区切りページ,カンマ区切りid..."> があり、
 *   その id 総数 = その pref×biz の掲載店舗総数。1リクエストで全数が分かる。
 *
 * 使い方:
 *   node scripts/measure-coverage-cityheaven.mjs                 # 全47都道府県×5業種
 *   node scripts/measure-coverage-cityheaven.mjs --pref tokyo    # 単一pref
 *   出力: /tmp/ch-denom.json  (pref/biz/total)
 *
 * cityheaven biz → パネマジ category 対応:
 *   biz1=ヘルス / biz4=ソープ / biz5=ホテヘル / biz6=デリヘル / biz7=エステ・アロマ
 *   ※ メンズエステ(men's esthe) は cityheaven 非カバー。別ポータルで測定。
 */

import fs from 'fs';

const BASE = 'https://www.cityheaven.net';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 2000;
const DELAY_JITTER = 1200;
const FETCH_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const OUT = '/tmp/ch-denom.json';

const PREFECTURES = [
  'hokkaido','aomori','iwate','miyagi','akita','yamagata','fukushima',
  'ibaraki','tochigi','gunma','saitama','chiba','tokyo','kanagawa',
  'niigata','toyama','ishikawa','fukui','yamanashi','nagano','gifu','shizuoka','aichi',
  'mie','shiga','kyoto','osaka','hyogo','nara','wakayama',
  'tottori','shimane','okayama','hiroshima','yamaguchi',
  'tokushima','kagawa','ehime','kochi',
  'fukuoka','saga','nagasaki','kumamoto','oita','miyazaki','kagoshima','okinawa',
];

const BIZ_MAP = {
  biz1: 'ヘルス',
  biz4: 'ソープ',
  biz5: 'ホテヘル',
  biz6: 'デリヘル',
  biz7: 'エステ・アロマ',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);

async function fetchPage(url) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: 'nenrei=y' }, signal: ac.signal });
      clearTimeout(t);
      if (r.status === 404) return { status: 404, html: '' };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { status: 200, html: await r.text() };
    } catch (e) {
      clearTimeout(t);
      if (i === MAX_RETRIES - 1) return { status: 'ERR:' + (e.name || e.message), html: '' };
      await sleep(2500 * (i + 1));
    }
  }
  return { status: 'ERR', html: '' };
}

// pager_info の id 総数 (space と comma の両方で分割)。要素が無い/空なら 0。
function countPagerIds(html) {
  const m = html.match(/id="pager_info"[^>]*value="([^"]*)"/);
  if (!m) return 0;
  return m[1].split(/[ ,]+/).filter(Boolean).length;
}

// 1ページ目に表示されている実店舗の slug 数 (pager_info が空=非ページネーションの県用フォールバック)
function realShopsOnPage(html, pref) {
  const re = new RegExp(`<a\\s+class="shop_title_shop"[^>]*href="/${pref}/A\\d{4}/A\\d{6}/([^"/]+)/?"`, 'g');
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) seen.add(m[1]);
  return seen.size;
}

// その pref×biz の掲載総数を返す。
// ページネーションありの県は pager_info 総数、無い県(pager空)は page1 の実店舗数。
function countTotal(html, pref) {
  const pager = countPagerIds(html);
  if (pager > 0) return pager;
  return realShopsOnPage(html, pref);
}

async function main() {
  const args = process.argv.slice(2);
  const prefArg = args.find((a, i) => args[i - 1] === '--pref') || null;
  const prefs = prefArg ? [prefArg] : PREFECTURES;
  const bizCodes = Object.keys(BIZ_MAP);

  const results = [];
  let done = 0;
  const total = prefs.length * bizCodes.length;
  console.log(`🔢 cityheaven 分母測定: ${prefs.length}pref × ${bizCodes.length}biz = ${total} req\n`);

  for (const pref of prefs) {
    for (const biz of bizCodes) {
      const url = `${BASE}/${pref}/shop-list/${biz}/?nenrei=y`;
      const { status, html } = await fetchPage(url);
      let cnt = null;
      if (status === 200) cnt = countTotal(html, pref);
      if (status === 404) cnt = 0;
      results.push({ pref, biz, category: BIZ_MAP[biz], total: cnt, status });
      done++;
      console.log(`  [${String(done).padStart(3)}/${total}] ${pref.padEnd(10)} ${biz}(${BIZ_MAP[biz]}) => ${cnt === null ? 'N/A(' + status + ')' : cnt}`);
      fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
      await delay();
    }
  }

  // 集計
  const byBiz = {};
  let grand = 0;
  for (const r of results) {
    if (typeof r.total === 'number') { byBiz[r.category] = (byBiz[r.category] || 0) + r.total; grand += r.total; }
  }
  console.log(`\n=== cityheaven 掲載総数 (分母) ===`);
  for (const [c, n] of Object.entries(byBiz)) console.log(`  ${c.padEnd(10)} ${n.toLocaleString()}`);
  console.log(`  ${'合計'.padEnd(10)} ${grand.toLocaleString()}`);
  console.log(`\n✅ 保存: ${OUT}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
