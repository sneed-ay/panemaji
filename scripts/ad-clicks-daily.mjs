#!/usr/bin/env node
/**
 * 広告クリック日次モニター
 *
 * ad_clicks テーブルから ad_type 別の日次クリック数を集計表示。
 *
 * 使い方:
 *   node scripts/ad-clicks-daily.mjs              # 直近14日 × 全 ad_type
 *   node scripts/ad-clicks-daily.mjs --days 30    # 直近30日
 *   node scripts/ad-clicks-daily.mjs --hourly     # 当日のみ時間別
 *   node scripts/ad-clicks-daily.mjs --by-page    # ページ別 Top
 *   DB_PATH=/tmp/panemaji-prod.db node ...        # 別DB指定
 *
 * 注意: ローカルDBには本番のクリックは含まれない。本番のDB集計は
 *   `gh release download db-latest --repo sneed-ay/panemaji` で
 *   db-latest を落としてから実行する。
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'panemaji.db');
const DAYS = parseInt(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || '14');
const HOURLY = process.argv.includes('--hourly');
const BY_PAGE = process.argv.includes('--by-page');

const db = new Database(DB_PATH, { readonly: true });

// ad_clicks テーブルは created_at が unix epoch ms
// JST 換算で日別集計するため (created_at/1000 + 9*3600) を unixepoch で日付化
const jstDate = `date(created_at/1000, 'unixepoch', '+9 hours')`;
const jstHour = `strftime('%Y-%m-%d %H:00', created_at/1000, 'unixepoch', '+9 hours')`;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 広告クリック日次モニター');
console.log(`   DB: ${DB_PATH}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 全体統計
const total = db.prepare('SELECT COUNT(*) c FROM ad_clicks').get();
console.log(`総クリック数: ${total.c.toLocaleString()}`);

if (total.c === 0) {
  console.log('\n  (まだクリックが記録されていません)');
  db.close();
  process.exit(0);
}

const earliest = db.prepare(`SELECT MIN(${jstDate}) d FROM ad_clicks`).get();
const latest = db.prepare(`SELECT MAX(${jstDate}) d FROM ad_clicks`).get();
console.log(`記録期間: ${earliest.d} 〜 ${latest.d} (JST)\n`);

if (HOURLY) {
  // 当日の時間別
  console.log(`📈 本日の時間別クリック (JST)\n`);
  const rows = db.prepare(`
    SELECT ${jstHour} hour, ad_type, COUNT(*) c
    FROM ad_clicks
    WHERE ${jstDate} = date('now', '+9 hours')
    GROUP BY hour, ad_type ORDER BY hour DESC, c DESC
  `).all();
  if (rows.length === 0) {
    console.log('  本日のクリックはまだありません');
  } else {
    let curHour = '';
    for (const r of rows) {
      if (r.hour !== curHour) {
        if (curHour) console.log();
        curHour = r.hour;
        console.log(`  ${r.hour}`);
      }
      console.log(`    ${r.ad_type.padEnd(10)}: ${r.c}`);
    }
  }
} else if (BY_PAGE) {
  // ページ別 Top
  console.log(`📄 ad_page 別 Top (直近 ${DAYS}日)\n`);
  const rows = db.prepare(`
    SELECT ad_page, ad_type, COUNT(*) c
    FROM ad_clicks
    WHERE created_at >= (strftime('%s','now')-86400*?)*1000 AND ad_page IS NOT NULL
    GROUP BY ad_page, ad_type ORDER BY c DESC LIMIT 30
  `).all(DAYS);
  console.log('  page                                 ad_type     clicks');
  console.log('  ' + '─'.repeat(60));
  for (const r of rows) {
    const page = (r.ad_page || '').padEnd(36).slice(0, 36);
    console.log(`  ${page} ${r.ad_type.padEnd(10)} ${String(r.c).padStart(6)}`);
  }
} else {
  // 日次×ad_type マトリクス
  console.log(`📅 日次クリック × ad_type (直近 ${DAYS}日)\n`);

  const days = db.prepare(`
    SELECT DISTINCT ${jstDate} d
    FROM ad_clicks
    WHERE created_at >= (strftime('%s','now')-86400*?)*1000
    ORDER BY d DESC
  `).all(DAYS).map(r => r.d);

  const types = db.prepare(`
    SELECT DISTINCT ad_type FROM ad_clicks ORDER BY ad_type
  `).all().map(r => r.ad_type);

  if (days.length === 0) {
    console.log('  この期間のクリックはありません');
    db.close();
    process.exit(0);
  }

  // ヘッダ
  const header = ['日付', ...types, '合計'];
  console.log('  ' + header.map((h, i) => i === 0 ? h.padEnd(12) : h.padStart(8)).join(' '));
  console.log('  ' + '─'.repeat(12 + (types.length + 1) * 9));

  // 行: 日付ごと
  const totalsByType = Object.fromEntries(types.map(t => [t, 0]));
  let grandTotal = 0;
  for (const day of days) {
    const counts = Object.fromEntries(types.map(t => [t, 0]));
    let dayTotal = 0;
    const rows = db.prepare(`
      SELECT ad_type, COUNT(*) c FROM ad_clicks
      WHERE ${jstDate} = ? GROUP BY ad_type
    `).all(day);
    for (const r of rows) {
      counts[r.ad_type] = r.c;
      totalsByType[r.ad_type] += r.c;
      dayTotal += r.c;
    }
    grandTotal += dayTotal;
    const line = [
      day.padEnd(12),
      ...types.map(t => String(counts[t] || 0).padStart(8)),
      String(dayTotal).padStart(8),
    ].join(' ');
    console.log('  ' + line);
  }

  // 合計行
  console.log('  ' + '─'.repeat(12 + (types.length + 1) * 9));
  const totalLine = [
    '合計'.padEnd(12),
    ...types.map(t => String(totalsByType[t]).padStart(8)),
    String(grandTotal).padStart(8),
  ].join(' ');
  console.log('  ' + totalLine);

  // 比率
  console.log();
  console.log('  期間内 ad_type 比率:');
  for (const t of types) {
    const pct = grandTotal > 0 ? (totalsByType[t] / grandTotal * 100).toFixed(1) : '0.0';
    console.log(`    ${t.padEnd(10)}: ${String(totalsByType[t]).padStart(6)} (${pct}%)`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 別 view:');
console.log('   --hourly    本日の時間別');
console.log('   --by-page   ページ別 Top');
console.log('   --days=30   期間変更');
console.log();
console.log('💡 本番DB で集計するには:');
console.log('   gh release download db-latest --repo sneed-ay/panemaji -O - | gunzip > /tmp/prod.db');
console.log('   DB_PATH=/tmp/prod.db node scripts/ad-clicks-daily.mjs');

db.close();
