#!/usr/bin/env node
/**
 * Bot 投稿の影響を受けた shop / girl ページを抽出
 *
 * 定義: 直近14日のうち、ある1日に >= 10件 投稿した browser_id を Bot 認定
 *       その Bot が投稿した全 reviews が「Bot 汚染レビュー」
 */
const ENDPOINT = `https://panemaji.com/api/review-stats?_=${Date.now()}`;

const res = await fetch(ENDPOINT, { headers: { 'Cache-Control': 'no-cache' } });
if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1); }
const d = await res.json();

if (!d.botSummary) {
  console.error('botSummary not in response — deploy not complete yet');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 Bot 投稿 全体サマリ (直近14日, 判定: 1日10件以上の browser_id)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const b = d.botSummary;
console.log(`  Bot 認定 browser_id 数 : ${b.bot_browser_count}`);
console.log(`  Bot 投稿数             : ${b.bot_review_count.toLocaleString()}`);
console.log(`  Bot 投稿先 girl 数     : ${b.bot_girls_affected.toLocaleString()} 嬢`);
console.log(`  Bot 投稿先 shop 数     : ${b.bot_shops_affected.toLocaleString()} 店`);

console.log('\n━━━ 🏠 Bot 投稿された shop Top20 ━━━');
console.log('rank | bot_cnt | bot_browser | bot_girls | shop_name (URL)');
console.log('-----|--------:|------------:|----------:|------------------');
(d.botAffectedShops || []).forEach((s, i) => {
  console.log(`#${String(i+1).padStart(2)} | ${String(s.bot_review_count).padStart(7)} | ${String(s.bot_browser_count).padStart(11)} | ${String(s.bot_girls_affected).padStart(9)} | ${s.shop_name}`);
  console.log(`    → https://panemaji.com/shop/${s.shop_id}`);
});

console.log('\n━━━ 👩 Bot 投稿された girl Top20 ━━━');
console.log('rank | bot_cnt | bot_browser | girl_name @ shop_name');
console.log('-----|--------:|------------:|------------------');
(d.botAffectedGirls || []).forEach((g, i) => {
  console.log(`#${String(i+1).padStart(2)} | ${String(g.bot_review_count).padStart(7)} | ${String(g.bot_browser_count).padStart(11)} | ${g.girl_name}  @  ${g.shop_name}`);
  console.log(`    → https://panemaji.com/girl/${g.girl_id}`);
});
