#!/usr/bin/env node
/**
 * GA4 から広告クリックイベント (banner_click) を日次×ad_type で取得
 *
 * 注意: ad_clicks (DB) は本番Render上に書き込まれるが、デプロイ毎に
 *       db-latest で上書きされて履歴が失われる。GA のイベントは
 *       永続するので、こちらが信頼できる時系列ソース。
 *
 * 使い方:
 *   node scripts/fetch-ga-clicks.mjs              # 直近14日
 *   node scripts/fetch-ga-clicks.mjs --days=30
 *
 * 認証: ADC (gcloud auth application-default login --scopes=...)
 *       または GA_SA_KEY=/path/to/sa-key.json
 */
import { google } from 'googleapis';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = process.env.GA_SA_KEY;
const DAYS = parseInt(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || '14');
const QUOTA_PROJECT = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || 'panemaji-gsc-3693';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/cloud-platform',
];

async function getAuth() {
  if (KEY_FILE) {
    return new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  }
  return new google.auth.GoogleAuth({ scopes: SCOPES, projectId: QUOTA_PROJECT });
}

async function main() {
  const auth = await getAuth();
  const client = await auth.getClient();
  client.quotaProjectId = QUOTA_PROJECT;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = google.analyticsdata({ version: 'v1beta', auth: client });

  // Property ID
  let property = process.env.GA_PROPERTY;
  if (!property) {
    const admin = google.analyticsadmin({ version: 'v1beta', auth: client });
    const accounts = await admin.accounts.list();
    for (const a of accounts.data.accounts || []) {
      const props = await admin.properties.list({ filter: `parent:${a.name}` });
      for (const p of props.data.properties || []) {
        if (p.displayName?.includes('panemaji') || p.name?.includes(p.displayName)) {
          property = p.name?.replace('properties/', '');
          break;
        }
      }
      if (property) break;
    }
  }
  if (!property) {
    console.error('GA_PROPERTY 未指定 / 自動検出失敗');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 GA4 広告クリック日次レポート');
  console.log(`   property: ${property} / 直近 ${DAYS}日`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 日次 × ad_type の banner_click count
  const r = await data.properties.runReport({
    property: `properties/${property}`,
    requestBody: {
      dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'eventName' },
        { name: 'customEvent:ad_type' },
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: ['banner_click', 'banner_view', 'banner_impression'] },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
      limit: 5000,
    },
  });

  const rows = r.data.rows || [];
  if (rows.length === 0) {
    console.log('  GA4 にイベントが記録されていません (or scope不足)');
    process.exit(0);
  }

  // Aggregate
  const byDay = {}; // {YYYY-MM-DD: {click_fanza, click_note, click_adstir, view_*, impression_*}}
  const adTypes = new Set();
  for (const row of rows) {
    const date = row.dimensionValues[0].value; // YYYYMMDD
    const event = row.dimensionValues[1].value; // banner_click etc.
    const adType = row.dimensionValues[2].value || '(none)';
    const count = parseInt(row.metricValues[0].value);
    const day = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    const eventShort = event.replace('banner_', ''); // click / view / impression
    const key = `${eventShort}_${adType}`;
    if (!byDay[day]) byDay[day] = {};
    byDay[day][key] = (byDay[day][key] || 0) + count;
    adTypes.add(adType);
  }

  const days = Object.keys(byDay).sort().reverse();
  const types = [...adTypes].sort();

  // ── 共通ヘルパー: 1 metric を 日別表示 ─────────────────────
  function renderDailyTable(metric, label) {
    console.log(`\n📅 日次 banner_${metric} × ad_type\n`);
    const header = ['日付', ...types, '合計'];
    console.log('  ' + header.map((h, i) => i === 0 ? h.padEnd(12) : h.padStart(8)).join(' '));
    console.log('  ' + '─'.repeat(12 + (types.length + 1) * 9));

    const totals = Object.fromEntries(types.map(t => [t, 0]));
    let grand = 0;
    const daysWithData = [];
    for (const day of days) {
      const counts = types.map(t => byDay[day][`${metric}_${t}`] || 0);
      const dayTotal = counts.reduce((a, b) => a + b, 0);
      if (dayTotal === 0) continue;
      counts.forEach((c, i) => totals[types[i]] += c);
      grand += dayTotal;
      daysWithData.push(day);
      console.log(
        '  ' + [day.padEnd(12), ...counts.map(c => String(c).padStart(8)), String(dayTotal).padStart(8)].join(' ')
      );
    }
    console.log('  ' + '─'.repeat(12 + (types.length + 1) * 9));
    console.log(
      '  ' + ['合計'.padEnd(12), ...types.map(t => String(totals[t]).padStart(8)), String(grand).padStart(8)].join(' ')
    );
    // 平均 (データある日数で割る)
    const nDays = daysWithData.length || 1;
    const avgs = types.map(t => (totals[t] / nDays).toFixed(1));
    const avgTotal = (grand / nDays).toFixed(1);
    console.log(
      '  ' + [`平均/日`.padEnd(12), ...avgs.map(a => a.padStart(8)), avgTotal.padStart(8)].join(' ')
    );
    console.log(`  (${nDays} 日分の平均)`);
    return { totals, grand, nDays };
  }

  // ── impression / view / click を 3 表 出力 ────────────────
  const impStats = renderDailyTable('impression', 'インプレッション');
  const viewStats = renderDailyTable('view', 'ビュー');
  const clickStats = renderDailyTable('click', 'クリック');

  // ── CTR (click / view) と CTR (click / impression) ───────
  console.log('\n📈 ad_type 別 集計\n');
  console.log('  ' + ['ad_type'.padEnd(10), 'imp'.padStart(8), 'view'.padStart(8), 'click'.padStart(8), 'CTR(c/v)'.padStart(10), 'CTR(c/i)'.padStart(10)].join(' '));
  console.log('  ' + '─'.repeat(58));
  for (const t of types) {
    let totalClicks = 0, totalViews = 0, totalImps = 0;
    for (const day of days) {
      totalClicks += byDay[day][`click_${t}`] || 0;
      totalViews += byDay[day][`view_${t}`] || 0;
      totalImps += byDay[day][`impression_${t}`] || 0;
    }
    const ctrView = totalViews > 0 ? (totalClicks / totalViews * 100).toFixed(2) + '%' : '—';
    const ctrImp = totalImps > 0 ? (totalClicks / totalImps * 100).toFixed(2) + '%' : '—';
    console.log(
      '  ' + [t.padEnd(10), String(totalImps).padStart(8), String(totalViews).padStart(8), String(totalClicks).padStart(8), ctrView.padStart(10), ctrImp.padStart(10)].join(' ')
    );
  }
  console.log(`\n  ※ view = AdBanner 表示 (banner_view) / impression = 実際にユーザーの画面に出た時 (banner_impression)`);
  console.log(`  ※ CTR(c/v) は配信ベース、 CTR(c/i) は表示ベース (より厳しい)`);
}

main().catch(e => {
  console.error('💀', e.message);
  if (e.message?.includes('PERMISSION_DENIED') || e.message?.includes('SCOPE')) {
    console.error('\n認証スコープ追加 (初回のみ):');
    console.error('  gcloud auth application-default login --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform');
  }
  process.exit(1);
});
