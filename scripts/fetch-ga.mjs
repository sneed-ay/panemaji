#!/usr/bin/env node
/**
 * Google Analytics 4 (GA4) Data API でサイト流入を取得し、
 * 直近28日 vs その前28日 の比較レポートを出す。
 *
 * 取得指標:
 *   - 全体: sessions, totalUsers, screenPageViews, engagementRate, bounceRate
 *   - チャネル別 (sessionDefaultChannelGroup): Organic Search / Direct / Referral 等
 *   - ランディングページ別 (landingPagePlusQueryString): top 30
 *   - 日次推移: sessions / totalUsers
 *
 * 使い方 (ADCモード・推奨):
 *   1) スコープ追加 (初回のみ):
 *      gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform
 *   2) Property ID 設定 (auto-discovery 失敗する場合のみ):
 *      export GA_PROPERTY=123456789
 *   3) 実行:
 *      node scripts/fetch-ga.mjs
 *
 * 使い方 (SAキーモード):
 *   GA_SA_KEY=/path/to/sa-key.json node scripts/fetch-ga.mjs
 *
 * 任意環境変数:
 *   GA_PROPERTY=123456789  (numeric property ID。未指定時はAdmin APIで自動検出)
 *   GA_DAYS=28             (比較期間の長さ)
 *   GOOGLE_CLOUD_QUOTA_PROJECT=panemaji-gsc-3693  (quota project)
 */
import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const KEY_FILE = process.env.GA_SA_KEY;
const DAYS = Number(process.env.GA_DAYS || 28);
const QUOTA_PROJECT = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || 'panemaji-gsc-3693';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
];

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function fmtPct(n) {
  if (!isFinite(n)) return 'NEW';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function pct(c, p) {
  return p > 0 ? ((c - p) / p) * 100 : c > 0 ? Infinity : 0;
}

function delta(cur, prev) {
  return { cur, prev, delta: cur - prev, pct: pct(cur, prev) };
}

async function buildAuth() {
  const opts = { scopes: SCOPES };
  if (KEY_FILE) {
    opts.keyFile = KEY_FILE.replace(/^~/, process.env.HOME);
    console.log(`  auth: SA key (${opts.keyFile})`);
  } else {
    console.log('  auth: Application Default Credentials');
  }
  const auth = new google.auth.GoogleAuth(opts);
  // quota project: googleapis lib では auth.getClient() 経由で設定可
  const client = await auth.getClient();
  if (client.quotaProjectId !== undefined) {
    client.quotaProjectId = QUOTA_PROJECT;
  }
  return auth;
}

async function discoverProperty(auth) {
  // GA4 Admin API で property ID を自動検出
  const admin = google.analyticsadmin({ version: 'v1beta', auth });
  const res = await admin.accountSummaries.list({});
  const summaries = res.data.accountSummaries || [];
  const props = [];
  for (const acc of summaries) {
    for (const p of acc.propertySummaries || []) {
      // p.property は "properties/123456789" 形式
      const id = p.property?.replace(/^properties\//, '');
      props.push({ accountName: acc.displayName, propName: p.displayName, id });
    }
  }
  return props;
}

async function runReport(analyticsdata, property, body) {
  const res = await analyticsdata.properties.runReport({
    property: `properties/${property}`,
    requestBody: body,
  });
  return res.data;
}

function rowsToObjs(report) {
  const dimNames = (report.dimensionHeaders || []).map((h) => h.name);
  const metNames = (report.metricHeaders || []).map((h) => h.name);
  const out = [];
  for (const row of report.rows || []) {
    const obj = {};
    for (let i = 0; i < dimNames.length; i++) obj[dimNames[i]] = row.dimensionValues[i].value;
    for (let i = 0; i < metNames.length; i++) {
      const v = row.metricValues[i].value;
      // 整数 vs 浮動小数を頑張って判定（GA4 は文字列で返す）
      obj[metNames[i]] = /^[0-9]+$/.test(v) ? Number(v) : Number(v);
    }
    out.push(obj);
  }
  return out;
}

async function fetchOverall(analyticsdata, property, startDate, endDate) {
  const r = await runReport(analyticsdata, property, {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'engagementRate' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
  });
  const row = (r.rows || [])[0];
  if (!row) return { sessions: 0, totalUsers: 0, screenPageViews: 0, engagementRate: 0, bounceRate: 0, averageSessionDuration: 0 };
  return {
    sessions: Number(row.metricValues[0].value),
    totalUsers: Number(row.metricValues[1].value),
    screenPageViews: Number(row.metricValues[2].value),
    engagementRate: Number(row.metricValues[3].value),
    bounceRate: Number(row.metricValues[4].value),
    averageSessionDuration: Number(row.metricValues[5].value),
  };
}

async function fetchByChannel(analyticsdata, property, startDate, endDate) {
  const r = await runReport(analyticsdata, property, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });
  return rowsToObjs(r);
}

async function fetchByLanding(analyticsdata, property, startDate, endDate, limit = 30) {
  const r = await runReport(analyticsdata, property, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  });
  return rowsToObjs(r);
}

