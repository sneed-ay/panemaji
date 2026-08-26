#!/usr/bin/env node
/**
 * panemaji daily-audit — 日次本番監視 (read-only)
 *
 * 目的:
 *   1日1回 (scheduled-task `panemaji-daily-audit` が呼ぶ) で
 *   本番の速度・健全性・データ鮮度を点検し、 alerts と suggestions を JSON で出力。
 *
 * 出力先:
 *   - 標準出力: JSON 1行 (タスクから parse する)
 *   - ファイル: logs/audit-YYYYMMDD.json (履歴保持)
 *
 * 使い方:
 *   node scripts/daily-audit.mjs            # 通常実行
 *   node scripts/daily-audit.mjs --verbose  # 人間向け表示も併用
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
// マスターDBは $HOME/panemaji-data (2026-06-10 に Google Drive 外へ移設済)。
// PROJECT_ROOT/panemaji.db は 8/21 で更新が止まった破損コピーで、
// これを見ていたため監査が毎日 red (integrity failed) を出し data_freshness も常に null だった。
// daily-maintenance.sh の既定と揃える (2026-08-26 修正)。
const DEFAULT_DB = path.join(process.env.HOME || '', 'panemaji-data', 'panemaji.db');
const DB_PATH =
  process.env.DB_PATH || (fs.existsSync(DEFAULT_DB) ? DEFAULT_DB : path.join(PROJECT_ROOT, 'panemaji.db'));
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

const PROD_BASE = 'https://panemaji.com';
const VERBOSE = process.argv.includes('--verbose');

// ─── 速度測定対象 ─────────────────────────────────────
// 各 URL を warmup (1 回叩いて捨てる) → measure (本番計測) で TTFB 取得。
// max_ms は warm 状態の目標。 cold 値も別途記録するが alert は warm のみ。
const SPEED_TARGETS = [
  { path: '/',                              label: 'home',       max_ms: 1500 },
  { path: '/area/shinjuku',                 label: 'area-top',   max_ms: 2000 },
  { path: '/area/shinjuku?cat=deriheru',    label: 'area-cat',   max_ms: 2500 },
  { path: '/tokyo',                         label: 'pref-top',   max_ms: 2500 },
  { path: '/sitemap.xml',                   label: 'sitemap',    max_ms: 4000 },
  { path: '/api/health',                    label: 'health-api', max_ms: 500  },
];

// ─── 補助 ─────────────────────────────────────────
async function measureUrl(fullUrl, opts = {}) {
  const timeout = opts.timeout ?? 15000;
  const start = Date.now();
  let ok = false, status = 0, ttfb = 0, total = 0, bytes = 0, err = null;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    const res = await fetch(fullUrl, { redirect: 'follow', signal: ac.signal });
    // ★ ここが TTFB: response headers が返ってきた瞬間
    ttfb = Date.now() - start;
    status = res.status;
    ok = res.ok;
    // body は cancel して捨てる (TTFB 計測が目的なので body 受信時間は含めない)
    // sitemap 等の巨大 response を Node に流し込むと measureUrl 自体が遅延し、
    // 「サーバが遅い」 と誤判定する原因になる (curl -o /dev/null 相当の挙動が欲しい)
    if (res.body) {
      try { await res.body.cancel(); } catch {}
    }
    total = Date.now() - start;
    clearTimeout(t);
  } catch (e) {
    err = e.message || String(e);
    ttfb = Date.now() - start;
    total = ttfb;
  }
  return { url: fullUrl, ok, status, ttfb_ms: ttfb, total_ms: total, bytes, err };
}

function isLegacySlug(slug) {
  if (!slug) return false;
  return /-(pending|fj-.+|ch-A.+|rd-.+|pl-.+|meste-.+|robin-.+|a\d{4,})$/.test(slug);
}

// ─── main ─────────────────────────────────────────
async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    timestamp_jst: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    version: 1,
    speed: [],
    prod_health: null,
    db_integrity: null,
    data_freshness: null,
    cron_status: null,
    alerts: [],     // 即時対応必要
    warnings: [],   // 監視対象 / 改善余地
    suggestions: [],// 「これやろうぜ」レベル
  };

  // ─── 1. 速度測定 (本番 endpoint) — cold + warm ─────────
  // 1 回目で Cloudflare cache miss / Render container warmup を吸収。
  // 2 回目を本計測 (実ユーザーの感覚に近い)。
  for (const t of SPEED_TARGETS) {
    const cold = await measureUrl(PROD_BASE + t.path, { timeout: 30000 });
    // 1 秒空けて再計測 (CF edge cache が cold response を保存する時間を与える)
    await new Promise(r => setTimeout(r, 1000));
    const warm = await measureUrl(PROD_BASE + t.path, { timeout: 15000 });
    const entry = {
      label: t.label,
      path: t.path,
      ok: warm.ok,
      status: warm.status,
      ttfb_ms: warm.ttfb_ms,         // ← warm 値を本計測とする
      ttfb_cold_ms: cold.ttfb_ms,
      bytes: warm.bytes,
      max_ms: t.max_ms,
      slow: warm.ok && warm.ttfb_ms > t.max_ms,
      cold_slow: cold.ok && cold.ttfb_ms > t.max_ms * 4, // cold は 4 倍まで許容
      err: warm.err || cold.err,
    };
    report.speed.push(entry);
    if (!warm.ok) report.alerts.push(`speed/${t.label}: HTTP ${warm.status || 'err'} ${warm.err ? `(${warm.err})` : ''}`);
    else if (entry.slow) report.warnings.push(`speed/${t.label}: warm ${warm.ttfb_ms}ms > ${t.max_ms}ms (${t.path})`);
    if (entry.cold_slow) report.suggestions.push(`speed/${t.label}: cold ${cold.ttfb_ms}ms — Cloudflare cache または Render Starter cold start で長すぎる可能性`);
  }

  // ─── 2. 本番 health endpoint の中身 ───────────────────
  const healthEntry = report.speed.find(s => s.label === 'health-api');
  if (healthEntry?.ok) {
    try {
      const h = await fetch(PROD_BASE + '/api/health').then(r => r.json());
      report.prod_health = h;
      if (h.rss_pct >= 90) report.alerts.push(`prod RSS critical: ${h.rss_pct}% (${h.rss_mb}/${h.rss_limit_mb}MB)`);
      else if (h.rss_pct >= 80) report.warnings.push(`prod RSS high: ${h.rss_pct}%`);
      if (h.uptime_sec < 600) report.warnings.push(`prod recently restarted: uptime ${Math.round(h.uptime_sec)}s`);
      // external_mb が heap より大きければ external leak の兆候
      if (h.external_mb > h.heap_used_mb * 1.2) {
        report.suggestions.push(`external memory (${h.external_mb}MB) > heap (${h.heap_used_mb}MB) — sitemap stream / native binding 由来 leak の可能性`);
      }
    } catch (e) {
      report.warnings.push(`prod_health JSON parse failed: ${e.message}`);
    }
  }

  // ─── 3. DB integrity (CLAUDE.md の 4 ルール) ──────────
  if (fs.existsSync(DB_PATH)) {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const areas = db.prepare('SELECT COUNT(*) c FROM areas').get().c;
      const legacy = db.prepare(`
        SELECT slug FROM areas
        WHERE slug LIKE '%-pending' OR slug LIKE '%-fj-%' OR slug LIKE '%-ch-A%'
           OR slug LIKE '%-rd-%' OR slug LIKE '%-pl-%' OR slug LIKE '%-meste-%' OR slug LIKE '%-robin-%'
           OR slug GLOB '*-a[0-9][0-9][0-9][0-9]'
      `).all();
      const dupShopsCount = db.prepare(`
        SELECT COUNT(*) FROM (
          SELECT name, category, COUNT(*) c FROM shops WHERE is_active=1 GROUP BY name, category HAVING c > 1
        )
      `).get();
      const dupShops = Object.values(dupShopsCount)[0];
      const shops = db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active=1').get().c;
      const girls = db.prepare('SELECT COUNT(*) c FROM girls WHERE is_active=1').get().c;
      const reviews = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
      // 画像カバレッジ — 嬢ページ品質の重要指標
      const girlsWithImg = db.prepare(`SELECT COUNT(*) c FROM girls WHERE is_active=1 AND image_url IS NOT NULL AND image_url != ''`).get().c;
      const girlImagePct = girls > 0 ? Math.round((girlsWithImg / girls) * 1000) / 10 : 0;
      report.db_integrity = {
        areas, legacy_slugs: legacy.length, dup_shops: dupShops,
        shops_active: shops, girls_active: girls, reviews,
        girl_image_pct: girlImagePct,
        girls_no_image: girls - girlsWithImg,
      };
      if (girlImagePct < 70) report.warnings.push(`嬢の画像カバレッジが ${girlImagePct}% (${girls - girlsWithImg}人 画像なし) — fill-missing-images-safe.mjs を 検討`);
      if (areas !== 325) report.alerts.push(`areas count = ${areas} (CLAUDE.md ルール: 325 固定) → migrate-areas-mece --apply 必要`);
      if (legacy.length > 0) report.alerts.push(`legacy area slug ${legacy.length} 件残存: ${legacy.slice(0, 5).map(r => r.slug).join(', ')}${legacy.length > 5 ? ' …' : ''}`);
      if (dupShops > 0) report.alerts.push(`shop 重複 ${dupShops} グループ → merge-duplicate-shops --apply 必要`);
    } catch (e) {
      report.alerts.push(`DB integrity check failed: ${e.message}`);
    } finally {
      db.close();
    }
  } else {
    report.warnings.push(`local DB ${DB_PATH} 不在 — 監視 skip`);
  }

  // ─── 4. データ鮮度 (last_seen_at 最新) ──────────────────
  if (fs.existsSync(DB_PATH)) {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      const newestShop = db.prepare(`SELECT MAX(last_seen_at) m FROM shops WHERE is_active=1`).get().m;
      const newestGirl = db.prepare(`SELECT MAX(last_seen_at) m FROM girls WHERE is_active=1`).get().m;
      const newestReview = db.prepare(`SELECT MAX(created_at) m FROM reviews`).get().m;
      const ageH = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : null;
      const ageShopH = ageH(newestShop);
      const ageGirlH = ageH(newestGirl);
      const ageReviewH = ageH(newestReview);
      report.data_freshness = {
        newest_shop: newestShop, newest_shop_age_h: ageShopH ? +ageShopH.toFixed(1) : null,
        newest_girl: newestGirl, newest_girl_age_h: ageGirlH ? +ageGirlH.toFixed(1) : null,
        newest_review: newestReview, newest_review_age_h: ageReviewH ? +ageReviewH.toFixed(1) : null,
      };
      if (ageShopH != null && ageShopH > 36) report.warnings.push(`shop データが古い: 最新 last_seen_at が ${ageShopH.toFixed(1)}h 前 — 取込 cron が回ってない可能性`);
      if (ageGirlH != null && ageGirlH > 36) report.warnings.push(`girl データが古い: 最新 last_seen_at が ${ageGirlH.toFixed(1)}h 前`);
    } catch (e) {
      report.warnings.push(`data freshness check failed: ${e.message}`);
    } finally {
      db.close();
    }
  }

  // ─── 5. cron 履歴 (GitHub Release / scheduled-task) ─────
  // GitHub Release db-latest の updated_at は gh CLI が必要。 Network なら直接 API 叩く。
  try {
    const ghRel = await fetch('https://api.github.com/repos/sneed-ay/panemaji/releases/tags/db-latest', {
      headers: { Accept: 'application/vnd.github+json' },
    }).then(r => r.json());
    const asset = (ghRel.assets || []).find(a => a.name === 'panemaji.db.gz');
    if (asset) {
      const ageH = (Date.now() - new Date(asset.updated_at).getTime()) / 3600000;
      report.cron_status = {
        github_release_db_latest: asset.updated_at,
        age_h: +ageH.toFixed(1),
        size_mb: +(asset.size / 1024 / 1024).toFixed(1),
      };
      if (ageH > 36) report.alerts.push(`GitHub Release db-latest が ${ageH.toFixed(1)}h 前 — daily 取込が止まってる可能性 (scheduled-task / GH Actions 確認)`);
      else if (ageH > 28) report.warnings.push(`GitHub Release db-latest ${ageH.toFixed(1)}h 前 — 1 日 1 回回ってればギリ OK だがマージン少ない`);
    }
  } catch (e) {
    report.warnings.push(`GitHub Release 確認 failed: ${e.message}`);
  }

  // ─── 5b. GSC ADC auth 期限切れ チェック (2026-05-17 追加) ─────────────
  //   過去事例: 5/11-16 で ADC token expire → 5日 GSC data ロス。 早期検知 必要。
  try {
    const { execSync } = await import('child_process');
    const result = execSync('gcloud auth application-default print-access-token 2>&1', { encoding: 'utf8', timeout: 15000 });
    if (result.includes('Reauthentication failed') || result.includes('expired') || result.includes('ERROR')) {
      report.alerts.push(`GSC ADC 認証 期限切れ — gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/cloud-platform 再実行 必要`);
    }
  } catch (e) {
    if (e.message.includes('Reauthentication failed') || e.stdout?.includes('Reauthentication')) {
      report.alerts.push(`GSC ADC 認証 期限切れ — gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/cloud-platform 再実行 必要`);
    } else if (!e.message.includes('command not found')) {
      report.warnings.push(`GSC auth 確認 failed: ${e.message.slice(0, 80)}`);
    }
  }

  // ─── 6. サマリ ────────────────────────────────────
  report.summary = {
    alerts: report.alerts.length,
    warnings: report.warnings.length,
    suggestions: report.suggestions.length,
    overall: report.alerts.length === 0 ? (report.warnings.length === 0 ? 'green' : 'yellow') : 'red',
  };

  // ─── 出力 ─────────────────────────────────────────
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outFile = path.join(LOG_DIR, `audit-${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  // ─── 7. 日次 trend CSV に append (日次変化を後から 分析できる) ─────
  // 1 行 1 日。 列: timestamp, overall, alerts, warnings, speed_home_ms, rss_pct, areas, dup_shops, db_age_h
  const trendCsv = path.join(LOG_DIR, 'audit-trend.csv');
  const home = report.speed.find(s => s.label === 'home');
  const csvCols = [
    report.timestamp_jst,
    report.summary.overall,
    report.summary.alerts,
    report.summary.warnings,
    home?.ttfb_ms ?? '',
    report.prod_health?.rss_pct ?? '',
    report.db_integrity?.areas ?? '',
    report.db_integrity?.dup_shops ?? '',
    report.cron_status?.age_h ?? '',
    report.db_integrity?.girl_image_pct ?? '',
    report.db_integrity?.girls_no_image ?? '',
  ];
  const csvLine = csvCols.map(v => String(v).replace(/[\n,]/g, ' ')).join(',') + '\n';
  try {
    if (!fs.existsSync(trendCsv)) {
      fs.writeFileSync(trendCsv, 'timestamp_jst,overall,alerts,warnings,home_ttfb_ms,rss_pct,areas,dup_shops,db_age_h,girl_image_pct,girls_no_image\n');
    }
    fs.appendFileSync(trendCsv, csvLine);
  } catch (e) {
    // append 失敗しても 本処理には影響させない
    console.error('[warn] trend csv append failed:', e.message);
  }

  if (VERBOSE) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🩺 panemaji daily-audit  [${report.summary.overall.toUpperCase()}]`);
    console.log(`   ${report.timestamp_jst}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚡ 速度 (TTFB)');
    for (const s of report.speed) {
      const mark = !s.ok ? '❌' : s.slow ? '🐢' : '✅';
      console.log(`  ${mark} ${s.label.padEnd(12)} ${String(s.ttfb_ms).padStart(5)}ms  (max ${s.max_ms}ms)  ${s.path}`);
    }
    if (report.prod_health) {
      const h = report.prod_health;
      console.log(`\n💾 本番 health  uptime=${(h.uptime_sec / 3600).toFixed(1)}h  rss=${h.rss_mb}MB (${h.rss_pct}%)  external=${h.external_mb}MB`);
    }
    if (report.db_integrity) {
      const d = report.db_integrity;
      console.log(`\n🗄️  DB  shops=${d.shops_active}  girls=${d.girls_active}  reviews=${d.reviews}  areas=${d.areas}  dup_shops=${d.dup_shops}  legacy_slugs=${d.legacy_slugs}`);
      console.log(`   嬢の画像カバレッジ: ${d.girl_image_pct}% (${d.girls_no_image} 人画像なし)`);
    }
    if (report.data_freshness) {
      const f = report.data_freshness;
      console.log(`\n🕒 鮮度  shop ${f.newest_shop_age_h}h  girl ${f.newest_girl_age_h}h  review ${f.newest_review_age_h}h 前`);
    }
    if (report.cron_status) {
      const c = report.cron_status;
      console.log(`\n🔁 cron  GH Release db-latest: ${c.age_h}h 前 (${c.size_mb}MB)`);
    }
    if (report.alerts.length > 0) {
      console.log('\n🚨 ALERTS');
      report.alerts.forEach(a => console.log(`  • ${a}`));
    }
    if (report.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS');
      report.warnings.forEach(w => console.log(`  • ${w}`));
    }
    if (report.suggestions.length > 0) {
      console.log('\n💡 SUGGESTIONS');
      report.suggestions.forEach(s => console.log(`  • ${s}`));
    }
    console.log(`\n  → ${outFile}`);
  } else {
    // task が parse する用 (1 line JSON)
    console.log(JSON.stringify(report));
  }

  // alerts ありなら exit 2 (task 側で「要対応」と判断)
  process.exit(report.alerts.length > 0 ? 2 : 0);
}

main().catch(e => {
  console.error(JSON.stringify({ fatal: e.message, stack: e.stack }));
  process.exit(1);
});
