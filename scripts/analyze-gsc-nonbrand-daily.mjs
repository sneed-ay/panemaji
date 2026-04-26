#!/usr/bin/env node
import fs from 'node:fs';

const total = JSON.parse(fs.readFileSync('/tmp/gsc-tmp/daily-total-fresh.json', 'utf8')).rows || [];
const brand = JSON.parse(fs.readFileSync('/tmp/gsc-tmp/daily-brand.json', 'utf8')).rows || [];

const bMap = new Map(brand.map((r) => [r.keys[0], r]));

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 非ブランド検索 日次推移 (= 全体 − ブランド)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('date       |        imp |     clicks |   CTR  | avgPos | (全体imp/clicks/pos | brand imp/clicks/pos)');
console.log('-----------|-----------:|-----------:|-------:|-------:|-------------------------------------------------');

const rows = [];
for (const t of total) {
  const date = t.keys[0];
  const b = bMap.get(date) || { impressions: 0, clicks: 0, position: 0 };
  const nbImp = t.impressions - b.impressions;
  const nbClicks = t.clicks - b.clicks;
  // pos = (totalPos*totalImp - brandPos*brandImp) / nbImp
  const nbPos = nbImp > 0 ? (t.position * t.impressions - b.position * b.impressions) / nbImp : 0;
  const ctr = nbImp > 0 ? (nbClicks / nbImp) * 100 : 0;
  rows.push({ date, nbImp, nbClicks, nbPos, ctr, t, b });
  console.log(
    `${date} | ${String(nbImp).padStart(10)} | ${String(nbClicks).padStart(10)} | ${ctr.toFixed(2).padStart(5)}% | ${nbPos.toFixed(1).padStart(6)} | ${String(t.impressions).padStart(6)}/${String(t.clicks).padStart(5)}/${t.position.toFixed(1).padStart(4)} | ${String(b.impressions).padStart(6)}/${String(b.clicks).padStart(5)}/${b.position.toFixed(1).padStart(4)}`
  );
}

// 7日移動平均（後ろ向き）
console.log('\n━━━ 非ブランド 7日移動平均 (傾向見るため) ━━━');
console.log('date       | imp_ma7 | clicks_ma7 | pos_ma7');
for (let i = 6; i < rows.length; i++) {
  const w = rows.slice(i - 6, i + 1);
  const ai = w.reduce((s, r) => s + r.nbImp, 0) / 7;
  const ac = w.reduce((s, r) => s + r.nbClicks, 0) / 7;
  const totalI = w.reduce((s, r) => s + r.nbImp, 0);
  const ap = totalI > 0 ? w.reduce((s, r) => s + r.nbPos * r.nbImp, 0) / totalI : 0;
  console.log(`${rows[i].date} | ${ai.toFixed(0).padStart(7)} | ${ac.toFixed(0).padStart(10)} | ${ap.toFixed(2).padStart(7)}`);
}

// 期間サマリ
const sum = (arr, k) => arr.reduce((s, r) => s + r[k], 0);
const wk1 = rows.slice(0, 7);   // 3/19-3/25
const wk2 = rows.slice(7, 14);  // 3/26-4/01
const wk3 = rows.slice(14, 21); // 4/02-4/08
const wk4 = rows.slice(21, 28); // 4/09-4/15
const wk5 = rows.slice(28, 35); // 4/16-4/22
const wk6 = rows.slice(35);     // 4/23-4/25 (3日)
console.log('\n━━━ 週次サマリ (非ブランド) ━━━');
const weekShow = (label, w) => {
  const i = sum(w, 'nbImp'), c = sum(w, 'nbClicks');
  const p = i > 0 ? w.reduce((s, r) => s + r.nbPos * r.nbImp, 0) / i : 0;
  console.log(`${label.padEnd(22)} | imp ${String(i).padStart(6)} | clicks ${String(c).padStart(5)} | CTR ${(i > 0 ? (c / i) * 100 : 0).toFixed(2)}% | pos ${p.toFixed(2)}  (${w.length}日)`);
};
weekShow('W1 3/19-3/25', wk1);
weekShow('W2 3/26-4/01', wk2);
weekShow('W3 4/02-4/08', wk3);
weekShow('W4 4/09-4/15', wk4);
weekShow('W5 4/16-4/22', wk5);
weekShow('W6 4/23-4/25 (部分)', wk6);
