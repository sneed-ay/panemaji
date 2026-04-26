#!/usr/bin/env node
/**
 * 駅ちか人気！風俗ランキング (ranking-deli.jp) スクレイピング
 *
 * 使い方:
 *   node scripts/scrape-rankingdeli.mjs --pref tokyo --style style5 --dry-run
 *   node scripts/scrape-rankingdeli.mjs --pref tokyo
 *   node scripts/scrape-rankingdeli.mjs --all [--dry-run]
 *
 * URL:
 *   /fuzoku/style[N]/[prefId]/  → 都道府県×業種
 *   /fuzoku/[prefId]/area[N]/   → エリア（後で対応）
 *
 * 仕様:
 *   - shops.name は必ず cleanShopName() 経由
 *   - エリア: 駅ちか area 系の細かい分類は使わず、都道府県の {pref}-other に振り分け（細分マッピング後付け）
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');

const BASE = 'https://ranking-deli.jp';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 2000;
const DELAY_JITTER = 1500;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);

// 駅ちか pref ID
const PREF_ID = {
  hokkaido: 1, aomori: 2, akita: 3, yamagata: 4, iwate: 5, miyagi: 6, fukushima: 7,
  tokyo: 8, kanagawa: 9, saitama: 10, chiba: 11, tochigi: 12, ibaraki: 13, gunma: 14,
  aichi: 15, gifu: 16, shizuoka: 17, mie: 18, niigata: 19, yamanashi: 20, nagano: 21, ishikawa: 22, toyama: 23, fukui: 24,
  osaka: 25, hyogo: 26, kyoto: 27, shiga: 28, nara: 29, wakayama: 30,
  okayama: 31, hiroshima: 32, tottori: 33, shimane: 34, yamaguchi: 35,
  kagawa: 36, tokushima: 37, ehime: 38, kochi: 39,
  fukuoka: 40, saga: 41, nagasaki: 42, kumamoto: 43, oita: 44, miyazaki: 45, kagoshima: 46, okinawa: 47,
};

const STYLE_MAP = {
  style1: 'ホテヘル',
  style3: 'ヘルス',
  style4: 'ピンサロ',
  style5: 'ソープ',
  style7: 'エステ・アロマ',
  style8: 'メンズエステ',
  // ベース (デリヘル) は /fuzoku/[prefId]/ で取得
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    all: args.includes('--all'),
    dryRun: args.includes('--dry-run'),
    pref: args.find((a, i) => args[i - 1] === '--pref') || null,
    style: args.find((a, i) => args[i - 1] === '--style') || null,
  };
}

async function fetchPage(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      // 404 等のクライアントエラーは「該当データなし」とみなして即スキップ
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.error(`  retry ${i + 1}/${retries}: ${url} - ${e.message}`);
      await sleep(3000 * (i + 1));
    }
  }
  return null;
}

function parseShops(html, pref, prefId) {
  const shops = [];
  const seen = new Set();
  // <a class="head-shopName u-ellipsis" href="https://ranking-deli.jp/fuzoku/styleN/PID/shop/SID/">店名</a>
  const re = /<a\s+class="head-shopName[^"]*"\s+href="([^"]+)">([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    const rawName = m[2].trim().replace(/\s+/g, ' ');
    if (!rawName) continue;
    const idMatch = url.match(/\/shop\/(\d+)/);
    if (!idMatch) continue;
    const shopId = idMatch[1];
    if (seen.has(shopId)) continue;
    if (/(グループ|Group)$/i.test(rawName)) continue;
    const cleaned = cleanShopName(rawName);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    seen.add(shopId);
    shops.push({ shopId, name: cleaned, rawName, url });
  }
  // パターン2: shopList-item-shopName / item-shopName
  const re2 = /<p\s+class="(?:shopList-)?item-shopName[^"]*">([^<]+)</g;
  while ((m = re2.exec(html))) {
    const rawName = m[1].trim().replace(/\s+/g, ' ');
    if (!rawName) continue;
    if (/(グループ|Group)$/i.test(rawName)) continue;
    const cleaned = cleanShopName(rawName);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    // shopId 不明なので name で seen チェック
    const key = `name:${cleaned}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shops.push({ shopId: null, name: cleaned, rawName, url: null });
  }
  return shops;
}

async function scrapePrefStyle(db, pref, styleCode, opts = {}) {
  const prefId = PREF_ID[pref];
  if (!prefId) {
    console.error(`  ❌ 未知のpref: ${pref}`);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }
  const category = styleCode === 'base' ? 'デリヘル' : STYLE_MAP[styleCode];
  if (!category) {
    console.error(`  ❌ 未知のstyle: ${styleCode}`);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }
  const url =
    styleCode === 'base'
      ? `${BASE}/fuzoku/${prefId}/`
      : `${BASE}/fuzoku/${styleCode}/${prefId}/`;
  console.log(`  📂 ${pref}(${prefId}) ${styleCode}(${category}): GET ${url}`);
  const html = await fetchPage(url);
  if (!html) {
    console.error(`  ❌ fetch失敗`);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }
  const shops = parseShops(html, pref, prefId);
  console.log(`     取得: ${shops.length} 件`);
  if (opts.dryRun) {
    console.log(`     [dry-run] ${shops.slice(0, 5).map((s) => s.name).join(', ')}...`);
    return { fetched: shops.length, inserted: 0, skipped: 0 };
  }

  // 一時エリアID取得（{pref}-rdとして仮置き、後で MECE マイグレーション）
  const tempAreaSlug = `${pref}-rd-pending`;
  let area = db.prepare('SELECT id FROM areas WHERE slug=?').get(tempAreaSlug);
  if (!area) {
    const ins = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, 999)');
    const r = ins.run(tempAreaSlug, tempAreaSlug, pref);
    area = { id: r.lastInsertRowid };
  }

  const findShop = db.prepare(`
    SELECT s.id FROM shops s LEFT JOIN areas a ON s.area_id=a.id
    WHERE s.is_active=1 AND a.prefecture=? AND normalize_shop(s.name) = normalize_shop(?)
    LIMIT 1
  `);
  const insertShop = db.prepare(`
    INSERT INTO shops (name, area_id, category, source_url, last_seen_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  let inserted = 0, skipped = 0;
  const txn = db.transaction(() => {
    for (const s of shops) {
      const exists = findShop.get(pref, s.name);
      if (exists) { skipped++; continue; }
      insertShop.run(s.name, area.id, category, s.url || null);
      inserted++;
    }
  });
  txn();

  console.log(`     ✅ INSERT: ${inserted}, SKIP(既存): ${skipped}`);
  return { fetched: shops.length, inserted, skipped };
}

async function main() {
  const opts = parseArgs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');
  registerNormalizeUdf(db);

  const styles = ['base', ...Object.keys(STYLE_MAP)]; // base=デリヘル
  const targets = [];
  if (opts.all) {
    for (const pref of Object.keys(PREF_ID)) for (const st of styles) targets.push({ pref, style: st });
  } else if (opts.pref && opts.style) {
    targets.push({ pref: opts.pref, style: opts.style });
  } else if (opts.pref) {
    for (const st of styles) targets.push({ pref: opts.pref, style: st });
  } else {
    console.error('使い方: --pref tokyo [--style style5] | --all  [--dry-run]');
    process.exit(1);
  }

  console.log(`🚇 駅ちか scrape: ${targets.length} ターゲット (dry-run=${opts.dryRun})\n`);

  let totalIns = 0, totalSkip = 0, totalFetch = 0;
  for (const t of targets) {
    const r = await scrapePrefStyle(db, t.pref, t.style, opts);
    totalFetch += r.fetched;
    totalIns += r.inserted;
    totalSkip += r.skipped;
    await delay();
  }

  db.close();
  console.log(`\n=== 完了サマリー ===`);
  console.log(`fetch: ${totalFetch} / INSERT: ${totalIns} / SKIP(既存重複): ${totalSkip}`);
}

main().catch((e) => {
  console.error('❌ error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
