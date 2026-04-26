#!/usr/bin/env node
/**
 * GSC ページ別流入分析 (curl で事前取得した JSON を解析)
 *
 * 事前に scripts/fetch-gsc-by-page.sh などで以下を取得しておくこと:
 *   logs/gsc-page/page-cur.json       (当期28日, dimensions=page)
 *   logs/gsc-page/page-prev.json      (前期28日, dimensions=page)
 *   logs/gsc-page/page-all.json       (全期間90日, dimensions=page)
 *   logs/gsc-page/page-query-cur.json (当期28日, dimensions=page,query)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'logs/gsc-page');

const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).rows || [];
const curPages = load('page-cur.json');
const prevPages = load('page-prev.json');
const allPages = load('page-all.json');
const curPageQuery = load('page-query-cur.json');

function bucketOfPage(url) {
  let p;
  try { p = new URL(url).pathname; } catch { p = url; }
  p = decodeURIComponent(p);
  if (p === '/' || p === '') return 'top';
  if (p.startsWith('/guide')) return 'guide';
  if (p.startsWith('/area/')) return 'area';
  if (p.startsWith('/shop/')) return 'shop';
  if (p.startsWith('/girl/')) return 'girl';
  if (p.startsWith('/ranking')) return 'ranking';
  if (p.startsWith('/search')) return 'search';
  if (p.startsWith('/contact') || p.startsWith('/privacy') || p.startsWith('/terms') || p.startsWith('/unlock') || p.startsWith('/sitemap')) return 'meta';
  if (p.startsWith('/api') || p.startsWith('/_next') || p.includes('.')) return 'asset';
  return 'prefecture';
}

const BRAND_PATTERNS = ['panemaji', 'パネマジ', 'パネまじ', 'ぱねまじ', 'パネマ時', 'バネマジ'];
const norm = (q) => q.toLowerCase().replace(/\s+/g, '');
const isBrand = (q) => BRAND_PATTERNS.some((p) => norm(q).includes(norm(p)));

function summarize(rows) {
  const c = rows.reduce((s, r) => s + (r.clicks || 0), 0);
  const i = rows.reduce((s, r) => s + (r.impressions || 0), 0);
  const ap = i > 0 ? rows.reduce((s, r) => s + (r.position || 0) * (r.impressions || 0), 0) / i : 0;
  return { rows: rows.length, clicks: c, impressions: i, ctr: i > 0 ? c / i : 0, avgPos: ap };
}

const fmt = (n) => n.toLocaleString();
const pct = (c, p) => (p > 0 ? `${c >= p ? '+' : ''}${(((c - p) / p) * 100).toFixed(1)}%` : c > 0 ? 'NEW' : '0');

const bucketize = (rows) => {
  const by = {};
  for (const r of rows) {
    const url = r.keys[0];
    const b = bucketOfPage(url);
    (by[b] ||= []).push({ url, clicks: r.clicks || 0, impressions: r.impressions || 0, position: r.position || 0, ctr: r.ctr || 0 });
  }
  return by;
};

const curB = bucketize(curPages);
const prevB = bucketize(prevPages);
const allB = bucketize(allPages);
const buckets = ['top', 'prefecture', 'area', 'shop', 'guide', 'girl', 'ranking', 'search', 'meta', 'other', 'asset'];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 ページタイプ別流入  当期28日 (3/27-4/23)  vs  前期28日 (2/27-3/26)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('bucket      | URL  | imp(cur)→(prev)        | clicks(cur)→(prev) | CTR    | avgPos');
console.log('------------|-----:|------------------------|--------------------|-------:|------:');
for (const b of buckets) {
  const c = summarize(curB[b] || []);
  const p = summarize(prevB[b] || []);
  if (c.rows === 0 && p.rows === 0) continue;
  console.log(
    `${b.padEnd(11)} | ${String(c.rows).padStart(4)} | ${String(c.impressions).padStart(7)} ← ${String(p.impressions).padStart(5)} (${pct(c.impressions, p.impressions).padStart(7)}) | ${String(c.clicks).padStart(5)} ← ${String(p.clicks).padStart(4)} (${pct(c.clicks, p.clicks).padStart(7)}) | ${(c.ctr * 100).toFixed(2).padStart(5)}% | ${c.avgPos.toFixed(1).padStart(5)}`,
  );
}
const curTotal = summarize(curPages);
const prevTotal = summarize(prevPages);
console.log(
  `${'TOTAL'.padEnd(11)} | ${String(curTotal.rows).padStart(4)} | ${String(curTotal.impressions).padStart(7)} ← ${String(prevTotal.impressions).padStart(5)} (${pct(curTotal.impressions, prevTotal.impressions).padStart(7)}) | ${String(curTotal.clicks).padStart(5)} ← ${String(prevTotal.clicks).padStart(4)} (${pct(curTotal.clicks, prevTotal.clicks).padStart(7)}) | ${(curTotal.ctr * 100).toFixed(2).padStart(5)}% | ${curTotal.avgPos.toFixed(1).padStart(5)}`,
);

// click シェア
console.log('\n🎯 click シェア (当期28日)');
for (const b of buckets) {
  const c = summarize(curB[b] || []);
  if (c.clicks === 0) continue;
  const share = curTotal.clicks > 0 ? (c.clicks / curTotal.clicks) * 100 : 0;
  console.log(`  ${b.padEnd(11)} : ${share.toFixed(1).padStart(5)}%  (${fmt(c.clicks)} clicks / ${fmt(c.impressions)} imp / CTR ${(c.ctr * 100).toFixed(2)}% / pos ${c.avgPos.toFixed(1)})`);
}

// 90 日全期間 (≒ サイト開設後ほぼ全部)
console.log('\n🎯 click シェア (90日, ≒ 開設以降ほぼ全期間)');
const allTotal = summarize(allPages);
for (const b of buckets) {
  const c = summarize(allB[b] || []);
  if (c.clicks === 0) continue;
  const share = allTotal.clicks > 0 ? (c.clicks / allTotal.clicks) * 100 : 0;
  console.log(`  ${b.padEnd(11)} : ${share.toFixed(1).padStart(5)}%  (${fmt(c.clicks)} clicks / ${fmt(c.impressions)} imp / CTR ${(c.ctr * 100).toFixed(2)}% / pos ${c.avgPos.toFixed(1)})`);
}

// ───────── /guide/* 個別記事分析 ─────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📚 /guide/* 個別記事分析');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const articleDirs = fs.readdirSync(path.join(ROOT, 'src/app/guide'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && d.name !== 'shop')
  .map((d) => d.name);
console.log(`  ローカル記事数: ${articleDirs.length}`);

const guideRows28 = (curB.guide || []);
const guideRows90 = (allB.guide || []);
const slugify = (url) => {
  try {
    const p = decodeURIComponent(new URL(url).pathname);
    const m = p.match(/^\/guide\/([^/]+)/);
    return m ? m[1] : null;
  } catch { return null; }
};
const aggBySlug = (rows) => {
  const m = new Map();
  for (const r of rows) {
    const s = slugify(r.url);
    if (!s || s === 'undefined') continue;
    const cur = m.get(s) || { clicks: 0, impressions: 0, posSum: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.posSum += r.position * r.impressions;
    m.set(s, cur);
  }
  return m;
};

const slug28 = aggBySlug(guideRows28);
const slug90 = aggBySlug(guideRows90);

console.log(`  GSC で 1 imp 以上拾えた記事 (当期28日): ${slug28.size} / ${articleDirs.length} (${(slug28.size / articleDirs.length * 100).toFixed(1)}%)`);
console.log(`  GSC で 1 imp 以上拾えた記事 (90日)    : ${slug90.size} / ${articleDirs.length} (${(slug90.size / articleDirs.length * 100).toFixed(1)}%)`);

// click 上位記事
const list28 = [...slug28.entries()].map(([slug, v]) => ({ slug, ...v, avgPos: v.impressions > 0 ? v.posSum / v.impressions : 0 }));
list28.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
console.log('\n━━━ 記事 click数 Top30 (当期28日) ━━━');
console.log('clicks |   imp |  CTR  | pos  | slug');
for (const a of list28.slice(0, 30)) {
  if (a.clicks === 0 && a.impressions === 0) break;
  const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
  console.log(`${String(a.clicks).padStart(6)} | ${String(a.impressions).padStart(5)} | ${ctr.toFixed(2).padStart(4)}% | ${a.avgPos.toFixed(1).padStart(4)} | ${a.slug}`);
}

const listImp = [...list28].sort((a, b) => b.impressions - a.impressions);
console.log('\n━━━ 記事 imp数 Top30 (当期28日) ━━━');
console.log('clicks |   imp |  CTR  | pos  | slug');
for (const a of listImp.slice(0, 30)) {
  if (a.impressions === 0) break;
  const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
  console.log(`${String(a.clicks).padStart(6)} | ${String(a.impressions).padStart(5)} | ${ctr.toFixed(2).padStart(4)}% | ${a.avgPos.toFixed(1).padStart(4)} | ${a.slug}`);
}

// click 0 だが imp ある記事 (=機会あるが取り逃し or 順位悪い)
const zeroClickWithImp = list28.filter((a) => a.clicks === 0 && a.impressions > 0).sort((a, b) => b.impressions - a.impressions);
console.log(`\n━━━ click=0 だが imp ある記事 Top20 (機会あるが取り逃し) ━━━`);
console.log('  imp | pos  | slug');
for (const a of zeroClickWithImp.slice(0, 20)) {
  console.log(`${String(a.impressions).padStart(5)} | ${a.avgPos.toFixed(1).padStart(4)} | ${a.slug}`);
}

// 90日 imp が 0 の記事
const noHit90 = articleDirs.filter((s) => !slug90.has(s));
console.log(`\n  ⚠️  90日で imp が 0 の記事: ${noHit90.length} / ${articleDirs.length} (${(noHit90.length / articleDirs.length * 100).toFixed(1)}%)`);

// 累積分布: 上位N記事で click の何 % 占めるか
const sortedByClicks = [...list28].sort((a, b) => b.clicks - a.clicks);
const totalGuideClicks = list28.reduce((s, a) => s + a.clicks, 0);
let cum = 0;
const milestones = [10, 20, 50, 100, 200];
console.log('\n━━━ 記事 click の累積分布 (パレート) ━━━');
console.log(`  記事 click 総計: ${totalGuideClicks}`);
for (const N of milestones) {
  const subset = sortedByClicks.slice(0, N);
  const sub = subset.reduce((s, a) => s + a.clicks, 0);
  console.log(`  上位${String(N).padStart(3)}記事: ${String(sub).padStart(4)} clicks (${totalGuideClicks > 0 ? (sub / totalGuideClicks * 100).toFixed(1) : 0}%)`);
}

// ───────── /guide/* に当たっている query 分析 ─────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔎 /guide/* にヒットしている検索クエリ (当期28日)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const guideQueries = curPageQuery.filter((r) => bucketOfPage(r.keys[0]) === 'guide');
const queryAgg = new Map();
for (const r of guideQueries) {
  const q = r.keys[1];
  const cur = queryAgg.get(q) || { clicks: 0, impressions: 0, posSum: 0 };
  cur.clicks += r.clicks || 0;
  cur.impressions += r.impressions || 0;
  cur.posSum += (r.position || 0) * (r.impressions || 0);
  queryAgg.set(q, cur);
}
const qList = [...queryAgg.entries()].map(([q, v]) => ({ q, ...v, avgPos: v.impressions > 0 ? v.posSum / v.impressions : 0, brand: isBrand(q) }));
const guideClicksTotal = qList.reduce((s, q) => s + q.clicks, 0);
const guideImpTotal = qList.reduce((s, q) => s + q.impressions, 0);
const guideClicksByBrand = qList.filter((q) => q.brand).reduce((s, q) => s + q.clicks, 0);
const guideImpByBrand = qList.filter((q) => q.brand).reduce((s, q) => s + q.impressions, 0);
console.log(`  記事ヒット query 総数: ${qList.length} (内 brand: ${qList.filter((q) => q.brand).length})`);
console.log(`  記事 click 内訳: brand=${guideClicksByBrand} (${guideClicksTotal > 0 ? (guideClicksByBrand / guideClicksTotal * 100).toFixed(1) : 0}%) / 非brand=${guideClicksTotal - guideClicksByBrand} (${guideClicksTotal > 0 ? ((guideClicksTotal - guideClicksByBrand) / guideClicksTotal * 100).toFixed(1) : 0}%)`);
console.log(`  記事 imp   内訳: brand=${guideImpByBrand} (${guideImpTotal > 0 ? (guideImpByBrand / guideImpTotal * 100).toFixed(1) : 0}%) / 非brand=${guideImpTotal - guideImpByBrand} (${guideImpTotal > 0 ? ((guideImpTotal - guideImpByBrand) / guideImpTotal * 100).toFixed(1) : 0}%)`);

const qByClicks = [...qList].sort((a, b) => b.clicks - a.clicks);
const qByImp = [...qList].sort((a, b) => b.impressions - a.impressions);

console.log('\n━━━ 記事ヒット 非brand query click Top20 ━━━');
console.log('clicks |   imp |  CTR  | pos  | query');
for (const q of qByClicks.filter((x) => !x.brand).slice(0, 20)) {
  if (q.clicks === 0 && q.impressions === 0) break;
  const ctr = q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0;
  console.log(`${String(q.clicks).padStart(6)} | ${String(q.impressions).padStart(5)} | ${ctr.toFixed(2).padStart(4)}% | ${q.avgPos.toFixed(1).padStart(4)} | "${q.q}"`);
}

console.log('\n━━━ 記事ヒット 非brand query imp Top20 (機会あるが取り逃し) ━━━');
console.log('clicks |   imp |  CTR  | pos  | query');
for (const q of qByImp.filter((x) => !x.brand).slice(0, 20)) {
  if (q.impressions === 0) break;
  const ctr = q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0;
  console.log(`${String(q.clicks).padStart(6)} | ${String(q.impressions).padStart(5)} | ${ctr.toFixed(2).padStart(4)}% | ${q.avgPos.toFixed(1).padStart(4)} | "${q.q}"`);
}

// 記事ページ別 (page 単位での brand vs 非brand 比率)
console.log('\n━━━ 記事ページ別 brand/非brand 内訳 (click数 Top20 記事) ━━━');
const pageMap = new Map();
for (const r of curPageQuery) {
  if (bucketOfPage(r.keys[0]) !== 'guide') continue;
  const slug = slugify(r.keys[0]);
  if (!slug) continue;
  const cur = pageMap.get(slug) || { brandClicks: 0, nbClicks: 0, brandImp: 0, nbImp: 0 };
  if (isBrand(r.keys[1])) {
    cur.brandClicks += r.clicks || 0;
    cur.brandImp += r.impressions || 0;
  } else {
    cur.nbClicks += r.clicks || 0;
    cur.nbImp += r.impressions || 0;
  }
  pageMap.set(slug, cur);
}
const pageRows = [...pageMap.entries()].map(([slug, v]) => ({ slug, ...v, totalClicks: v.brandClicks + v.nbClicks, totalImp: v.brandImp + v.nbImp }));
pageRows.sort((a, b) => b.totalClicks - a.totalClicks);
console.log('total |brand | nb | total imp | brand imp | nb imp | slug');
for (const a of pageRows.slice(0, 20)) {
  console.log(`${String(a.totalClicks).padStart(5)} | ${String(a.brandClicks).padStart(4)} | ${String(a.nbClicks).padStart(3)} | ${String(a.totalImp).padStart(8)} | ${String(a.brandImp).padStart(7)} | ${String(a.nbImp).padStart(5)} | ${a.slug}`);
}

// ───────── 出力 ─────────
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
fs.writeFileSync(path.join(ROOT, 'logs', `gsc-by-page-${stamp}.json`), JSON.stringify({
  generatedAt: new Date().toISOString(),
  buckets: Object.fromEntries(buckets.map((b) => [b, { cur: summarize(curB[b] || []), prev: summarize(prevB[b] || []), all: summarize(allB[b] || []) }])),
  total: { cur: curTotal, prev: prevTotal, all: allTotal },
  guide: {
    articleCount: articleDirs.length,
    hit28: slug28.size,
    hit90: slug90.size,
    top30Click: list28.slice(0, 30),
    top30Imp: listImp.slice(0, 30),
    noHit90,
    zeroClickWithImpTop20: zeroClickWithImp.slice(0, 20),
    queryStats: { total: qList.length, brand: qList.filter((q) => q.brand).length, brandClicks: guideClicksByBrand, brandImp: guideImpByBrand, nbClicks: guideClicksTotal - guideClicksByBrand, nbImp: guideImpTotal - guideImpByBrand },
    topNbQueriesByClick: qByClicks.filter((x) => !x.brand).slice(0, 50),
    topNbQueriesByImp: qByImp.filter((x) => !x.brand).slice(0, 50),
    pagesWithBrandSplit: pageRows.slice(0, 30),
  },
}, null, 2));
console.log(`\n💾 saved: logs/gsc-by-page-${stamp}.json`);
