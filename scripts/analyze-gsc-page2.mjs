#!/usr/bin/env node
/**
 * GSC「ページ2狩り」分析
 *
 * 目的:
 *   直近の GSC データから position 11-20 のクエリを抽出し、
 *   タイトル / description を 微調整すれば 1ページ目に押し上げ可能な
 *   「すぐ効く SEO 改善候補」をリストアップする。
 *
 * 入力:  logs/gsc-YYYYMMDD.json (panemaji-gsc-weekly が 作成)
 * 出力:
 *   - 標準出力: 候補テーブル
 *   - logs/gsc-page2-opportunities.json: 機械可読
 *
 * 使い方:
 *   node scripts/analyze-gsc-page2.mjs                # 全 bucket
 *   node scripts/analyze-gsc-page2.mjs --bucket=area  # area のみ
 *   node scripts/analyze-gsc-page2.mjs --min-imp=100  # impression しきい値変更
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');

// ─── CLI args ──────────────────────────────────────
const args = process.argv.slice(2);
const argBucket = args.find(a => a.startsWith('--bucket='))?.split('=')[1] || null;
const argMinImp = parseInt(args.find(a => a.startsWith('--min-imp='))?.split('=')[1] || '50', 10);
const argMaxPos = parseFloat(args.find(a => a.startsWith('--max-pos='))?.split('=')[1] || '20');
const argMinPos = parseFloat(args.find(a => a.startsWith('--min-pos='))?.split('=')[1] || '11');
const argTop = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] || '50', 10);

// ─── 最新 GSC データを 取得 ──────────────────────
const files = fs.readdirSync(LOG_DIR).filter(f => /^gsc-\d{8}\.json$/.test(f)).sort();
const latest = files[files.length - 1];
if (!latest) {
  console.error('[err] no gsc-YYYYMMDD.json found in logs/');
  console.error('      panemaji-gsc-weekly タスクで生成される。 一度実行を待つか:');
  console.error('      node scripts/fetch-gsc.mjs');
  process.exit(1);
}
const sourcePath = path.join(LOG_DIR, latest);
const data = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

// ─── 候補抽出 ─────────────────────────────────────
const BUCKETS = argBucket ? [argBucket] : ['brand', 'shop_name', 'area', 'other'];
const candidates = [];
for (const bucket of BUCKETS) {
  const queries = data.buckets?.cur?.[bucket] || [];
  for (const q of queries) {
    if (q.position >= argMinPos && q.position <= argMaxPos && q.impressions >= argMinImp) {
      candidates.push({ ...q, bucket });
    }
  }
}
candidates.sort((a, b) => b.impressions - a.impressions);

// ─── 出力 ────────────────────────────────────────
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 GSC ページ2狩り候補 (押し上げで 1 ページ目入りを狙うクエリ)');
console.log(`   source: logs/${latest}`);
console.log(`   period: ${data.periods?.curStart} 〜 ${data.periods?.curEnd}`);
console.log(`   filter: position ${argMinPos}-${argMaxPos} かつ impressions >= ${argMinImp}`);
console.log(`   buckets: ${BUCKETS.join(', ')}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (candidates.length === 0) {
  console.log('  該当クエリなし。 --min-imp を 下げてみてください。');
  process.exit(0);
}

// テーブル表示 (上位 N 件)
const cols = ['クエリ', 'imp', 'clicks', 'CTR', 'pos', 'bucket', '推定+'];
const widths = [50, 7, 7, 6, 6, 10, 7];
console.log('  ' + cols.map((c, i) => i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])).join('  '));
console.log('  ' + '─'.repeat(widths.reduce((s, w) => s + w, 0) + (widths.length - 1) * 2));

const topN = candidates.slice(0, argTop);
for (const q of topN) {
  // 推定: position 11-20 → 5 に押し上げ
  // p20 CTR 約 0.5%、p5 CTR 約 8% → +7.5pt
  const targetCtr = 0.08;
  const upliftClicks = Math.max(0, Math.round(q.impressions * (targetCtr - q.ctr)));

  const ctrStr = (q.ctr * 100).toFixed(1) + '%';
  const posStr = q.position.toFixed(1);
  const upStr = '+' + upliftClicks;
  console.log('  ' + [
    q.query.length > 49 ? q.query.slice(0, 46) + '...' : q.query.padEnd(widths[0]),
    String(q.impressions).padStart(widths[1]),
    String(q.clicks).padStart(widths[2]),
    ctrStr.padStart(widths[3]),
    posStr.padStart(widths[4]),
    q.bucket.padStart(widths[5]),
    upStr.padStart(widths[6]),
  ].join('  '));
}

console.log('  ' + '─'.repeat(widths.reduce((s, w) => s + w, 0) + (widths.length - 1) * 2));

// 集計
const allImp = candidates.reduce((s, q) => s + q.impressions, 0);
const allClicks = candidates.reduce((s, q) => s + q.clicks, 0);
const allUplift = candidates.reduce((s, q) => s + Math.max(0, Math.round(q.impressions * (0.08 - q.ctr))), 0);

console.log(`\n  候補 ${candidates.length} 件 / 合計 imp ${allImp.toLocaleString()} / 合計 clicks ${allClicks.toLocaleString()}`);
console.log(`  推定アップサイド: 全件 pos 5 まで押し上げで +${allUplift.toLocaleString()} clicks (期間あたり)`);

// bucket 別集計
console.log('\n📊 bucket 別 summary:');
const byBucket = {};
for (const q of candidates) {
  byBucket[q.bucket] = byBucket[q.bucket] || { count: 0, imp: 0, clicks: 0 };
  byBucket[q.bucket].count++;
  byBucket[q.bucket].imp += q.impressions;
  byBucket[q.bucket].clicks += q.clicks;
}
console.log('  ' + ['bucket'.padEnd(12), 'count'.padStart(6), 'imp'.padStart(10), 'clicks'.padStart(8)].join('  '));
console.log('  ' + '─'.repeat(40));
for (const [bucket, s] of Object.entries(byBucket).sort((a, b) => b[1].imp - a[1].imp)) {
  console.log('  ' + [
    bucket.padEnd(12),
    String(s.count).padStart(6),
    s.imp.toLocaleString().padStart(10),
    s.clicks.toLocaleString().padStart(8),
  ].join('  '));
}

// JSON 出力
const outFile = path.join(LOG_DIR, 'gsc-page2-opportunities.json');
fs.writeFileSync(outFile, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: latest,
  period: data.periods,
  filter: { min_pos: argMinPos, max_pos: argMaxPos, min_imp: argMinImp, buckets: BUCKETS },
  summary: {
    total_candidates: candidates.length,
    total_impressions: allImp,
    total_clicks: allClicks,
    estimated_uplift_clicks: allUplift,
    by_bucket: byBucket,
  },
  candidates,
}, null, 2));
console.log(`\n  → ${outFile}`);
