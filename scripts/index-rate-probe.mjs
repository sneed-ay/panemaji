#!/usr/bin/env node
/**
 * 実効インデックス率トラッカー (PDCA 用)
 *
 * GSC Search Analytics で「直近28日に impression>=1 のページ」を type 別に数える。
 * impression があるページ = Google が index して検索結果に出している実証ページ。
 * sitemap-eligible 件数 (DB) と比べて「実効インデックス率」を出す。
 *
 * girl ページ独自文 (2026-05-29 投入) の効果検証 KPI:
 *   girl index 率が 10.3% から上がれば prose 施策が効いている。
 *
 * 認証: ADC (gcloud auth application-default login)。
 *   googleapis ライブラリは quota header を送らず hang するため REST 直叩き。
 *
 * 使い方:
 *   node scripts/index-rate-probe.mjs
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = process.env.GSC_SITE || 'https://panemaji.com/';
const QUOTA_PROJECT = process.env.GSC_QUOTA_PROJECT || 'panemaji-gsc-3693';
const ENDPOINT = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;

const ymd = (d) => d.toISOString().split('T')[0];

function getToken() {
  return execSync('gcloud auth application-default print-access-token', { encoding: 'utf8' }).trim();
}

async function fetchPages(token, startDate, endDate, contains) {
  const out = [];
  let startRow = 0;
  for (;;) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': QUOTA_PROJECT },
      body: JSON.stringify({
        startDate, endDate,
        dimensions: ['page'],
        rowLimit: 25000,
        startRow,
        dataState: 'all',
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: contains }] }],
      }),
    });
    if (!res.ok) throw new Error(`GSC API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const rows = data.rows || [];
    out.push(...rows);
    if (rows.length < 25000) break;
    startRow += 25000;
    if (startRow > 300000) break;
  }
  return out;
}

function eligibleCounts() {
  const db = new Database(path.join(ROOT, 'panemaji.db'), { readonly: true });
  const one = (s) => db.prepare(s).get();
  const SHOP_ELIG = `is_active=1 AND ((SELECT COUNT(*) FROM girls g WHERE g.shop_id=shops.id AND g.is_active=1)>=3 OR EXISTS(SELECT 1 FROM reviews r JOIN girls g ON g.id=r.girl_id WHERE g.shop_id=shops.id))`;
  const girl = one(`SELECT COUNT(*) c FROM girls WHERE is_active=1 AND ((image_url IS NOT NULL AND image_url<>'') OR EXISTS(SELECT 1 FROM reviews r WHERE r.girl_id=girls.id))`).c;
  const shop = one(`SELECT COUNT(*) c FROM shops WHERE ${SHOP_ELIG}`).c;
  const area = one('SELECT COUNT(*) c FROM areas').c;
  db.close();
  return { girl, shop, area };
}

async function main() {
  const token = getToken();
  const now = new Date(); now.setDate(now.getDate() - 3);
  const end = ymd(now);
  const startD = new Date(now); startD.setDate(startD.getDate() - 27);
  const start = ymd(startD);
  console.log(`🔍 実効インデックス率 (impression>=1 ページ): ${start} → ${end} (28d)\n`);

  const elig = eligibleCounts();
  const result = { period: { start, end }, types: {} };

  for (const [type, frag] of [['girl', '/girl/'], ['shop', '/shop/'], ['area', '/area/']]) {
    const rows = await fetchPages(token, start, end, frag);
    let clicks = 0, imp = 0, withClick = 0;
    for (const r of rows) { clicks += r.clicks || 0; imp += r.impressions || 0; if ((r.clicks || 0) > 0) withClick++; }
    const indexed = rows.length;
    const eligible = elig[type] || 0;
    const rate = eligible > 0 ? (indexed / eligible * 100) : 0;
    result.types[type] = { indexed, withClick, eligible, rate: +rate.toFixed(1), impressions: imp, clicks };
    console.log(`[${type}]`);
    console.log(`  indexed (imp>=1) : ${indexed.toLocaleString()} / eligible ${eligible.toLocaleString()} = ${rate.toFixed(1)}%`);
    console.log(`  click>=1 ページ   : ${withClick.toLocaleString()}`);
    console.log(`  impressions      : ${imp.toLocaleString()}   clicks: ${clicks.toLocaleString()}\n`);
  }

  const outDir = path.join(ROOT, 'logs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `index-rate-${end.replace(/-/g, '')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`💾 saved: ${outPath}`);
}

main().catch((e) => { console.error('❌ error:', e?.message || e); process.exit(1); });
