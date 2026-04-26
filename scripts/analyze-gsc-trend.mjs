#!/usr/bin/env node
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BRAND_PATTERNS = ['panemaji', 'パネマジ', 'パネまじ', 'ぱねまじ', 'パネマ時', 'バネマジ'];
const norm = (q) => q.toLowerCase().replace(/\s+/g, '');
const isBrand = (q) => BRAND_PATTERNS.some((p) => norm(q).includes(norm(p)));

const db = new Database(path.join(ROOT, 'panemaji.db'), { readonly: true });
const shops = db.prepare('SELECT DISTINCT name FROM shops WHERE is_active=1').all().map((r) => r.name).filter((n) => n && n.length >= 3);
const areas = db.prepare('SELECT name FROM areas').all().map((r) => r.name).filter((n) => n && n.length >= 2);
db.close();

function bucketOf(q) {
  if (isBrand(q)) return 'brand';
  const n = norm(q);
  for (const s of shops) if (norm(s).length >= 2 && n.includes(norm(s))) return 'shop_name';
  for (const a of areas) if (norm(a).length >= 2 && n.includes(norm(a))) return 'area';
  return 'other';
}

function summarize(rows) {
  const by = { brand: [], shop_name: [], area: [], other: [] };
  for (const r of rows) {
    const q = r.keys[0];
    by[bucketOf(q)].push({ q, c: r.clicks || 0, i: r.impressions || 0, p: r.position || 0 });
  }
  const out = {};
  for (const k of Object.keys(by)) {
    const b = by[k];
    const c = b.reduce((s, e) => s + e.c, 0);
    const i = b.reduce((s, e) => s + e.i, 0);
    const ap = i > 0 ? b.reduce((s, e) => s + e.p * e.i, 0) / i : 0;
    out[k] = { queries: b.length, clicks: c, impressions: i, ctr: i > 0 ? c / i : 0, avgPos: ap, rows: b };
  }
  out.total = {
    queries: rows.length,
    clicks: rows.reduce((s, r) => s + (r.clicks || 0), 0),
    impressions: rows.reduce((s, r) => s + (r.impressions || 0), 0),
  };
  out.total.ctr = out.total.impressions > 0 ? out.total.clicks / out.total.impressions : 0;
  return out;
}

const cur = JSON.parse(fs.readFileSync('/tmp/gsc-tmp/cur14-fresh.json', 'utf8')).rows || [];
const prev = JSON.parse(fs.readFileSync('/tmp/gsc-tmp/prev14-fresh.json', 'utf8')).rows || [];
const daily = JSON.parse(fs.readFileSync('/tmp/gsc-tmp/daily-total-fresh.json', 'utf8')).rows || [];
const CUR_LABEL = '当期(4/12-4/25)';
const PREV_LABEL = '前期(3/29-4/11)';

const cs = summarize(cur);
const ps = summarize(prev);

const fmt = (n) => n.toLocaleString();
const pct = (c, p) => (p > 0 ? `${c >= p ? '+' : ''}${(((c - p) / p) * 100).toFixed(1)}%` : 'NEW');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 GSC 14日比較  ${CUR_LABEL} vs ${PREV_LABEL}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('バケット      | クエリ数             | imp                  | clicks               | CTR     | 平均順位');
console.log('--------------|----------------------|----------------------|----------------------|---------|----------');
for (const k of ['brand', 'shop_name', 'area', 'other']) {
  const c = cs[k], p = ps[k];
  console.log(
    `${k.padEnd(13)} | ${String(c.queries).padStart(5)} (${pct(c.queries, p.queries).padStart(7)}) | ${String(c.impressions).padStart(6)} (${pct(c.impressions, p.impressions).padStart(7)}) | ${String(c.clicks).padStart(6)} (${pct(c.clicks, p.clicks).padStart(7)}) | ${(c.ctr * 100).toFixed(1).padStart(5)}% | ${c.avgPos.toFixed(1).padStart(5)} (${(c.avgPos - p.avgPos >= 0 ? '+' : '')}${(c.avgPos - p.avgPos).toFixed(1)})`
  );
}
console.log(`${'TOTAL'.padEnd(13)} | ${String(cs.total.queries).padStart(5)} (${pct(cs.total.queries, ps.total.queries).padStart(7)}) | ${String(cs.total.impressions).padStart(6)} (${pct(cs.total.impressions, ps.total.impressions).padStart(7)}) | ${String(cs.total.clicks).padStart(6)} (${pct(cs.total.clicks, ps.total.clicks).padStart(7)}) | ${(cs.total.ctr * 100).toFixed(1).padStart(5)}% |`);

