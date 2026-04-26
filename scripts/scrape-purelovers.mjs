#!/usr/bin/env node
/**
 * ぴゅあらば (purelovers.com) スクレイピング
 *
 * 使い方:
 *   node scripts/scrape-purelovers.mjs --dry-run
 *   node scripts/scrape-purelovers.mjs --pref tokyo --biz b3
 *   node scripts/scrape-purelovers.mjs --all
 *
 * URL: /b[N]/p[M]/  (b=業種, p=都道府県)
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');

const BASE = 'https://purelovers.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 2000;
const DELAY_JITTER = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);

const PREF_ID = {
  hokkaido: 1, aomori: 2, akita: 3, yamagata: 4, iwate: 5, miyagi: 6, fukushima: 7,
  tokyo: 8, kanagawa: 9, saitama: 10, chiba: 11, tochigi: 12, ibaraki: 13, gunma: 14,
  aichi: 15, gifu: 16, shizuoka: 17, mie: 18, niigata: 19, yamanashi: 20, nagano: 21, ishikawa: 22, toyama: 23, fukui: 24,
  osaka: 25, hyogo: 26, kyoto: 27, shiga: 28, nara: 29, wakayama: 30,
  okayama: 31, hiroshima: 32, tottori: 33, shimane: 34, yamaguchi: 35,
  kagawa: 36, tokushima: 37, ehime: 38, kochi: 39,
  fukuoka: 40, saga: 41, nagasaki: 42, kumamoto: 43, oita: 44, miyazaki: 45, kagoshima: 46, okinawa: 47,
};

const BIZ_MAP = {
  b1: 'デリヘル',
  b2: 'ホテヘル',
  b3: 'ソープ',
  b4: 'ヘルス',
  b5: 'エステ・アロマ',
  b6: 'ピンサロ',
  b7: 'セクキャバ',
  b8: '女性用風俗',
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    all: args.includes('--all'),
    dryRun: args.includes('--dry-run'),
    pref: args.find((a, i) => args[i - 1] === '--pref') || null,
    biz: args.find((a, i) => args[i - 1] === '--biz') || null,
  };
}

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
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

function parseShops(html) {
  const shops = [];
  const seen = new Set();
  // shop block: href="https://purelovers.com/shop/[ID]/" 直近に <p class="k_text ... k_clamp-1 ...">店名</p>
  // alt="店名/エリア/業種" にも店名がある
  // パターン1: alt="店名/..." → 店名取得
  const re1 = /href="https:\/\/purelovers\.com\/shop\/(\d+)\/"[^>]*>[\s\S]{0,2000}?alt="([^/"\n]+?)\/[^"]*"/g;
  let m;
  while ((m = re1.exec(html))) {
    const shopId = m[1];
    const rawName = m[2].trim().replace(/\s+/g, ' ');
    if (!rawName || seen.has(shopId)) continue;
    if (/(グループ|Group)$/i.test(rawName)) continue;
    const cleaned = cleanShopName(rawName);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    seen.add(shopId);
    shops.push({ shopId, name: cleaned, rawName, url: `${BASE}/shop/${shopId}/` });
  }
  return shops;
}

async function scrapePrefBiz(db, pref, bizCode, opts = {}) {
  const prefId = PREF_ID[pref];
  if (!prefId) return { fetched: 0, inserted: 0, skipped: 0 };
  const category = BIZ_MAP[bizCode];
  if (!category) return { fetched: 0, inserted: 0, skipped: 0 };
  const url = `${BASE}/${bizCode}/p${prefId}/`;
  const html = await fetchPage(url);
  if (!html) return { fetched: 0, inserted: 0, skipped: 0 };
  const shops = parseShops(html);
  console.log(`  ${pref}(${prefId}) ${bizCode}(${category}): ${shops.length}件`);
  if (opts.dryRun) {
    if (shops.length > 0) console.log(`     [dry-run] ${shops.slice(0, 3).map((s) => s.name).join(', ')}`);
    return { fetched: shops.length, inserted: 0, skipped: 0 };
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
  const tempAreaSlug = `${pref}-pl-pending`;
  let area = db.prepare('SELECT id FROM areas WHERE slug=?').get(tempAreaSlug);
  if (!area) {
    const r = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, 999)').run(tempAreaSlug, tempAreaSlug, pref);
    area = { id: r.lastInsertRowid };
  }
  let inserted = 0, skipped = 0;
  const txn = db.transaction(() => {
    for (const s of shops) {
      const exists = findShop.get(pref, s.name);
      if (exists) { skipped++; continue; }
      insertShop.run(s.name, area.id, category, s.url);
      inserted++;
    }
  });
  txn();
  if (inserted > 0 || skipped > 0) console.log(`     INSERT${inserted} SKIP${skipped}`);
  return { fetched: shops.length, inserted, skipped };
}

async function main() {
  const opts = parseArgs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');
  registerNormalizeUdf(db);

  const targets = [];
  if (opts.all) {
    for (const pref of Object.keys(PREF_ID)) for (const biz of Object.keys(BIZ_MAP)) targets.push({ pref, biz });
  } else if (opts.pref && opts.biz) {
    targets.push({ pref: opts.pref, biz: opts.biz });
  } else if (opts.pref) {
    for (const biz of Object.keys(BIZ_MAP)) targets.push({ pref: opts.pref, biz });
  } else {
    console.error('使い方: --pref tokyo [--biz b3] | --all  [--dry-run]');
    process.exit(1);
  }

  console.log(`💗 ぴゅあらば scrape: ${targets.length} ターゲット (dry-run=${opts.dryRun})\n`);

  let totalIns = 0, totalSkip = 0, totalFetch = 0;
  for (const t of targets) {
    const r = await scrapePrefBiz(db, t.pref, t.biz, opts);
    totalFetch += r.fetched;
    totalIns += r.inserted;
    totalSkip += r.skipped;
    await delay();
  }

  db.close();
  console.log(`\n=== 完了 ===\nfetch: ${totalFetch} / INSERT: ${totalIns} / SKIP: ${totalSkip}`);
}

main().catch((e) => { console.error('❌', e.message); console.error(e.stack); process.exit(1); });
