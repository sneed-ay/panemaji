#!/usr/bin/env node
/**
 * GSC ブランド vs 非ブランド の日次/週次トレンド
 *
 * brand(「パネマジ」「panemaji」を含むクエリ) と 非ブランドのクリック/表示を
 * 日次取得し、週(月曜起点)に集計して推移を出す。ブランド需要の減少時期の特定用。
 *
 *   gcloud auth application-default login 済みであること
 *   node scripts/gsc-brand-daily.mjs           # デフォルト 2026-03-15〜直近
 *   GSC_START=2026-03-01 GSC_END=2026-06-02 node scripts/gsc-brand-daily.mjs
 */
import { execSync } from 'node:child_process';

const SITE = process.env.GSC_SITE || 'https://panemaji.com/';
const QUOTA = process.env.GSC_QUOTA_PROJECT || 'panemaji-gsc-3693';
const START = process.env.GSC_START || '2026-03-15';
const END = process.env.GSC_END || '2026-06-02';
const ENDPOINT = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;

const token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8' }).trim();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': QUOTA };

async function q(body) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`GSC ${r.status}: ${await r.text()}`);
  return (await r.json()).rows || [];
}

const base = { startDate: START, endDate: END, dimensions: ['date'], rowLimit: 1000 };
const total = await q(base);
// brand は date×query で取得し、クライアント側で表記ゆれ判定して日次集計。
// (GSC の dimensionFilterGroups は group間が AND のため、OR 的な表記ゆれ取得には不向き)
const brandRows = await q({ startDate: START, endDate: END, dimensions: ['date', 'query'], rowLimit: 25000 });
const isBrand = (s) => {
  const t = (s || '').toLowerCase().replace(/\s/g, '');
  return t.includes('panemaji') || t.includes('パネマジ') || t.includes('ぱねまじ') || t.includes('パネまじ');
};
const bMap = new Map();
for (const r of brandRows) {
  if (!isBrand(r.keys[1])) continue;
  const date = r.keys[0];
  const e = bMap.get(date) || { clicks: 0, impressions: 0 };
  e.clicks += r.clicks;
  e.impressions += r.impressions;
  bMap.set(date, e);
}
const weeks = new Map();
for (const r of total) {
  const date = r.keys[0];
  const b = bMap.get(date) || { clicks: 0, impressions: 0 };
  const d = new Date(date + 'T00:00:00Z');
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const wk = monday.toISOString().slice(0, 10);
  if (!weeks.has(wk)) weeks.set(wk, { tc: 0, ti: 0, bc: 0, bi: 0 });
  const w = weeks.get(wk);
  w.tc += r.clicks; w.ti += r.impressions; w.bc += b.clicks; w.bi += b.impressions;
}

console.log(`\nGSC ブランド需要トレンド  ${START} 〜 ${END}  (${SITE})\n`);
console.log('週(月曜)     │ brandClk  nonBrClk │  brandImp  nonBrImp │ brand%(clk)');
console.log('─'.repeat(72));
for (const [wk, w] of [...weeks].sort()) {
  const nbc = Math.round(w.tc - w.bc), nbi = Math.round(w.ti - w.bi);
  const bShare = w.tc > 0 ? ((w.bc / w.tc) * 100).toFixed(0) : '0';
  console.log(
    `${wk} │ ${String(Math.round(w.bc)).padStart(7)}  ${String(nbc).padStart(7)} │ ${String(Math.round(w.bi)).padStart(8)}  ${String(nbi).padStart(8)} │ ${String(bShare).padStart(3)}%`,
  );
}
console.log('');
