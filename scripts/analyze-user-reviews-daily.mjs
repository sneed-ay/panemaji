#!/usr/bin/env node
/**
 * 口コミDB の UUID 系ユーザー投稿の日次推移分析 (Bot 検出機能付き)
 *
 * 真実値: https://panemaji.com/api/review-stats?_=ts の `user` 区分
 *
 * 出力:
 *   - 直近30日の日次表 (件数 + ユニーク browser_id 数 + 1人あたり投稿数)
 *   - 直近7日 vs その前7日 の合計比較
 *   - 直近7日のヘビー投稿者 Top10 (Bot 疑い)
 *   - 全体サマリ (total / user / ext / x-import)
 *
 * 使い方:
 *   node scripts/analyze-user-reviews-daily.mjs
 */

const ENDPOINT = `https://panemaji.com/api/review-stats?_=${Date.now()}`;

const res = await fetch(ENDPOINT, { headers: { 'Cache-Control': 'no-cache' } });
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}
const d = await res.json();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 口コミDB 全体サマリ');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  全 reviews        : ${d.total.toLocaleString()}`);
console.log(`  ├ ユーザー (UUID) : ${d.user.toLocaleString()}`);
console.log(`  ├ ext-* (取込)    : ${d.ext.toLocaleString()}`);
console.log(`  └ x-import-* (一括): ${d.ximport.toLocaleString()}`);

// daily は降順で返ってくる
const daily = (d.daily || []).slice().sort((a, b) => a.date.localeCompare(b.date));

if (daily.length === 0) {
  console.log('\n⚠️  daily が空です');
  process.exit(0);
}

console.log(`\n━━━ ユーザー投稿 日次推移 (直近 ${daily.length} 日, 古→新) ━━━`);
console.log('date       |   cnt | uniq | 件/人  | 判定');
console.log('-----------|------:|-----:|-------:|------');
for (const row of daily) {
  const u = row.uniq_browsers ?? 0;
  const ratio = u > 0 ? (row.cnt / u) : 0;
  let flag = '';
  if (ratio >= 50) flag = '🤖 Bot 確定級';
  else if (ratio >= 20) flag = '🤖 Bot 強疑';
  else if (ratio >= 10) flag = '⚠️ Bot 疑い';
  else if (ratio >= 3) flag = '🤔 リピート';
  else flag = '👤 健全';
  console.log(`${row.date} | ${String(row.cnt).padStart(5)} | ${String(u).padStart(4)} | ${ratio.toFixed(1).padStart(5)} | ${flag}`);
}

// 直近7日 vs その前7日
const today = new Date(); today.setHours(0, 0, 0, 0);
const ymd = (d) => d.toISOString().slice(0, 10);
const range = (offset, len) => {
  const arr = [];
  for (let i = 0; i < len; i++) {
    const dd = new Date(today); dd.setDate(dd.getDate() - offset - i);
    arr.push(ymd(dd));
  }
  return arr;
};
const w_now = range(0, 7);
const w_prev = range(7, 7);
const sumFor = (dates, key) => dates.reduce((s, dt) => s + (daily.find(r => r.date === dt)?.[key] || 0), 0);
const nowCnt = sumFor(w_now, 'cnt'), nowUniq = sumFor(w_now, 'uniq_browsers');
const prevCnt = sumFor(w_prev, 'cnt'), prevUniq = sumFor(w_prev, 'uniq_browsers');

console.log('\n━━━ 直近7日 vs その前7日 ━━━');
console.log(`  W-now  (${w_now[6]}〜${w_now[0]}): ${nowCnt} 件 / unique ${nowUniq} (件/人 ${(nowCnt/(nowUniq||1)).toFixed(1)})`);
console.log(`  W-prev (${w_prev[6]}〜${w_prev[0]}): ${prevCnt} 件 / unique ${prevUniq} (件/人 ${(prevCnt/(prevUniq||1)).toFixed(1)})`);

// ヘビー投稿者 Top10
if (d.heavyPosters && d.heavyPosters.length > 0) {
  console.log('\n━━━ 直近7日 ヘビー投稿者 Top10 (Bot 検出用) ━━━');
  console.log('browser_id (先頭)              |  cnt | first              | last');
  console.log('-------------------------------|-----:|--------------------|--------------------');
  for (const p of d.heavyPosters) {
    const bid = (p.browser_id || '').substring(0, 30).padEnd(30);
    console.log(`${bid} | ${String(p.cnt).padStart(4)} | ${p.first_at}  | ${p.last_at}`);
  }
}

console.log('\n━━━ 最新ユーザー投稿 10件 ━━━');
for (const r of (d.latest || []).slice(0, 10)) {
  const bid = (r.browser_id || '').substring(0, 8);
  console.log(`  ${r.created_at}  [${bid}]  ${r.panel_rating.padEnd(11)}  ${r.shop_name} / ${r.girl_name}`);
}
