#!/usr/bin/env node
/**
 * ボトムアップ ポテンシャル試算
 *  - DBの母集団 (shops, girls, areas) × クエリテンプレ × 既出imp平均 × 達成カバー率
 *  - 松/竹/梅で出す
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BRAND = ['panemaji', 'パネマジ', 'パネまじ', 'ぱねまじ', 'パネマ時', 'バネマジ'];
const norm = (q) => q.toLowerCase().replace(/\s+/g, '');
const isBrand = (q) => BRAND.some((p) => norm(q).includes(norm(p)));

const db = new Database(path.join(ROOT, 'panemaji.db'), { readonly: true });
const shops = db.prepare('SELECT id, name FROM shops WHERE is_active=1 AND length(name)>=3').all();
const areas = db.prepare('SELECT id, name FROM areas WHERE length(name)>=2').all();
const girls = db.prepare('SELECT id, name, shop_id FROM girls WHERE is_active=1 AND length(name)>=2').all();
const girlsWithReview = db.prepare('SELECT COUNT(DISTINCT g.id) c FROM girls g JOIN reviews r ON r.girl_id=g.id WHERE g.is_active=1').get().c;
db.close();

const N_SHOPS = shops.length;
const N_AREAS = areas.length;
const N_GIRLS = girls.length;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📦 母集団 (DB)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  active shops:  ${N_SHOPS.toLocaleString()}`);
console.log(`  active girls:  ${N_GIRLS.toLocaleString()}`);
console.log(`  girls w/review (= 人気嬢): ${girlsWithReview.toLocaleString()}`);
console.log(`  areas:         ${N_AREAS.toLocaleString()}\n`);

// 各クエリのカテゴリ分類
const shopByName = new Map();
for (const s of shops) shopByName.set(norm(s.name), s);
const shopNames = shops.map((s) => norm(s.name)).sort((a, b) => b.length - a.length);
const areaNames = areas.map((a) => norm(a.name)).sort((a, b) => b.length - a.length);
const girlNames = new Set();
for (const g of girls) girlNames.add(norm(g.name));

function findShop(q) {
  for (const sn of shopNames) {
    if (sn.length >= 3 && q.includes(sn)) return sn;
  }
  return null;
}
function findArea(q) {
  for (const an of areaNames) {
    if (an.length >= 2 && q.includes(an)) return an;
  }
  return null;
}
function findGirl(q, excludeShopName) {
  // q から shop名部分を除いた残りに2文字以上の girl名 が含まれるか
  let rest = q;
  if (excludeShopName) rest = rest.replace(excludeShopName, '');
  for (const gn of girlNames) {
    if (gn.length >= 2 && rest.includes(gn)) return gn;
  }
  return null;
}

function classify(q) {
  const n = norm(q);
  if (isBrand(q)) return { cat: 'brand' };
  const shop = findShop(n);
  // 「店名+掲示板」「店名+口コミ」「店名+嬢」「店名のみ」
  if (shop) {
    if (/掲示板|スレ|スレッド/.test(q)) return { cat: 'shop_keiji', shop };
    if (/口コミ|レビュー|評判/.test(q)) return { cat: 'shop_review', shop };
    const girl = findGirl(n, shop);
    if (girl) return { cat: 'shop_girl', shop, girl };
    return { cat: 'shop_only', shop };
  }
  const area = findArea(n);
  if (area) {
    if (/掲示板|スレ/.test(q)) return { cat: 'area_keiji', area };
    if (/風俗|デリヘル|ヘルス|ソープ|メンズエステ|アロマ/.test(q)) return { cat: 'area_genre', area };
    return { cat: 'area_other', area };
  }
  // 嬢名のみクエリ?
  const girl = findGirl(n, null);
  if (girl) return { cat: 'girl_only', girl };
  return { cat: 'other' };
}

// 14日データから各カテゴリの実績を集計
const cur14 = JSON.parse(fs.readFileSync('/tmp/gsc-tmp/cur14-fresh.json', 'utf8')).rows || [];
const cats = ['brand', 'shop_only', 'shop_keiji', 'shop_review', 'shop_girl', 'area_keiji', 'area_genre', 'area_other', 'girl_only', 'other'];
const stats = {};
for (const c of cats) stats[c] = { rows: [], items: new Set(), sumImp: 0, sumClicks: 0, weightedPos: 0 };

for (const r of cur14) {
  const q = r.keys[0];
  const c = classify(q);
  const s = stats[c.cat];
  s.rows.push({ q, imp: r.impressions || 0, clicks: r.clicks || 0, pos: r.position || 0 });
  s.sumImp += r.impressions || 0;
  s.sumClicks += r.clicks || 0;
  s.weightedPos += (r.position || 0) * (r.impressions || 0);
  if (c.shop) s.items.add(c.shop);
  else if (c.area) s.items.add(c.area);
  else if (c.girl) s.items.add(c.girl);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 14日実績 (cur14: 4/12-4/25) を細分化');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('カテゴリ          | クエリ数 | カバーアイテム | 14日imp | 14日click | imp/q | pos平均');
console.log('-----------------|---------:|---------------:|--------:|----------:|------:|--------:');
for (const c of cats) {
  const s = stats[c];
  const ap = s.sumImp > 0 ? s.weightedPos / s.sumImp : 0;
  const impPerQ = s.rows.length > 0 ? s.sumImp / s.rows.length : 0;
  console.log(`${c.padEnd(17)} | ${String(s.rows.length).padStart(8)} | ${String(s.items.size).padStart(14)} | ${String(s.sumImp).padStart(7)} | ${String(s.sumClicks).padStart(9)} | ${impPerQ.toFixed(1).padStart(5)} | ${ap.toFixed(1).padStart(7)}`);
}

// 月間換算ベース (14日 → 30日)
const M = 30 / 14;

// テンプレ × 母集団 → 「全カバー時の月間imp 上限」
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📐 ボトムアップ ポテンシャル (各カテゴリ "全件カバー" 時の月間imp)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const templates = [
  { cat: 'shop_only', label: '店名のみ', pop: N_SHOPS, popLabel: `shops ${N_SHOPS}` },
  { cat: 'shop_keiji', label: '店名+掲示板', pop: N_SHOPS, popLabel: `shops ${N_SHOPS}` },
  { cat: 'shop_review', label: '店名+口コミ', pop: N_SHOPS, popLabel: `shops ${N_SHOPS}` },
  { cat: 'shop_girl', label: '店名+嬢名', pop: girlsWithReview, popLabel: `pop girls ${girlsWithReview}` },
  { cat: 'area_keiji', label: 'エリア+掲示板', pop: N_AREAS, popLabel: `areas ${N_AREAS}` },
  { cat: 'area_genre', label: 'エリア+ジャンル', pop: N_AREAS * 5, popLabel: `areas×5ジャンル` },
  { cat: 'area_other', label: 'エリアその他', pop: N_AREAS, popLabel: `areas ${N_AREAS}` },
  { cat: 'girl_only', label: '嬢名のみ', pop: girlsWithReview, popLabel: `pop girls ${girlsWithReview}` },
  { cat: 'other', label: 'その他(掲示板汎用等)', pop: 1000, popLabel: 'fixed 1000' },
];

console.log('カテゴリ          | 母集団       | 既出imp/q | カバー率 | 上限月間imp (理論最大)');
console.log('-----------------|--------------|----------:|---------:|-----------------------');
let totalPotential = 0;
const potentialByCat = [];
for (const t of templates) {
  const s = stats[t.cat];
  const impPerQ14 = s.rows.length > 0 ? s.sumImp / s.rows.length : 0;
  const impPerQMonth = impPerQ14 * M;
  const coverage = t.pop > 0 ? s.items.size / t.pop : 0;
  const potentialMonth = impPerQMonth * t.pop;
  potentialByCat.push({ ...t, impPerQMonth, coverage, potentialMonth });
  totalPotential += potentialMonth;
  console.log(`${t.label.padEnd(17)} | ${t.popLabel.padEnd(13)}| ${impPerQMonth.toFixed(1).padStart(9)} | ${(coverage * 100).toFixed(2).padStart(6)}% | ${Math.round(potentialMonth).toLocaleString().padStart(20)}`);
}
console.log(`${'非ブランド合計上限'.padEnd(17)} |              |           |          | ${Math.round(totalPotential).toLocaleString().padStart(20)} imp/月`);

// ブランド (固定推定)
const brandMonth = stats.brand.sumImp * M;
console.log(`${'brand (固定)'.padEnd(17)} |              |           |          | ${Math.round(brandMonth).toLocaleString().padStart(20)} imp/月`);
console.log(`\n上限 (Total Addressable, 全カバー × 平均順位維持): ${Math.round(totalPotential + brandMonth).toLocaleString()} imp/月`);

// 松竹梅シナリオ
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 松竹梅シナリオ (達成カバー率 × 順位改善で imp と clicks を試算)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 順位別 CTR (業界一般値)
const POS_CTR = { 1: 0.30, 2: 0.15, 3: 0.10, 5: 0.06, 8: 0.04, 10: 0.025, 15: 0.012, 20: 0.005 };
function ctrAt(pos) {
  // 線形補間
  const ks = Object.keys(POS_CTR).map(Number).sort((a, b) => a - b);
  if (pos <= ks[0]) return POS_CTR[ks[0]];
  if (pos >= ks[ks.length - 1]) return POS_CTR[ks[ks.length - 1]];
  for (let i = 0; i < ks.length - 1; i++) {
    if (pos >= ks[i] && pos <= ks[i + 1]) {
      const f = (pos - ks[i]) / (ks[i + 1] - ks[i]);
      return POS_CTR[ks[i]] * (1 - f) + POS_CTR[ks[i + 1]] * f;
    }
  }
  return 0.01;
}

// シナリオ定義: { ラベル, カテゴリ別カバー率, 平均達成順位 }
const scenarios = {
  matsu: {
    label: '🏆 松 (積極展開)',
    cov: { shop_only: 0.50, shop_keiji: 0.60, shop_review: 0.40, shop_girl: 0.20, area_keiji: 0.80, area_genre: 0.60, area_other: 0.50, girl_only: 0.30, other: 1.0 },
    pos: { shop_only: 6, shop_keiji: 4, shop_review: 5, shop_girl: 5, area_keiji: 6, area_genre: 8, area_other: 10, girl_only: 6, other: 7 },
  },
  take: {
    label: '🥈 竹 (順当展開)',
    cov: { shop_only: 0.30, shop_keiji: 0.40, shop_review: 0.25, shop_girl: 0.10, area_keiji: 0.60, area_genre: 0.40, area_other: 0.30, girl_only: 0.15, other: 1.0 },
    pos: { shop_only: 9, shop_keiji: 7, shop_review: 8, shop_girl: 8, area_keiji: 9, area_genre: 12, area_other: 14, girl_only: 9, other: 10 },
  },
  ume: {
    label: '🥉 梅 (現状維持寄り)',
    cov: { shop_only: 0.15, shop_keiji: 0.20, shop_review: 0.10, shop_girl: 0.04, area_keiji: 0.40, area_genre: 0.20, area_other: 0.15, girl_only: 0.05, other: 1.0 },
    pos: { shop_only: 12, shop_keiji: 10, shop_review: 11, shop_girl: 11, area_keiji: 12, area_genre: 15, area_other: 18, girl_only: 12, other: 14 },
  },
};

console.log('\nカテゴリ別 内訳 (imp/月)');
console.log('カテゴリ          | 母集団  |  imp/q | 松カバー  imp/月       | 竹カバー  imp/月       | 梅カバー  imp/月');
console.log('-----------------|--------:|-------:|------------------------|------------------------|------------------------');
const totals = { matsu: { imp: 0, clicks: 0 }, take: { imp: 0, clicks: 0 }, ume: { imp: 0, clicks: 0 } };
for (const t of potentialByCat) {
  if (t.cat === 'brand') continue;
  const row = [`${t.label.padEnd(17)}`, `${t.pop.toLocaleString().padStart(7)}`, `${t.impPerQMonth.toFixed(1).padStart(6)}`];
  for (const k of ['matsu', 'take', 'ume']) {
    const sc = scenarios[k];
    const cov = sc.cov[t.cat] ?? 0;
    const pos = sc.pos[t.cat] ?? 12;
    const ctr = ctrAt(pos);
    const impMonth = t.impPerQMonth * t.pop * cov;
    const clicksMonth = impMonth * ctr;
    totals[k].imp += impMonth;
    totals[k].clicks += clicksMonth;
    row.push(`cov${(cov * 100).toFixed(0).padStart(2)}% ${Math.round(impMonth).toLocaleString().padStart(8)}/月`);
  }
  console.log(row.join(' | '));
}

// brand 加算
for (const k of Object.keys(totals)) {
  totals[k].imp += brandMonth;
  // ブランドは clicks も別途
  totals[k].clicks += stats.brand.sumClicks * M;
}

console.log('\n━━━ 月間サマリ (松竹梅) ━━━');
console.log('シナリオ            | 月間imp (合計)  | 月間clicks (合計)| 月間収益 (eCPM ¥10)');
console.log('-------------------|----------------:|-----------------:|---------------------:');
for (const k of ['matsu', 'take', 'ume']) {
  const sc = scenarios[k];
  const rev = (totals[k].imp / 1000) * 10;
  console.log(`${sc.label.padEnd(20)}| ${Math.round(totals[k].imp).toLocaleString().padStart(15)} | ${Math.round(totals[k].clicks).toLocaleString().padStart(16)} | ¥${Math.round(rev).toLocaleString().padStart(20)}`);
}

console.log('\n━━━ 現在 (W5基準, 4週間換算) との比較 ━━━');
const nowMonth = (stats.brand.sumImp + stats.shop_only.sumImp + stats.shop_keiji.sumImp + stats.shop_review.sumImp + stats.shop_girl.sumImp + stats.area_keiji.sumImp + stats.area_genre.sumImp + stats.area_other.sumImp + stats.girl_only.sumImp + stats.other.sumImp) * M;
console.log(`現在 (cur14×30/14): 月間 ${Math.round(nowMonth).toLocaleString()} imp / clicks ${Math.round((stats.brand.sumClicks + cur14.filter(r => !isBrand(r.keys[0])).reduce((s,r)=>s+(r.clicks||0),0)) * M).toLocaleString()}`);
for (const k of ['matsu', 'take', 'ume']) {
  console.log(`${scenarios[k].label}: imp ×${(totals[k].imp / nowMonth).toFixed(1)}, clicks ${Math.round(totals[k].clicks).toLocaleString()}`);
}