// 非ブランドclickシェア
const nbCur = cs.shop_name.clicks + cs.area.clicks + cs.other.clicks;
const nbPrev = ps.shop_name.clicks + ps.area.clicks + ps.other.clicks;
const nbCurShare = cs.total.clicks > 0 ? (nbCur / cs.total.clicks) * 100 : 0;
const nbPrevShare = ps.total.clicks > 0 ? (nbPrev / ps.total.clicks) * 100 : 0;
console.log(`\n🎯 非ブランドclickシェア: ${nbPrevShare.toFixed(1)}% → ${nbCurShare.toFixed(1)}%  (Δ${(nbCurShare - nbPrevShare >= 0 ? '+' : '')}${(nbCurShare - nbPrevShare).toFixed(1)}pt)`);
console.log(`   非ブランドclick数 : ${fmt(nbPrev)} → ${fmt(nbCur)}  (${pct(nbCur, nbPrev)})`);
console.log(`   非ブランドimp数  : ${fmt(ps.shop_name.impressions + ps.area.impressions + ps.other.impressions)} → ${fmt(cs.shop_name.impressions + cs.area.impressions + cs.other.impressions)}  (${pct(cs.shop_name.impressions + cs.area.impressions + cs.other.impressions, ps.shop_name.impressions + ps.area.impressions + ps.other.impressions)})`);

// 日次推移
console.log('\n━━━ 日次推移 (最新14日) ━━━');
console.log('date       | imp     | clicks  | CTR    | pos');
const last14 = daily.slice(-14);
for (const r of last14) {
  console.log(`${r.keys[0]} | ${String(r.impressions).padStart(7)} | ${String(r.clicks).padStart(7)} | ${(r.ctr * 100).toFixed(1).padStart(5)}% | ${r.position.toFixed(1)}`);
}

// 前期比較対象 (前14日)
const prev14 = daily.slice(-28, -14);
const sumImp = (arr) => arr.reduce((s, r) => s + r.impressions, 0);
const sumCli = (arr) => arr.reduce((s, r) => s + r.clicks, 0);
console.log(`\n📈 14日合計   imp ${fmt(sumImp(prev14))} → ${fmt(sumImp(last14))}  (${pct(sumImp(last14), sumImp(prev14))})`);
console.log(`📈 14日合計 click ${fmt(sumCli(prev14))} → ${fmt(sumCli(last14))}  (${pct(sumCli(last14), sumCli(prev14))})`);

// 非ブランド top 急上昇クエリ (当期imp - 前期imp の delta が大きい順)
const prevMap = new Map(prev.map((r) => [r.keys[0], r]));
const movers = [];
for (const r of cur) {
  const q = r.keys[0];
  if (isBrand(q)) continue;
  const p = prevMap.get(q);
  movers.push({ q, bucket: bucketOf(q), curImp: r.impressions, prevImp: p?.impressions || 0, delta: r.impressions - (p?.impressions || 0), curClicks: r.clicks, curPos: r.position });
}
movers.sort((a, b) => b.delta - a.delta);
console.log('\n━━━ 非ブランド 急上昇 Top20 (imp 増分) ━━━');
console.log('delta | bucket    | imp(prev→cur)        | clicks | pos  | query');
for (const m of movers.slice(0, 20)) {
  if (m.delta <= 0) break;
  console.log(`+${String(m.delta).padStart(5)} | ${m.bucket.padEnd(9)} | ${String(m.prevImp).padStart(5)} → ${String(m.curImp).padStart(5).padEnd(8)} | ${String(m.curClicks).padStart(5)} | ${m.curPos.toFixed(1).padStart(5)} | "${m.q}"`);
}

// 非ブランドのclick発生クエリ Top20 (当期実click)
const clickRanked = cur.filter((r) => !isBrand(r.keys[0]) && r.clicks > 0).map((r) => ({ q: r.keys[0], bucket: bucketOf(r.keys[0]), c: r.clicks, i: r.impressions, p: r.position }));
clickRanked.sort((a, b) => b.c - a.c);
console.log('\n━━━ 非ブランド click数Top20 (当期14日) ━━━');
console.log('clicks | bucket    | imp    | pos  | query');
for (const m of clickRanked.slice(0, 20)) {
  console.log(`${String(m.c).padStart(6)} | ${m.bucket.padEnd(9)} | ${String(m.i).padStart(6)} | ${m.p.toFixed(1).padStart(5)} | "${m.q}"`);
}
