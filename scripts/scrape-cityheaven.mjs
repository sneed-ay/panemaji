#!/usr/bin/env node
/**
 * シティヘブン (cityheaven.net) スクレイピング
 *
 * 使い方:
 *   node scripts/scrape-cityheaven.mjs --pref tokyo --biz biz4    # 単一 pref+biz
 *   node scripts/scrape-cityheaven.mjs --pref tokyo --biz biz4 --dry-run
 *   node scripts/scrape-cityheaven.mjs --all                       # 全47都道府県×全業種
 *   node scripts/scrape-cityheaven.mjs --all --dry-run
 *
 * 仕様:
 *   - 軽量版: fetch + 正規表現 (puppeteer不使用)
 *   - 年齢確認: ?nenrei=y を全URL付与
 *   - レート制限: 2.0-3.5秒/リクエスト
 *   - shops.name は必ず cleanShopName() 経由
 *   - エリア: 一時 ch-pref-AXXXX 形式で INSERT し、後で migrate-cityheaven-areas.mjs (別スクリプト) で MECE 統合
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { cleanShopName } from './lib/clean-shop-name.mjs';
import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const PROGRESS_FILE = path.join(ROOT, 'cityheaven-progress.json');

const BASE = 'https://www.cityheaven.net';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const DELAY_MIN = 2000;
const DELAY_JITTER = 1500;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(DELAY_MIN + Math.random() * DELAY_JITTER);

const PREFECTURES = [
  'hokkaido','aomori','iwate','miyagi','akita','yamagata','fukushima',
  'ibaraki','tochigi','gunma','saitama','chiba','tokyo','kanagawa',
  'niigata','toyama','ishikawa','fukui','yamanashi','nagano','gifu','shizuoka','aichi',
  'mie','shiga','kyoto','osaka','hyogo','nara','wakayama',
  'tottori','shimane','okayama','hiroshima','yamaguchi',
  'tokushima','kagawa','ehime','kochi',
  'fukuoka','saga','nagasaki','kumamoto','oita','miyazaki','kagoshima','okinawa',
];

const BIZ_MAP = {
  biz1: 'ヘルス',
  biz4: 'ソープ',
  biz5: 'ホテヘル',
  biz6: 'デリヘル',
  biz7: 'エステ・アロマ',
  biz22: 'セクキャバ',
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

async function fetchPage(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Cookie': 'nenrei=y' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.error(`  retry ${i + 1}/${retries}: ${url} - ${e.message}`);
      await sleep(3000 * (i + 1));
    }
  }
  return null;
}

// HTMLから店舗名+slugを抽出
// シティヘブンの個店リンク構造:
//   <a class="shop_title_shop" itemprop=url href="/pref/AXXXX/AXXXXXX/slug/" target="_blank">
//     <span itemprop="name" ...>本来の店舗名</span>
//   </a>
function parseShops(html, pref) {
  const shops = [];
  const seen = new Set();

  const re = new RegExp(
    `<a\\s+class="shop_title_shop"[^>]*href="(/${pref}/A(\\d{4})/A(\\d{6})/([^"/]+)/?)"[^>]*>\\s*<span[^>]*itemprop="name"[^>]*>([^<]+)</span>`,
    'g'
  );
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    const areaCode = `A${m[2]}`;
    const subAreaCode = `A${m[3]}`;
    const slug = m[4];
    if (seen.has(slug)) continue;
    const rawName = m[5].trim().replace(/\s+/g, ' ');
    if (!rawName) continue;
    // グループ系はスキップ
    if (/(グループ|Group)$/i.test(rawName)) continue;

    const cleaned = cleanShopName(rawName);
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    seen.add(slug);
    shops.push({ slug, name: cleaned, rawName, url, areaCode, subAreaCode });
  }
  return shops;
}

function parseTotalCount(html) {
  // "1～30 件を表示 ／ 全 119 件" パターン
  const m = html.match(/全\s*(\d+)\s*件/);
  return m ? Number(m[1]) : 0;
}

async function fetchAreaCodes(pref) {
  // 都道府県トップページから AXXXX 一覧取得
  const url = `${BASE}/${pref}/?nenrei=y`;
  const html = await fetchPage(url);
  if (!html) return [];
  const codes = new Set();
  const re = new RegExp(`/${pref}/(A\\d{4})/`, 'g');
  let m;
  while ((m = re.exec(html))) codes.add(m[1]);
  return [...codes].sort();
}

async function scrapePrefBiz(db, pref, bizCode, opts = {}) {
  const category = BIZ_MAP[bizCode];
  if (!category) {
    console.error(`  ❌ 未知のbiz: ${bizCode}`);
    return { fetched: 0, inserted: 0, skipped: 0 };
  }

  // 都道府県のエリアコード一覧取得
  const areaCodes = await fetchAreaCodes(pref);
  await delay();
  console.log(`  📂 ${pref} ${bizCode}(${category}): エリア${areaCodes.length}個`);

  const allShops = [];
  const seen = new Set();
  for (const areaCode of areaCodes) {
    await delay();
    const url = `${BASE}/${pref}/${areaCode}/shop-list/${bizCode}/?nenrei=y`;
    const html = await fetchPage(url);
    if (!html) continue;
    const shops = parseShops(html, pref).filter((s) => !seen.has(s.slug));
    for (const s of shops) seen.add(s.slug);
    if (shops.length > 0) {
      allShops.push(...shops);
      console.log(`     ${areaCode}: +${shops.length} (累計 ${allShops.length})`);
    }
  }

  // 重複除去（slug単位）
  const uniq = new Map();
  for (const s of allShops) if (!uniq.has(s.slug)) uniq.set(s.slug, s);
  const shops = [...uniq.values()];

  console.log(`     取得: ${shops.length} 件 (uniq)`);

  if (opts.dryRun) {
    console.log(`     [dry-run] ${shops.slice(0, 5).map((s) => s.name).join(', ')}...`);
    return { fetched: shops.length, inserted: 0, skipped: 0 };
  }

  // 一時エリアID取得（or新規作成）
  const getOrCreateArea = (areaSlug) => {
    let row = db.prepare('SELECT id FROM areas WHERE slug=?').get(areaSlug);
    if (!row) {
      const ins = db.prepare('INSERT INTO areas (name, slug, prefecture, display_order) VALUES (?, ?, ?, 999)');
      const r = ins.run(areaSlug, areaSlug, pref);
      row = { id: r.lastInsertRowid };
    }
    return row.id;
  };

  // shops INSERT (強化重複チェック: 同一都道府県内 + 正規化名一致 で skip)
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
      const tempAreaSlug = `${pref}-ch-${s.areaCode}${s.subAreaCode}`;
      const areaId = getOrCreateArea(tempAreaSlug);
      insertShop.run(s.name, areaId, category, `${BASE}${s.url}`);
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

  const targets = [];
  if (opts.all) {
    for (const pref of PREFECTURES) for (const biz of Object.keys(BIZ_MAP)) targets.push({ pref, biz });
  } else if (opts.pref && opts.biz) {
    targets.push({ pref: opts.pref, biz: opts.biz });
  } else if (opts.pref) {
    for (const biz of Object.keys(BIZ_MAP)) targets.push({ pref: opts.pref, biz });
  } else {
    console.error('使い方: --pref tokyo [--biz biz4] | --all  [--dry-run]');
    process.exit(1);
  }

  console.log(`🌆 シティヘブン scrape: ${targets.length} ターゲット (dry-run=${opts.dryRun})\n`);

  let totalIns = 0, totalSkip = 0, totalFetch = 0;
  for (const t of targets) {
    const r = await scrapePrefBiz(db, t.pref, t.biz, opts);
    totalFetch += r.fetched;
    totalIns += r.inserted;
    totalSkip += r.skipped;
    await delay();
  }

  db.close();
  console.log(`\n=== 完了サマリー ===`);
  console.log(`fetch: ${totalFetch} / INSERT: ${totalIns} / SKIP(既存重複): ${totalSkip}`);
  console.log(`(dry-run=${opts.dryRun})`);
}

main().catch((e) => {
  console.error('❌ error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
