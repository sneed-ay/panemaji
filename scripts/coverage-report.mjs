#!/usr/bin/env node
/**
 * 網羅率レポート: cityheaven 掲載総数(分母) と 自DB保有数 を pref×category で突合。
 *
 * 入力:
 *   /tmp/ch-denom.json     (measure-coverage-cityheaven.mjs の出力)
 *   /tmp/db-pref-cat.tsv   (sqlite3: "pref|category|count")
 *
 * 注意:
 *   自DBの category 件数は全ソース(m-este/fuzoku等含む)合算なので、
 *   ratio = have/cityheaven_total は「cityheaven比の保有率」近似。
 *   正確な網羅率は実スクレイプの INSERT/SKIP で確定する。
 */
import fs from 'fs';

const denom = JSON.parse(fs.readFileSync('/tmp/ch-denom.json', 'utf-8'));
const tsv = fs.readFileSync('/tmp/db-pref-cat.tsv', 'utf-8').trim().split('\n');

// db[pref][category] = count
const db = {};
for (const line of tsv) {
  const [pref, category, c] = line.split('|');
  if (!pref || !category) continue;
  (db[pref.trim()] ||= {})[category.trim()] = Number(c);
}

const CH_CATS = ['デリヘル', 'ソープ', 'ヘルス', 'ホテヘル', 'エステ・アロマ'];

// 全国 category 別集計
const natTotal = {}, natHave = {};
const perPrefGap = []; // {pref, category, total, have, gap}
for (const r of denom) {
  if (typeof r.total !== 'number') continue;
  natTotal[r.category] = (natTotal[r.category] || 0) + r.total;
  const have = (db[r.pref] && db[r.pref][r.category]) || 0;
  natHave[r.category] = (natHave[r.category] || 0) + Math.min(have, r.total); // capで純粋な「不足」を見る
  const gap = r.total - have;
  if (gap > 0) perPrefGap.push({ pref: r.pref, category: r.category, total: r.total, have, gap });
}

console.log('=== cityheaven 5業種: 全国 網羅率 (近似) ===');
console.log('業種        cityheaven総数   自DB保有   不足(ratio)');
let sumT = 0, sumH = 0;
for (const cat of CH_CATS) {
  const t = natTotal[cat] || 0;
  // 自DB保有(その業種・全国) = 全prefの db[pref][cat] 合算
  let have = 0;
  for (const pref of Object.keys(db)) have += (db[pref][cat] || 0);
  const ratio = t > 0 ? (have / t * 100) : 0;
  sumT += t; sumH += have;
  console.log(`${cat.padEnd(11)} ${String(t).padStart(12)} ${String(have).padStart(10)}   ${ratio.toFixed(1)}%`);
}
console.log(`${'─'.repeat(48)}`);
console.log(`${'合計'.padEnd(11)} ${String(sumT).padStart(12)} ${String(sumH).padStart(10)}   ${(sumH / sumT * 100).toFixed(1)}%`);

// 不足の大きい pref×category Top 25 (実スクレイプ優先順位)
perPrefGap.sort((a, b) => b.gap - a.gap);
console.log('\n=== 不足が大きい pref×業種 Top 25 (取込優先) ===');
console.log('pref         業種          総数    保有   不足');
for (const g of perPrefGap.slice(0, 25)) {
  console.log(`${g.pref.padEnd(12)} ${g.category.padEnd(12)} ${String(g.total).padStart(6)} ${String(g.have).padStart(6)} ${String(g.gap).padStart(6)}`);
}
const totalGap = perPrefGap.reduce((s, g) => s + g.gap, 0);
console.log(`\n全国 不足合計(cityheaven基準, 5業種): ${totalGap.toLocaleString()} 店舗`);