async function fetchDaily(analyticsdata, property, startDate, endDate) {
  const r = await runReport(analyticsdata, property, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 100000,
  });
  return rowsToObjs(r).map((r) => ({
    date: r.date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
    sessions: r.sessions,
    totalUsers: r.totalUsers,
    screenPageViews: r.screenPageViews,
  }));
}

function printOverall(label, c, p) {
  console.log(`\n━━━ ${label} ━━━`);
  console.log(`  sessions       : ${c.sessions.toLocaleString()} (${fmtPct(pct(c.sessions, p.sessions))})  [前期: ${p.sessions.toLocaleString()}]`);
  console.log(`  totalUsers     : ${c.totalUsers.toLocaleString()} (${fmtPct(pct(c.totalUsers, p.totalUsers))})  [前期: ${p.totalUsers.toLocaleString()}]`);
  console.log(`  pageViews      : ${c.screenPageViews.toLocaleString()} (${fmtPct(pct(c.screenPageViews, p.screenPageViews))})  [前期: ${p.screenPageViews.toLocaleString()}]`);
  console.log(`  engagementRate : ${(c.engagementRate * 100).toFixed(2)}%  (Δ ${((c.engagementRate - p.engagementRate) * 100).toFixed(2)}pt)`);
  console.log(`  bounceRate     : ${(c.bounceRate * 100).toFixed(2)}%  (Δ ${((c.bounceRate - p.bounceRate) * 100).toFixed(2)}pt)`);
  console.log(`  avgSessionSec  : ${c.averageSessionDuration.toFixed(1)}s  (Δ ${(c.averageSessionDuration - p.averageSessionDuration).toFixed(1)}s)`);
}

function printChannels(curRows, prevRows) {
  console.log(`\n━━━ チャネル別 sessions (sessionDefaultChannelGroup) ━━━`);
  const prevMap = new Map(prevRows.map((r) => [r.sessionDefaultChannelGroup, r]));
  const all = new Map();
  for (const r of curRows) all.set(r.sessionDefaultChannelGroup, { cur: r, prev: prevMap.get(r.sessionDefaultChannelGroup) });
  for (const [k, v] of prevMap) if (!all.has(k)) all.set(k, { cur: null, prev: v });
  const arr = [...all.entries()].map(([ch, { cur, prev }]) => ({
    channel: ch,
    curSessions: cur?.sessions || 0,
    prevSessions: prev?.sessions || 0,
    curUsers: cur?.totalUsers || 0,
    prevUsers: prev?.totalUsers || 0,
  }));
  arr.sort((a, b) => b.curSessions - a.curSessions);
  for (const e of arr) {
    const p = pct(e.curSessions, e.prevSessions);
    console.log(`  ${e.channel.padEnd(22)}  sessions ${e.curSessions.toString().padStart(6)} (${fmtPct(p).padStart(8)})  [前期 ${e.prevSessions.toString().padStart(6)}]   users ${e.curUsers.toLocaleString()}`);
  }
}

function printLanding(curRows, prevRows, n = 15) {
  console.log(`\n━━━ ランディングページ Top${n} (当期 sessions 順) ━━━`);
  const prevMap = new Map(prevRows.map((r) => [r.landingPagePlusQueryString, r]));
  const top = curRows.slice(0, n);
  for (const r of top) {
    const prev = prevMap.get(r.landingPagePlusQueryString);
    const prevSess = prev?.sessions || 0;
    const p = pct(r.sessions, prevSess);
    console.log(`  ${r.sessions.toString().padStart(6)} (${fmtPct(p).padStart(8)})  eng ${(r.engagementRate * 100).toFixed(0).padStart(3)}%  [前期 ${prevSess.toString().padStart(5)}]  ${r.landingPagePlusQueryString}`);
  }

  // 当期に出現しなかった失速ページ Top10
  console.log(`\n━━━ 失速ランディング Top10 (前期→当期 sessions 減少) ━━━`);
  const curMap = new Map(curRows.map((r) => [r.landingPagePlusQueryString, r]));
  const losers = [];
  for (const [page, prev] of prevMap) {
    const cur = curMap.get(page);
    const curSess = cur?.sessions || 0;
    const d = curSess - prev.sessions;
    if (d < 0) losers.push({ page, prev: prev.sessions, cur: curSess, delta: d });
  }
  losers.sort((a, b) => a.delta - b.delta);
  for (const l of losers.slice(0, 10)) {
    console.log(`  ${l.delta.toString().padStart(6)}  ${l.prev.toString().padStart(5)} → ${l.cur.toString().padStart(5)}  ${l.page}`);
  }
}

