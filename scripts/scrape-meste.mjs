#!/usr/bin/env node
/**
 * メンズエステサーチ (m-este.com) スクレイピング
 *
 * URL: /[pref-en]/  または /[pref-en]/[area]/
 * 店舗詳細: /shops/[ID]/
 * 店名: <h3 class="p-postList__title">店名</h3> (内 <a href="/shops/ID/"> から ID)
 *
 * 使い方:
 *   node scripts/scrape-meste.mjs --pref tokyo --dry-run
 *   node scripts/scrape-meste.mjs --all
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');

const BASE = 'https://m-este.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 1500;
const DELAY_JITTER = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);

// メンエスサーチの slug（panemaji 都道府県 → m-este URL slug）
const PREF_SLUG = {
  hokkaido: 'hokkaido', aomori: 'aomori', akita: 'akita', yamagata: 'yamagata', iwate: 'iwate', miyagi: 'miyagi', fukushima: 'fukushima',
  tokyo: 'tokyo', kanagawa: 'kanagawa', saitama: 'saitama', chiba: 'chiba', tochigi: 'tochigi', ibaraki: 'ibaraki', gunma: 'gunma',
  aichi: 'aichi', gifu: 'gifu', shizuoka: 'shizuoka', mie: 'mie', niigata: 'niigata', yamanashi: 'yamanashi', nagano: 'nagano', ishikawa: 'ishikawa', toyama: 'toyama', fukui: 'fukui',
  osaka: 'oosaka', hyogo: 'hyogo', kyoto: 'kyoto', shiga: 'shiga', nara: 'nara', wakayama: 'wakayama',
  okayama: 'okayama', hiroshima: 'hiroshima', tottori: 'tottori', shimane: 'shimane', yamaguchi: 'yamaguchi',
  kagawa: 'kagawa', tokushima: 'tokushima', ehime: 'ehime', kochi: 'kochi',
  fukuoka: 'fukuoka', saga: 'saga', nagasaki: 'nagasaki', kumamoto: 'kumamoto', oita: 'oita', miyazaki: 'miyazaki', kagoshima: 'kagoshima', okinawa: 'okinawa',
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    all: args.includes('--all'),
    dryRun: args.includes('--dry-run'),
    pref: args.find((a, i) => args[i - 1] === '--pref') || null,
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

// 都道府県トップから「サブエリア」のリンク slug を抽出
function parseAreaLinks(html, prefSlug) {
  const areas = new Set();
  const re = new RegExp(`href="https://m-este\\.com/${prefSlug}/([a-z0-9_\\-]+)/"`, 'g');
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (slug.length >= 2) areas.add(slug);
  }
  return [...areas];
}

// 店舗一覧ページ から shops 抽出
function parseShops(html) {
  const shops = [];
  const seen = new Set();
  // <a href="https://m-este.com/shops/[ID]/" class="p-postList__link" ...> ... <h3 class="p-postList__title">\n<店名>\n</h3>
  const re = /href="https:\/\/m-este\.com\/shops\/(\d+)\/?"\s+class="p-postList__link"[\s\S]*?<h3\s+class="p-postList__title">\s*([^<]+?)\s*<\/h3>/g;
  let m;
  while ((m = re.exec(html))) {
    const shopId = m[1];
    const rawName = m[2].trim().replace(/\s+/g, ' ');
    if (!rawName || seen.has(shopId)) continue;
    if (/(グループ|Group)$/i.test(rawName)) continue;
    // 末尾の (メンズエステ) や (アジアンエステ) 等を削除
    const stripped = rawName.replace(/[\s　]*\([^)]+\)$/, '').trim();
    const cleaned = cleanShopName(stripped || rawName);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    seen.add(shopId);
    shops.push({ shopId, name: cleaned, rawName, url: `${BASE}/shops/${shopId}/` });
  }
  return shops;
}

async function scrapePref(db, pref, opts = {}) {
  const slug = PREF_SLUG[pref];
  if (!slug) return { fetched: 0, inserted: 0, skipped: 0 };
  // 都道府県トップ取得 → エリアリンク取得
  const topUrl = `${BASE}/${slug}/`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) {
    console.log(`  ${pref}: top取得失敗`);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }

  // 中間版: top page + サブエリア最大50件まで掘る (60%目標達成のため拡充)
  const areaSlugs = parseAreaLinks(topHtml, slug).slice(0, 50);
  console.log(`  ${pref}: top + ${areaSlugs.length}エリア (cap 50)`);

  const allShops = [...parseShops(topHtml)];
  const seen = new Set(allShops.map((s) => s.shopId));

  for (const a of areaSlugs) {
    await delay();
    const url = `${BASE}/${slug}/${a}/`;
    const html = await fetchPage(url);
    if (!html) continue;
    const newShops = parseShops(html).filter((s) => !seen.has(s.shopId));
    for (const s of newShops) seen.add(s.shopId);
    allShops.push(...newShops);
  }

  console.log(`     ${pref}: 取得${allShops.length}件`);

  if (opts.dryRun) {
    console.log(`     [dry-run] ${allShops.slice(0, 5).map((s) => s.name).join(', ')}`);
    return { fetched: allShops.length, inserted: 0, skipped: 0 };
  }

  const findShop = db.prepare(`
    SELECT s.id FROM shops s LEFT JOIN areas a ON s.area_id=a.id
    WHERE s.is_active=1 AND a.prefecture=? AND normalize_shop(s.name) = normalize_shop(?)
    LIMIT 1
  `);
  const insertShop = db.prepare(`
    INSERT INTO shops (name, area_id, category, source_url, last_seen_at)
    VALUES (?, ?, 'メンズエステ', ?, datetime('now'))
  `);
  const tempAreaSlug = `${pref}-meste-pending`;
  let area = db.prepare('SELECT id FROM areas WHERE slug=?').get(tempAreaSlug);
  if (!area) {
    const r = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, 999)').run(tempAreaSlug, tempAreaSlug, pref);
    area = { id: r.lastInsertRowid };
  }

  let inserted = 0, skipped = 0;
  const txn = db.transaction(() => {
    for (const s of allShops) {
      const exists = findShop.get(pref, s.name);
      if (exists) { skipped++; continue; }
      insertShop.run(s.name, area.id, s.url);
      inserted++;
    }
  });
  txn();
  console.log(`     INSERT${inserted} SKIP${skipped}`);
  return { fetched: allShops.length, inserted, skipped };
}

async function main() {
  const opts = parseArgs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');
  registerNormalizeUdf(db);

  const targets = [];
  if (opts.all) {
    for (const pref of Object.keys(PREF_SLUG)) targets.push(pref);
  } else if (opts.pref) {
    targets.push(opts.pref);
  } else {
    console.error('使い方: --pref tokyo | --all  [--dry-run]');
    process.exit(1);
  }

  console.log(`💆 m-este scrape: ${targets.length} pref (dry-run=${opts.dryRun})\n`);

  let totalIns = 0, totalSkip = 0, totalFetch = 0;
  for (const pref of targets) {
    const r = await scrapePref(db, pref, opts);
    totalFetch += r.fetched;
    totalIns += r.inserted;
    totalSkip += r.skipped;
    await delay();
  }

  db.close();
  console.log(`\n=== 完了 ===\nfetch: ${totalFetch} / INSERT: ${totalIns} / SKIP: ${totalSkip}`);
}

main().catch((e) => { console.error('❌', e.message); console.error(e.stack); process.exit(1); });
