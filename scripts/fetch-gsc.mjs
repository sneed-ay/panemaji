#!/usr/bin/env node
/**
 * Google Search Console データ取得 & バケット分析
 *
 * 直近28日 vs その前28日 を比較し、以下にバケット分けしてサマリを出す:
 *   - brand:     パネマジ系指名クエリ
 *   - shop_name: DB の shops.name にヒットする店名クエリ
 *   - area:      DB の areas.name にヒットするエリア系クエリ
 *   - other:     その他
 *
 * 使い方 (ADCモード・推奨):
 *   事前に一度だけ: gcloud auth application-default login
 *   node scripts/fetch-gsc.mjs
 *
 * 使い方 (SAキーモード):
 *   GSC_SA_KEY=/path/to/sa-key.json node scripts/fetch-gsc.mjs
 *
 * 任意環境変数:
 *   GSC_SITE=https://panemaji.com/  (デフォルト)
 *   GSC_DAYS=28                     (比較期間の長さ)
 */
import { google } from 'googleapis';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SITE_URL = process.env.GSC_SITE || 'https://panemaji.com/';
const KEY_FILE = process.env.GSC_SA_KEY;
const DAYS = Number(process.env.GSC_DAYS || 28);

// ブランド指名（部分一致・大小無視・空白無視で判定）
const BRAND_PATTERNS = [
  'panemaji',
  'パネマジ',
  'パネまじ',
  'ぱねまじ',
  'パネマ時',
  'バネマジ',
];

function normalizeQuery(q) {
  return q.toLowerCase().replace(/\s+/g, '');
}

function isBrand(query) {
  const n = normalizeQuery(query);
  return BRAND_PATTERNS.some((p) => n.includes(normalizeQuery(p)));
}

// DB から店名・エリア名ロード
function loadDbTerms() {
  const db = new Database(path.join(ROOT, 'panemaji.db'), { readonly: true });
  // shops: 3文字以上（短い店名は汎用語と衝突しやすいため）
  const shops = db
    .prepare('SELECT DISTINCT name FROM shops WHERE is_active=1')
    .all()
    .map((r) => r.name)
    .filter((n) => n && n.length >= 3);
  // areas: DBに151件しか無い整備済みデータなので2文字でもOK
  const areas = db
    .prepare('SELECT name FROM areas')
    .all()
    .map((r) => r.name)
    .filter((n) => n && n.length >= 2);
  db.close();
  return { shops, areas };
}

function matchTerms(query, terms) {
  const n = normalizeQuery(query);
  for (const t of terms) {
    const nt = normalizeQuery(t);
    if (nt.length >= 2 && n.includes(nt)) return t;
  }
  return null;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchQueries(searchconsole, startDate, endDate) {
  // GSC API: 1リクエスト max 25000 rows。クエリだけ欲しいので十分
  const res = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 25000,
      dataState: 'all',
    },
  });
  return res.data.rows || [];
}

function bucketize(rows, shopTerms, areaTerms) {
  const buckets = {
    brand: [],
    shop_name: [],
    area: [],
    other: [],
  };
  for (const row of rows) {
    const q = row.keys[0];
    const entry = {
      query: q,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };
    if (isBrand(q)) {
      buckets.brand.push(entry);
      continue;
    }
    const shopHit = matchTerms(q, shopTerms);
    if (shopHit) {
      entry.matched = shopHit;
      buckets.shop_name.push(entry);
      continue;
    }
    const areaHit = matchTerms(q, areaTerms);
    if (areaHit) {
      entry.matched = areaHit;
      buckets.area.push(entry);
      continue;
    }
    buckets.other.push(entry);
  }
  return buckets;
}

function summarize(bucket) {
  const clicks = bucket.reduce((s, e) => s + e.clicks, 0);
  const impressions = bucket.reduce((s, e) => s + e.impressions, 0);
  const avgPos =
    impressions > 0
      ? bucket.reduce((s, e) => s + e.position * e.impressions, 0) / impressions
      : 0;
  return {
    queries: bucket.length,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    avgPosition: avgPos,
  };
}

function diff(cur, prev) {
  const pct = (c, p) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? Infinity : 0);
  return {
    queries: { cur: cur.queries, prev: prev.queries, delta: cur.queries - prev.queries, pct: pct(cur.queries, prev.queries) },
    clicks: { cur: cur.clicks, prev: prev.clicks, delta: cur.clicks - prev.clicks, pct: pct(cur.clicks, prev.clicks) },
    impressions: { cur: cur.impressions, prev: prev.impressions, delta: cur.impressions - prev.impressions, pct: pct(cur.impressions, prev.impressions) },
    avgPosition: { cur: cur.avgPosition, prev: prev.avgPosition, delta: cur.avgPosition - prev.avgPosition },
    ctr: { cur: cur.ctr, prev: prev.ctr, delta: cur.ctr - prev.ctr },
  };
}

