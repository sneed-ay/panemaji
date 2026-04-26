#!/usr/bin/env node
/**
 * 非ブランド検索の3ヶ月成長シミュレーション
 *
 * モデル: WoW成長率を3シナリオで設定し、12週後まで予測
 * - 強気 (Bull): WoW +25% で減衰せず維持
 * - 基本 (Base): WoW指数減衰 (+40% → 3ヶ月後 +5%)
 * - 保守 (Bear): WoW +10% で安定
 *
 * ブランドclicksは固定 (約1,016/日 = 7,112/週)
 */

// 実データ (W2-W5の確定値, W6は3日のため外挿)
const observedWeekly = [
  { week: 'W2 3/26-4/01', clicks: 2187, imp: 8863, days: 7, pos: 7.97 },
  { week: 'W3 4/02-4/08', clicks: 2827, imp: 18244, days: 7, pos: 9.14 },
  { week: 'W4 4/09-4/15', clicks: 6093, imp: 45106, days: 7, pos: 9.74 },
  { week: 'W5 4/16-4/22', clicks: 8631, imp: 55894, days: 7, pos: 9.46 },
];
const BRAND_CLICKS_PER_DAY = 1016;
const BRAND_IMP_PER_DAY = 1259; // 14233/14, 17626/14平均

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📈 非ブランド成長 3ヶ月シミュレーション (起点: W5 = 4/16-4/22)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('実績WoW: W3→W4 +115.5%, W4→W5 +41.6%  → 成長率は鈍化フェーズ\n');

// click/週 と imp/週 のCTRから imp も予測
const baseClicks = observedWeekly[3].clicks; // 8631
const baseImp = observedWeekly[3].imp; // 55894

const scenarios = {
  bull: {
    label: '🚀 強気 (Bull)',
    desc: 'WoW +25% を 12週維持 (検索が次々ヒット、サイト拡大も並行)',
    rate: () => 0.25,
  },
  base: {
    label: '📊 基本 (Base)',
    desc: 'WoW 指数減衰: +35% → 12週後に +5% へ (典型的SEO成長カーブ)',
    rate: (w) => 0.05 + 0.30 * Math.exp(-w / 5),
  },
  bear: {
    label: '🐢 保守 (Bear)',
    desc: 'WoW +8% で安定 (順位悪化や競合反撃で頭打ち)',
    rate: () => 0.08,
  },
};

const fmt = (n) => Math.round(n).toLocaleString();

for (const [k, sc] of Object.entries(scenarios)) {
  console.log(`\n━━━ ${sc.label} ━━━`);
  console.log(`   ${sc.desc}\n`);
  let clicks = baseClicks;
  let imp = baseImp;
  console.log('週     | 期間 (起点比) | clicks/週 | clicks/日 | imp/週   | imp/日 | 全体clicks/日 (vs 現在2,498)');
  console.log('-------|--------------|----------:|----------:|---------:|-------:|----------------------------:');
  console.log(`W5 (基準)|     0週     | ${fmt(clicks).padStart(9)} | ${fmt(clicks/7).padStart(9)} | ${fmt(imp).padStart(8)} | ${fmt(imp/7).padStart(6)} | ${fmt(clicks/7 + BRAND_CLICKS_PER_DAY).padStart(28)}`);
  for (let w = 1; w <= 12; w++) {
    const r = sc.rate(w);
    clicks *= (1 + r);
    imp *= (1 + r * 1.05); // imp は clicks より少し速く伸びる傾向（順位下位の新規露出）
    const monthLabel = w === 4 ? '1ヶ月' : w === 8 ? '2ヶ月' : w === 12 ? '3ヶ月' : `+${w}週`;
    const totalDay = clicks / 7 + BRAND_CLICKS_PER_DAY;
    const mult = totalDay / 2498;
    console.log(`W${5+w}     | ${monthLabel.padStart(5)}        | ${fmt(clicks).padStart(9)} | ${fmt(clicks/7).padStart(9)} | ${fmt(imp).padStart(8)} | ${fmt(imp/7).padStart(6)} | ${fmt(totalDay).padStart(8)}  (×${mult.toFixed(1)})`);
  }
}

console.log('\n━━━ 3ヶ月後 (W17) サマリ比較 ━━━');
console.log('シナリオ |   非ブランドclicks/日 | 全体clicks/日 | 非ブランドシェア | 月間clicks (推定)');
console.log('--------|----------------------|---------------|------------------|--------------------');
for (const [k, sc] of Object.entries(scenarios)) {
  let clicks = baseClicks;
  for (let w = 1; w <= 12; w++) {
    const r = sc.rate(w);
    clicks *= (1 + r);
  }
  const nbDay = clicks / 7;
  const totalDay = nbDay + BRAND_CLICKS_PER_DAY;
  const share = (nbDay / totalDay) * 100;
  const monthly = totalDay * 30;
  console.log(`${sc.label.padEnd(10)} | ${fmt(nbDay).padStart(20)} | ${fmt(totalDay).padStart(13)} | ${share.toFixed(1).padStart(15)}% | ${fmt(monthly).padStart(18)}`);
}

console.log('\n参考:');
console.log(`  現在 (W5平均):     非ブランド ${fmt(baseClicks/7)}/日 + ブランド ${fmt(BRAND_CLICKS_PER_DAY)}/日 = 全体 ${fmt(baseClicks/7 + BRAND_CLICKS_PER_DAY)}/日`);
console.log(`  非ブランドシェア:  ${((baseClicks/7) / (baseClicks/7 + BRAND_CLICKS_PER_DAY) * 100).toFixed(1)}%`);
