#!/usr/bin/env node
/**
 * GSC 非ブランド検索の日次推移分析
 *
 * 直近28日 (GSC遅延3日を見込んで end = today-3) について:
 *   - 日次の全体 imp/clicks/CTR/pos
 *   - 日次のブランド imp/clicks/pos
 *   - 差分 = 非ブランド の日次推移
 *   - 7日移動平均
 *   - 週次サマリ (W1 → W4)
 *   - 新規流入 非ブランドクエリ Top10 (W4 にだけ立ったもの)
 *
 * 認証: ADC (gcloud auth application-default login)
 *
 * 使い方:
 *   node scripts/analyze-gsc-nonbrand-daily.mjs
 */
import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://panemaji.com/';
const DAYS = 28;

// fetch-gsc.mjs の isBrand と同じパターン
const BRAND_REGEX = '(?i)(panemaji|パネマジ|パネまじ|ぱねまじ|パネマ時|バネマジ)';

function ymd(d) { return d.toISOString().slice(0, 10); }

async function fetchAll(sc, body) {
  const all = [];
  let startRow = 0;
  while (true) {
    const r = await sc.searchanalytics.query({
      siteUrl: SITE,
      requestBody: { ...body, startRow, rowLimit: 25000 },
    });
    const rows = r.data.rows || [];
    all.push(...rows);
    if (rows.length < 25000) break;
    startRow += 25000;
  }
  return all;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const sc = google.searchconsole({ version: 'v1', auth });

  const end = new Date(); end.setDate(end.getDate() - 3);
  const start = new Date(end); start.setDate(start.getDate() - (DAYS - 1));
  const startD = ymd(start), endD = ymd(end);
  console.log(`📅 期間: ${startD} → ${endD} (${DAYS}日, GSC遅延3日込み)\n`);

  // 1) 日次全体
  const totalRows = await fetchAll(sc, {
    startDate: startD, endDate: endD,
    dimensions: ['date'], dataState: 'all',
  });
  // 2) 日次ブランドのみ
  const brandRows = await fetchAll(sc, {
    startDate: startD, endDate: endD,
    dimensions: ['date'], dataState: 'all',
    dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'includingRegex', expression: BRAND_REGEX }] }],
  });
  // 3) 全体 by query (W3 vs W4 の新規クエリ抽出用) - 直近14日
  const w3w4Start = new Date(end); w3w4Start.setDate(w3w4Start.getDate() - 13);
  const queryRows = await fetchAll(sc, {
    startDate: ymd(w3w4Start), endDate: endD,
    dimensions: ['date', 'query'], dataState: 'all',
  });

  console.log(`  fetched: total=${totalRows.length}d, brand=${brandRows.length}d, query×date=${queryRows.length}\n`);

  // === 日次表 ===
  const bMap = new Map(brandRows.map((r) => [r.keys[0], r]));
  const rows = [];
  for (const t of totalRows) {
    const date = t.keys[0];
    const b = bMap.get(date) || { impressions: 0, clicks: 0, position: 0 };
    const nbImp = t.impressions - b.impressions;
    const nbClicks = t.clicks - b.clicks;
    const nbPos = nbImp > 0 ? (t.position * t.impressions - b.position * b.impressions) / nbImp : 0;
    const ctr = nbImp > 0 ? (nbClicks / nbImp) * 100 : 0;
    rows.push({ date, nbImp, nbClicks, nbPos, ctr, t, b });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 非ブランド検索 日次推移 (= 全体 − ブランド)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('date       |  nb_imp | nb_clk |  CTR  | nb_pos | (全体 imp/clk/pos | brand imp/clk/pos)');
  console.log('-----------|--------:|-------:|------:|-------:|-----------------------------------------');
  for (const r of rows) {
    console.log(
      `${r.date} | ${String(r.nbImp).padStart(7)} | ${String(r.nbClicks).padStart(6)} | ${r.ctr.toFixed(2).padStart(4)}% | ${r.nbPos.toFixed(1).padStart(6)} | ${String(r.t.impressions).padStart(6)}/${String(r.t.clicks).padStart(4)}/${r.t.position.toFixed(1).padStart(4)} | ${String(r.b.impressions).padStart(5)}/${String(r.b.clicks).padStart(3)}/${r.b.position.toFixed(1).padStart(4)}`
    );
  }

  // 7日移動平均
  console.log('\n━━━ 非ブランド 7日移動平均 ━━━');
  console.log('endDate    | imp_ma7 | clk_ma7 | pos_ma7');
  for (let i = 6; i < rows.length; i++) {
    const w = rows.slice(i - 6, i + 1);
    const ai = w.reduce((s, r) => s + r.nbImp, 0) / 7;
    const ac = w.reduce((s, r) => s + r.nbClicks, 0) / 7;
    const totI = w.reduce((s, r) => s + r.nbImp, 0);
    const ap = totI > 0 ? w.reduce((s, r) => s + r.nbPos * r.nbImp, 0) / totI : 0;
    console.log(`${rows[i].date} | ${ai.toFixed(0).padStart(7)} | ${ac.toFixed(0).padStart(7)} | ${ap.toFixed(2).padStart(7)}`);
  }

  // 週次サマリ
  const sum = (arr, k) => arr.reduce((s, r) => s + r[k], 0);
  const wPos = (arr) => { const i = sum(arr, 'nbImp'); return i > 0 ? arr.reduce((s, r) => s + r.nbPos * r.nbImp, 0) / i : 0; };
  const weeks = [];
  for (let i = 0; i < rows.length; i += 7) weeks.push(rows.slice(i, i + 7));
  console.log('\n━━━ 週次サマリ (非ブランド) ━━━');
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    if (!w.length) continue;
    const imp = sum(w, 'nbImp'), clk = sum(w, 'nbClicks');
    const ctr = imp > 0 ? (clk / imp) * 100 : 0;
    console.log(`W${i + 1} ${w[0].date}〜${w[w.length - 1].date} (${w.length}日) | imp ${String(imp).padStart(6)} | clk ${String(clk).padStart(4)} | CTR ${ctr.toFixed(2)}% | pos ${wPos(w).toFixed(2)}`);
  }

  // === 新規流入 非ブランドクエリ Top10 (W3 → W4) ===
  // queryRows: 直近14日の date×query データ
  const isBrand = (q) => new RegExp('panemaji|パネマジ|パネまじ|ぱねまじ|パネマ時|バネマジ', 'i').test(q.replace(/\s+/g, ''));
  const splitDate = ymd(new Date(end.getTime() - 7 * 86400000)); // W3 end
  const w3 = new Map(); // query -> {imp,clk,pos}
  const w4 = new Map();
  for (const r of queryRows) {
    const date = r.keys[0], q = r.keys[1];
    if (isBrand(q)) continue;
    const map = date <= splitDate ? w3 : w4;
    const cur = map.get(q) || { imp: 0, clk: 0, posSum: 0 };
    cur.imp += r.impressions;
    cur.clk += r.clicks;
    cur.posSum += r.position * r.impressions;
    map.set(q, cur);
  }
  const movers = [];
  for (const [q, c] of w4) {
    const p = w3.get(q) || { imp: 0, clk: 0 };
    movers.push({ q, w3Imp: p.imp, w4Imp: c.imp, delta: c.imp - p.imp, w4Clk: c.clk, w4Pos: c.imp > 0 ? c.posSum / c.imp : 0 });
  }
  movers.sort((a, b) => b.delta - a.delta);
  const w4Days = rows.filter(r => r.date > splitDate).length;
  const w3Days = rows.filter(r => r.date <= splitDate && r.date >= ymd(new Date(end.getTime() - 13 * 86400000))).length;
  console.log(`\n━━━ 新規/伸長 非ブランドクエリ Top15 (W3 ${w3Days}日 → W4 ${w4Days}日, imp増分順) ━━━`);
  for (const m of movers.slice(0, 15)) {
    if (m.delta <= 0) break;
    console.log(`  +${String(m.delta).padStart(4)} imp  ${String(m.w3Imp).padStart(4)} → ${String(m.w4Imp).padStart(4)}  clk ${String(m.w4Clk).padStart(2)}  pos ${m.w4Pos.toFixed(1).padStart(4)}  "${m.q}"`);
  }

  // === 失速クエリ Top10 ===
  movers.sort((a, b) => a.delta - b.delta);
  console.log(`\n━━━ 失速 非ブランドクエリ Top10 (imp減分順) ━━━`);
  for (const m of movers.slice(0, 10)) {
    if (m.delta >= 0) break;
    console.log(`  ${String(m.delta).padStart(5)} imp  ${String(m.w3Imp).padStart(4)} → ${String(m.w4Imp).padStart(4)}  clk ${String(m.w4Clk).padStart(2)}  pos ${m.w4Pos.toFixed(1).padStart(4)}  "${m.q}"`);
  }

  // 保存
  const outDir = path.join(ROOT, 'logs');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = ymd(new Date()).replace(/-/g, '');
  const out = path.join(outDir, `gsc-nonbrand-daily-${stamp}.json`);
  fs.writeFileSync(out, JSON.stringify({ site: SITE, period: { start: startD, end: endD }, daily: rows, weekly: weeks.map((w, i) => ({ idx: i + 1, start: w[0]?.date, end: w[w.length - 1]?.date, imp: sum(w, 'nbImp'), clk: sum(w, 'nbClicks'), pos: wPos(w) })), topMovers: movers.slice(0, 30) }, null, 2));
  console.log(`\n💾 saved: ${out}`);
}

main().catch((e) => { console.error('❌', e.message); if (e.errors) console.error(JSON.stringify(e.errors, null, 2)); process.exit(1); });