function printDailyTrend(curDaily) {
  // 7日移動平均 sessions と最終週 vs 直前週の比較
  if (curDaily.length < 14) return;
  const last7 = curDaily.slice(-7);
  const prev7 = curDaily.slice(-14, -7);
  const sum = (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);
  const lastSum = sum(last7, 'sessions');
  const prevSum = sum(prev7, 'sessions');
  console.log(`\n━━━ 直近の勢い (週次) ━━━`);
  console.log(`  最終7日 sessions   : ${lastSum.toLocaleString()}  (${last7[0].date}〜${last7[6].date})`);
  console.log(`  直前7日 sessions   : ${prevSum.toLocaleString()}  (${prev7[0].date}〜${prev7[6].date})`);
  console.log(`  WoW                : ${fmtPct(pct(lastSum, prevSum))}`);

  // 日次のスパークライン
  const max = Math.max(...curDaily.map((r) => r.sessions));
  if (max > 0) {
    const blocks = '▁▂▃▄▅▆▇█';
    const spark = curDaily.map((r) => blocks[Math.min(7, Math.floor((r.sessions / max) * 8))]).join('');
    console.log(`  日次sparkline      : ${spark}  (${curDaily[0].date}〜${curDaily[curDaily.length - 1].date}, max=${max})`);
  }
}

async function main() {
  console.log(`📊 GA4 データ取得  (${DAYS}日 vs 前${DAYS}日)\n`);

  const auth = await buildAuth();

  // Property ID: env > Admin API auto-discover
  let property = process.env.GA_PROPERTY;
  if (!property) {
    console.log('  GA_PROPERTY 未指定 → Admin API で自動検出中...');
    try {
      const props = await discoverProperty(auth);
      if (props.length === 0) {
        console.error('❌ アクセス可能な GA4 property が見つかりませんでした。');
        process.exit(1);
      }
      // panemaji を含むのを優先、無ければ先頭
      const panemaji = props.find((p) => /panemaji/i.test(p.propName) || /panemaji/i.test(p.accountName));
      property = (panemaji || props[0]).id;
      console.log(`  検出: ${(panemaji || props[0]).accountName} / ${(panemaji || props[0]).propName} → property=${property}`);
      if (props.length > 1) {
        console.log(`  (他 ${props.length - 1}件: ${props.filter((p) => p.id !== property).map((p) => `${p.propName}(${p.id})`).join(', ')})`);
      }
    } catch (e) {
      console.error('❌ Property auto-discovery 失敗:', e.message);
      console.error('   GA_PROPERTY=<numeric_id> を指定するか、scope追加して再試行してください:');
      console.error('   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform');
      process.exit(1);
    }
  } else {
    console.log(`  GA_PROPERTY=${property} (env)`);
  }

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });

  // GA4は当日のデータも取れるが、データ完全性のため -1日 まで
  const now = new Date();
  now.setDate(now.getDate() - 1);
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
  console.log(`  前期: ${prevStart} → ${prevEnd}\n`);

  // 6つのレポートを並列で取得
  const [
    curOverall, prevOverall,
    curChannels, prevChannels,
    curLanding, prevLanding,
    curDaily,
  ] = await Promise.all([
    fetchOverall(analyticsdata, property, curStart, curEnd),
    fetchOverall(analyticsdata, property, prevStart, prevEnd),
    fetchByChannel(analyticsdata, property, curStart, curEnd),
    fetchByChannel(analyticsdata, property, prevStart, prevEnd),
    fetchByLanding(analyticsdata, property, curStart, curEnd),
    fetchByLanding(analyticsdata, property, prevStart, prevEnd),
    fetchDaily(analyticsdata, property, curStart, curEnd),
  ]);

  printOverall('全体 (28日サマリ)', curOverall, prevOverall);
  printDailyTrend(curDaily);
  printChannels(curChannels, prevChannels);
  printLanding(curLanding, prevLanding);

  // JSON ダンプ
  const outDir = path.join(ROOT, 'logs');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = ymd(new Date()).replace(/-/g, '');
  const outPath = path.join(outDir, `ga-${stamp}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        property,
        periods: { curStart, curEnd, prevStart, prevEnd },
        overall: {
          cur: curOverall,
          prev: prevOverall,
          delta: {
            sessions: delta(curOverall.sessions, prevOverall.sessions),
            totalUsers: delta(curOverall.totalUsers, prevOverall.totalUsers),
            screenPageViews: delta(curOverall.screenPageViews, prevOverall.screenPageViews),
            engagementRate: delta(curOverall.engagementRate, prevOverall.engagementRate),
            bounceRate: delta(curOverall.bounceRate, prevOverall.bounceRate),
            averageSessionDuration: delta(curOverall.averageSessionDuration, prevOverall.averageSessionDuration),
          },
        },
        channels: { cur: curChannels, prev: prevChannels },
        landing: { cur: curLanding, prev: prevLanding },
        daily: curDaily,
      },
      null,
      2,
    ),
  );
  console.log(`\n💾 saved: ${outPath}`);
}

main().catch((e) => {
  console.error('\n❌ error:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  if (/insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(e.message || '')) {
    console.error('\n💡 ADC scope に analytics.readonly が含まれていません。以下を実行してください:');
    console.error('   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform');
  }
  if (/PERMISSION_DENIED|403/i.test(e.message || '')) {
    console.error('\n💡 GA4 property への閲覧権限が無い可能性があります。GA4 Admin > プロパティのアクセス管理 で確認してください。');
  }
  process.exit(1);
});
