#!/usr/bin/env node
/**
 * 3シナリオ × 1ヶ月毎の imp / 収益シミュレーション
 * 仮定: 1000imp = 10円 (eCPM 10円, GSC impをそのまま使用)
 */

const baseClicks = 8631;     // 非ブランド W5週clicks
const baseImp = 55894;       // 非ブランド W5週imp
const BRAND_IMP_PER_DAY = 1259;
const BRAND_IMP_PER_WEEK = BRAND_IMP_PER_DAY * 7;
const ECPM = 10; // 1000impあたり10円

const scenarios = {
  bull: { label: '🚀 強気', rate: () => 0.25 },
  base: { label: '📊 基本', rate: (w) => 0.05 + 0.30 * Math.exp(-w / 5) },
  bear: { label: '🐢 保守', rate: () => 0.08 },
};

const fmt = (n) => Math.round(n).toLocaleString();

// 各シナリオで W5 → W17 まで非ブランド週imp を生成、ブランド固定
function simulate(scName) {
  const sc = scenarios[scName];
  const weeks = [{ week: 0, nbImp: baseImp, brandImp: BRAND_IMP_PER_WEEK }];
  let imp = baseImp;
  for (let w = 1; w <= 13; w++) { // W6-W18 (3ヶ月超)
    const r = sc.rate(w);
    imp *= (1 + r * 1.05);
    weeks.push({ week: w, nbImp: imp, brandImp: BRAND_IMP_PER_WEEK });
  }
  return weeks;
}

// 「Nヶ月目」の月間imp = その月にあたる4週間分の合計
// 起点 W5 を 0ヶ月目とし、W6-W9 = 1ヶ月目、W10-W13 = 2ヶ月目、W14-W17 = 3ヶ月目
function monthlyAggregate(weeks) {
  // weeks[0] = W5(基準), weeks[1] = W6, ...
  const m = [
    { label: '現在 (W5基準, 1週間×4倍換算)', range: [0, 0], factor: 4 },
    { label: '1ヶ月目 (W6-W9, 5月上旬-中旬)', range: [1, 4], factor: 1 },
    { label: '2ヶ月目 (W10-W13, 6月上旬-中旬)', range: [5, 8], factor: 1 },
    { label: '3ヶ月目 (W14-W17, 7月上旬-中旬)', range: [9, 12], factor: 1 },
  ];
  return m.map((mm) => {
    let nbSum = 0, brandSum = 0;
    for (let i = mm.range[0]; i <= mm.range[1]; i++) {
      nbSum += weeks[i].nbImp;
      brandSum += weeks[i].brandImp;
    }
    nbSum *= mm.factor;
    brandSum *= mm.factor;
    return { label: mm.label, nbImp: nbSum, brandImp: brandSum, totalImp: nbSum + brandSum, revenue: ((nbSum + brandSum) / 1000) * ECPM };
  });
}

const results = {};
for (const k of Object.keys(scenarios)) results[k] = monthlyAggregate(simulate(k));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`💴 月間 imp / 収益シミュレーション   (eCPM = ¥${ECPM}/1000imp)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const k of ['bull', 'base', 'bear']) {
  const sc = scenarios[k];
  console.log(`\n━━━ ${sc.label} ━━━`);
  console.log('期間                              | 非ブランドimp | ブランドimp | 全体imp     | 月間収益');
  console.log('---------------------------------|--------------:|------------:|------------:|---------:');
  for (const r of results[k]) {
    console.log(`${r.label.padEnd(33)} | ${fmt(r.nbImp).padStart(13)} | ${fmt(r.brandImp).padStart(11)} | ${fmt(r.totalImp).padStart(11)} | ¥${fmt(r.revenue).padStart(7)}`);
  }
  // 3ヶ月累計
  const cumul = results[k].slice(1).reduce((s, r) => s + r.revenue, 0);
  console.log(`${'3ヶ月 累計収益'.padEnd(33)} |               |             |             | ¥${fmt(cumul).padStart(7)}`);
}

// 横並び比較
console.log('\n\n━━━ 月別 比較 (3シナリオ並べ) ━━━');
console.log('期間          | 🚀 強気 imp     収益    | 📊 基本 imp     収益    | 🐢 保守 imp     収益');
console.log('-------------|------------------------|------------------------|----------------------');
const months = ['現在 (W5基準)', '1ヶ月目', '2ヶ月目', '3ヶ月目'];
for (let i = 0; i < 4; i++) {
  const b = results.bull[i], ba = results.base[i], be = results.bear[i];
  console.log(`${months[i].padEnd(13)} | ${fmt(b.totalImp).padStart(9)}   ¥${fmt(b.revenue).padStart(6)} | ${fmt(ba.totalImp).padStart(9)}   ¥${fmt(ba.revenue).padStart(6)} | ${fmt(be.totalImp).padStart(9)}   ¥${fmt(be.revenue).padStart(6)}`);
}

console.log('\n━━━ 3ヶ月累計収益 ━━━');
for (const k of ['bull', 'base', 'bear']) {
  const cumul = results[k].slice(1).reduce((s, r) => s + r.revenue, 0);
  console.log(`${scenarios[k].label}: ¥${fmt(cumul)}`);
}