function fmtPct(n) {
  if (!isFinite(n)) return 'NEW';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function printReport(label, d) {
  console.log(`\n━━━ ${label} ━━━`);
  console.log(`  ユニーククエリ : ${d.queries.cur.toLocaleString()} (${fmtPct(d.queries.pct)})  [前期: ${d.queries.prev.toLocaleString()}]`);
  console.log(`  表示回数       : ${d.impressions.cur.toLocaleString()} (${fmtPct(d.impressions.pct)})  [前期: ${d.impressions.prev.toLocaleString()}]`);
  console.log(`  クリック       : ${d.clicks.cur.toLocaleString()} (${fmtPct(d.clicks.pct)})  [前期: ${d.clicks.prev.toLocaleString()}]`);
  console.log(`  CTR            : ${(d.ctr.cur * 100).toFixed(2)}%  (Δ ${(d.ctr.delta * 100).toFixed(2)}pt)`);
  console.log(`  平均順位       : ${d.avgPosition.cur.toFixed(1)}  (Δ ${d.avgPosition.delta >= 0 ? '+' : ''}${d.avgPosition.delta.toFixed(1)})`);
}

function topMovers(curRows, prevRows, n = 10) {
  // query 単位で impressions の増減を集計
  const prevMap = new Map(prevRows.map((r) => [r.query, r]));
  const all = new Map();
  for (const r of curRows) all.set(r.query, { cur: r, prev: prevMap.get(r.query) });
  for (const [q, p] of prevMap) if (!all.has(q)) all.set(q, { cur: null, prev: p });

  const diffs = [];
  for (const [q, { cur, prev }] of all) {
    const curImp = cur?.impressions || 0;
    const prevImp = prev?.impressions || 0;
    diffs.push({
      query: q,
      curImp,
      prevImp,
      delta: curImp - prevImp,
      curClicks: cur?.clicks || 0,
      curPos: cur?.position || 0,
    });
  }
  diffs.sort((a, b) => b.delta - a.delta);
  return { top: diffs.slice(0, n), bottom: diffs.slice(-n).reverse() };
}

function printMovers(label, movers) {
  console.log(`\n  【${label} 伸び Top10 (imp 増分)】`);
  for (const m of movers.top) {
    if (m.delta <= 0) break;
    console.log(`    +${m.delta.toString().padStart(5)}  imp ${m.prevImp} → ${m.curImp}  clicks ${m.curClicks}  pos ${m.curPos.toFixed(1)}  "${m.query}"`);
  }
  console.log(`\n  【${label} 失速 Top10 (imp 減分)】`);
  for (const m of movers.bottom) {
    if (m.delta >= 0) break;
    console.log(`    ${m.delta.toString().padStart(6)}  imp ${m.prevImp} → ${m.curImp}  clicks ${m.curClicks}  pos ${m.curPos.toFixed(1)}  "${m.query}"`);
  }
}

async function main() {
  console.log(`🔍 GSC データ取得: ${SITE_URL}  (${DAYS}日 vs 前${DAYS}日)\n`);

  const authOpts = {
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  };
  if (KEY_FILE) {
    authOpts.keyFile = KEY_FILE.replace(/^~/, process.env.HOME);
    console.log(`  auth: SA key (${authOpts.keyFile})`);
  } else {
    console.log('  auth: Application Default Credentials');
  }
  const auth = new google.auth.GoogleAuth(authOpts);
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const now = new Date();
  now.setDate(now.getDate() - 3); // GSC データは約2-3日遅延
  const curEnd = ymd(now);
  const curStartD = new Date(now);
  curStartD.setDate(curStartD.getDate() - (DAYS - 1));
  const curStart = ymd(curStartD);

  const prevEndD = new Date(curStartD);
  prevEndD.setDate(prevEndD.getDate() - 1);
  const prevEnd = ymd(prevEndD);
  const prevStartD = new Date(prevEndD);
  prevStartD.setDate(prevStartD.getDate() - (DAYS - 1));
  const prevStart = ymd(prevStartD);

  console.log(`  当期: ${curStart} → ${curEnd}`);
  console.log(`  前期: ${prevStart} → ${prevEnd}`);

  const { shops, areas } = loadDbTerms();
  console.log(`  DB: shops=${shops.length}, areas=${areas.length}\n`);

  const [curRows, prevRows] = await Promise.all([
    fetchQueries(searchconsole, curStart, curEnd),
    fetchQueries(searchconsole, prevStart, prevEnd),
  ]);
  console.log(`  取得: 当期 ${curRows.length} queries, 前期 ${prevRows.length} queries`);

  const curBuckets = bucketize(curRows, shops, areas);
  const prevBuckets = bucketize(prevRows, shops, areas);

  const bucketNames = ['brand', 'shop_name', 'area', 'other'];
  const report = {};
  for (const b of bucketNames) {
    report[b] = diff(summarize(curBuckets[b]), summarize(prevBuckets[b]));
  }

  // 全体
  const totalCur = summarize(curRows.map((r) => ({ clicks: r.clicks, impressions: r.impressions, position: r.position })));
  const totalPrev = summarize(prevRows.map((r) => ({ clicks: r.clicks, impressions: r.impressions, position: r.position })));
  report.total = diff(totalCur, totalPrev);

  printReport('全体', report.total);
  printReport('brand (ブランド指名)', report.brand);
  printReport('shop_name (店名クエリ) ← ここが伸びてるか見たい', report.shop_name);
  printReport('area (エリア系クエリ)', report.area);
  printReport('other (その他)', report.other);

  // shop_name の movers 詳細
  printMovers('shop_name', topMovers(curBuckets.shop_name, prevBuckets.shop_name));
  printMovers('area', topMovers(curBuckets.area, prevBuckets.area));

  // JSON ダンプ
  const outDir = path.join(ROOT, 'logs');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = ymd(new Date()).replace(/-/g, '');
  const outPath = path.join(outDir, `gsc-${stamp}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        site: SITE_URL,
        periods: { curStart, curEnd, prevStart, prevEnd },
        summary: report,
        buckets: {
          cur: curBuckets,
          prev: prevBuckets,
        },
      },
      null,
      2,
    ),
  );
  console.log(`\n💾 saved: ${outPath}`);
}

main().catch((e) => {
  console.error('❌ error:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
