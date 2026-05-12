#!/usr/bin/env node
/**
 * panemaji.com cache pre-warm script
 *
 * deploy 後 or ISR revalidate (30min) 期限切れ後の cold-cache を 防ぐため、
 * 主要 60〜80 ページに HTTP リクエストを 送って ISR cache を 構築する。
 *
 * 使い方:
 *   node scripts/prewarm-cache.mjs               # 主要ページ pre-warm
 *   BASE=http://localhost:3033 node scripts/...  # ローカル prod テスト
 *
 * cron 等で 25 分に 1 回程度 回せば、 30分 ISR の cache が ずっと 暖かい。
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const BASE = process.env.BASE || 'https://panemaji.com';
const UA = 'Mozilla/5.0 (panemaji-prewarm/1.0)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchUrl(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    const dt = Date.now() - t0;
    return { ok: r.ok, status: r.status, ms: dt };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');

  console.log(`🔥 pre-warm cache for ${BASE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1) 主要 prefecture (人気上位 20)
  const prefs = db.prepare(`
    SELECT a.prefecture, COUNT(DISTINCT s.id) AS n
    FROM areas a JOIN shops s ON s.area_id=a.id
    WHERE s.is_active=1 GROUP BY a.prefecture
    ORDER BY n DESC LIMIT 20
  `).all();

  // 2) 主要 area (shop_count 多い順 50)
  const areas = db.prepare(`
    SELECT a.slug, COUNT(DISTINCT s.id) AS n
    FROM areas a JOIN shops s ON s.area_id=a.id
    WHERE s.is_active=1 GROUP BY a.slug
    ORDER BY n DESC LIMIT 50
  `).all();

  // 3) 主要 shop (review_count 多い順 20)
  const shops = db.prepare(`
    SELECT s.id, COUNT(r.id) AS rc
    FROM shops s
    JOIN girls g ON g.shop_id=s.id
    JOIN reviews r ON r.girl_id=g.id
    WHERE s.is_active=1
    GROUP BY s.id ORDER BY rc DESC LIMIT 20
  `).all();

  db.close();

  // URL リスト 構築 (優先度順)
  const urls = [
    '/',
    '/ranking',
    ...prefs.map(p => `/${p.prefecture}`),
    ...areas.map(a => `/area/${a.slug}`),
    ...shops.map(s => `/shop/${s.id}`),
  ];

  console.log(`  対象: ${urls.length} URL`);
  console.log();

  // 順次 hit (Render Starter 0.5 CPU の ISR rebuild 競合 防止)
  // 並列にすると 7-22s に 悪化、 過去事故あり (2026-05-13)
  const results = [];
  for (const u of urls) {
    const r = await fetchUrl(`${BASE}${u}`);
    results.push({ url: u, ...r });
    const mark = r.ok ? '✓' : '✗';
    const ms = r.ms.toString().padStart(5);
    console.log(`  ${mark} ${ms}ms  ${u}`);
    // ISR build を 1個ずつ 終わらせる ため 短い間隔
    await sleep(800);
  }

  const ok = results.filter(r => r.ok).length;
  const slow = results.filter(r => r.ms > 3000).length;
  const avg = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length);

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ pre-warm 完了: ${ok}/${results.length} 成功 / 平均 ${avg}ms / >3s: ${slow}件`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => { console.error('💀', e); process.exit(1); });
