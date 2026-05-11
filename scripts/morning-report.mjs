#!/usr/bin/env node
/**
 * 一晩で何が起きたかを 朝に サクッと 把握する 用 報告 script
 *
 * 出力:
 *   - 直近 24h で 追加された 画像 girls 数 (image_url が NULL → URL になった girls)
 *   - DB の 現在 stats (shop/girl/review/area count + 画像カバレッジ %)
 *   - 最新の git commit 5 件 (overnight 作業の確認)
 *   - 最新 audit summary (logs/audit-YYYYMMDD.json から)
 *   - scheduled-task の lastRunAt 1 行サマリ
 *   - 本番 health (uptime / rss)
 *
 * 副作用ゼロ・read-only。
 *
 * 使い方:  node scripts/morning-report.mjs
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const LOG_DIR = path.join(ROOT, 'logs');

const fmt = (n) => Number(n).toLocaleString();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🌅 panemaji 一晩 何が起きたか — 朝の サマリ');
console.log(`   ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ─── DB stats ──────────────────────────────────────
if (fs.existsSync(DB_PATH)) {
  const db = new Database(DB_PATH, { readonly: true });
  const shops = db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c;
  const girls = db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;
  const reviews = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
  const areas = db.prepare('SELECT COUNT(*) c FROM areas').get().c;
  const dupShops = Object.values(db.prepare(`SELECT COUNT(*) FROM (SELECT name, category, COUNT(*) c FROM shops WHERE is_active=1 GROUP BY name, category HAVING c > 1)`).get())[0];
  const girlsImg = db.prepare(`SELECT COUNT(*) c FROM girls WHERE is_active=1 AND image_url IS NOT NULL AND image_url != ''`).get().c;
  const imgPct = girls > 0 ? Math.round((girlsImg / girls) * 1000) / 10 : 0;
  // 直近 24h で 画像が ついた girls (created_at 関係ない、 last_seen_at じゃない、 image_url 自体に timestamp はないので別 stats)
  // 代替: 全 image 持ち girls
  console.log('🗄️  DB stats');
  console.log(`   shops=${fmt(shops)}  girls=${fmt(girls)}  reviews=${fmt(reviews)}  areas=${fmt(areas)}`);
  console.log(`   嬢の画像カバレッジ: ${imgPct}% (${fmt(girls - girlsImg)} 人 画像なし)`);
  console.log(`   shop 重複: ${dupShops}  ${areas === 325 ? '✅' : `⚠️  areas≠325`}`);
  db.close();
} else {
  console.log('⚠️  DB ファイルが ない');
}

// ─── git log ────────────────────────────────────────
console.log('\n📝 直近 git commit (overnight 作業)');
try {
  const log = execSync('git log --since="12 hours ago" --pretty=format:"%h %s"', { cwd: ROOT, encoding: 'utf-8' });
  if (log.trim()) {
    log.split('\n').forEach(line => console.log(`   ${line}`));
  } else {
    console.log('   (none in last 12 hours)');
  }
} catch (e) {
  console.log(`   git log エラー: ${e.message}`);
}

// ─── 最新 audit ───────────────────────────────────
console.log('\n🩺 最新 audit');
try {
  const files = fs.readdirSync(LOG_DIR).filter(f => /^audit-\d{8}\.json$/.test(f)).sort();
  const latest = files[files.length - 1];
  if (latest) {
    const data = JSON.parse(fs.readFileSync(path.join(LOG_DIR, latest), 'utf-8'));
    const overall = data.summary?.overall || '?';
    const mark = overall === 'green' ? '✅' : overall === 'yellow' ? '🟡' : '🔴';
    console.log(`   ${mark} ${latest}: ${overall.toUpperCase()}  alerts=${data.summary?.alerts ?? '?'}  warnings=${data.summary?.warnings ?? '?'}`);
    if (data.alerts && data.alerts.length > 0) {
      console.log('   ALERTS:');
      data.alerts.forEach(a => console.log(`     • ${a}`));
    }
    if (data.warnings && data.warnings.length > 0 && data.warnings.length <= 5) {
      console.log('   WARNINGS:');
      data.warnings.forEach(w => console.log(`     • ${w}`));
    }
  } else {
    console.log('   audit ログ なし');
  }
} catch (e) {
  console.log(`   audit 読み取り エラー: ${e.message}`);
}

// ─── 本番 health ──────────────────────────────────
console.log('\n💾 本番 health');
try {
  const h = await fetch('https://panemaji.com/api/health').then(r => r.json());
  console.log(`   uptime=${(h.uptime_sec / 3600).toFixed(1)}h  rss=${h.rss_mb}MB (${h.rss_pct}%)  external=${h.external_mb}MB`);
} catch (e) {
  console.log(`   本番 health 取得失敗: ${e.message}`);
}

// ─── trend (audit-trend.csv の 直近 3 行) ─────────
const trendCsv = path.join(LOG_DIR, 'audit-trend.csv');
if (fs.existsSync(trendCsv)) {
  console.log('\n📈 audit trend (直近 3 日)');
  const lines = fs.readFileSync(trendCsv, 'utf-8').trim().split('\n');
  if (lines.length >= 1) console.log(`   ${lines[0]}`); // header
  const dataLines = lines.slice(1);
  dataLines.slice(-3).forEach(line => console.log(`   ${line}`));
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
