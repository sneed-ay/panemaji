#!/usr/bin/env node
/**
 * ブラウザから収集したJSONデータをDBにインポートするスクリプト
 *
 * 使い方:
 *   1. ブラウザでデータを収集 → shops.json / girls.json に保存
 *   2. node scripts/browser-scrape.mjs import-shops
 *   3. node scripts/browser-scrape.mjs import-girls
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const SHOPS_JSON = path.join(PROJECT_ROOT, 'scraped-shops.json');
const GIRLS_JSON = path.join(PROJECT_ROOT, 'scraped-girls.json');

function normalizeName(name) {
  return name.normalize('NFKC').replace(/[\s　]+/g, '').replace(/[☆★♡♥～〜・]/g, '').trim();
}

function slugify(name) {
  const map = {
    '新宿': 'shinjuku', '歌舞伎町': 'shinjuku', '池袋': 'ikebukuro',
    '渋谷': 'shibuya', '五反田': 'gotanda', '目黒': 'gotanda',
    '鶯谷': 'uguisudani', '日暮里': 'uguisudani', '上野': 'ueno', '浅草': 'ueno',
    '品川': 'shinagawa', '大井町': 'shinagawa',
    '錦糸町': 'kinshicho', '亀戸': 'kinshicho',
    '立川': 'tachikawa', '八王子': 'tachikawa', '吉原': 'yoshiwara',
    '赤坂': 'roppongi', '六本木': 'roppongi',
    '新橋': 'shinbashi', '銀座': 'shinbashi',
    '大塚': 'otsuka', '巣鴨': 'sugamo',
    '蒲田': 'kamata', '大森': 'kamata',
    '町田': 'machida', '吉祥寺': 'kichijoji',
  };
  for (const [k, v] of Object.entries(map)) {
    if (name.includes(k)) return v;
  }
  return 'area_' + Buffer.from(name).toString('hex').slice(0, 8);
}

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  // Ensure all columns exist
  const cols = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  const shopCols = cols('shops');
  if (!shopCols.includes('is_active')) db.exec('ALTER TABLE shops ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!shopCols.includes('last_seen_at')) db.exec('ALTER TABLE shops ADD COLUMN last_seen_at TEXT');
  const girlCols = cols('girls');
  if (!girlCols.includes('source_id')) db.exec('ALTER TABLE girls ADD COLUMN source_id TEXT');
  if (!girlCols.includes('is_active')) db.exec('ALTER TABLE girls ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!girlCols.includes('last_seen_at')) db.exec('ALTER TABLE girls ADD COLUMN last_seen_at TEXT');

  try { db.exec('CREATE UNIQUE INDEX idx_girls_source_id ON girls(source_id) WHERE source_id IS NOT NULL'); } catch {}

  return db;
}

function importShops() {
  console.log('📦 店舗データをインポート中...');
  const data = JSON.parse(fs.readFileSync(SHOPS_JSON, 'utf-8'));
  console.log(`   ${data.length} 店舗を読み込み`);

  const db = openDb();
  const now = new Date().toISOString();

  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name, slug) VALUES (?, ?)');
  const getAreaByName = db.prepare('SELECT id FROM areas WHERE name = ?');
  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const getShopByName = db.prepare('SELECT id, name FROM shops WHERE source_url IS NULL');
  const insertShop = db.prepare('INSERT INTO shops (name, area_id, category, source_url, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
  const updateShopSeen = db.prepare('UPDATE shops SET last_seen_at = ?, is_active = 1, name = ?, category = ? WHERE id = ?');
  const updateShopUrl = db.prepare('UPDATE shops SET source_url = ?, last_seen_at = ?, is_active = 1 WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalReconciled = 0;

  const transaction = db.transaction(() => {
    const seedShops = getShopByName.all();

    for (const shop of data) {
      // Ensure area exists
      const areaName = shop.area || '不明';
      insertArea.run(areaName, slugify(areaName));
      const areaRow = getAreaByName.get(areaName);
      const areaId = areaRow ? areaRow.id : 1;

      // Check by source_url
      const existing = getShopByUrl.get(shop.href);
      if (existing) {
        updateShopSeen.run(now, shop.name, shop.category || 'デリヘル', existing.id);
        totalUpdated++;
        continue;
      }

      // Try name match with seed shops
      const normalizedName = normalizeName(shop.name);
      let matched = false;
      for (const seed of seedShops) {
        if (normalizeName(seed.name) === normalizedName) {
          updateShopUrl.run(shop.href, now, seed.id);
          totalReconciled++;
          matched = true;
          // Remove from seedShops to avoid double match
          const idx = seedShops.indexOf(seed);
          if (idx > -1) seedShops.splice(idx, 1);
          break;
        }
      }
      if (matched) continue;

      // New shop
      insertShop.run(shop.name, areaId, shop.category || 'デリヘル', shop.href, now);
      totalNew++;
    }

    // Mark unseen shops as inactive
    db.prepare('UPDATE shops SET is_active = 0 WHERE source_url IS NOT NULL AND (last_seen_at IS NULL OR last_seen_at < ?)').run(now);
  });

  transaction();

  const total = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get();
  console.log(`✅ 完了: 新規=${totalNew} 更新=${totalUpdated} シード照合=${totalReconciled}`);
  console.log(`   アクティブ店舗数: ${total.c}`);
  db.close();
}

function importGirls() {
  console.log('📦 女性データをインポート中...');
  const data = JSON.parse(fs.readFileSync(GIRLS_JSON, 'utf-8'));
  // data is { shopUrl: string, girls: [...] }[]
  console.log(`   ${data.length} 店舗分のデータを読み込み`);

  const db = openDb();
  const now = new Date().toISOString();

  const getShopByUrl = db.prepare('SELECT id FROM shops WHERE source_url = ?');
  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const reconcileGirl = db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalReconciled = 0, totalDeactivated = 0;
  let shopsDone = 0;

  for (const entry of data) {
    const shopRow = getShopByUrl.get(entry.shopUrl);
    if (!shopRow) {
      console.log(`   ⚠ 店舗が見つからない: ${entry.shopUrl}`);
      continue;
    }
    const shopId = shopRow.id;

    const transaction = db.transaction(() => {
      const seenSourceIds = new Set();

      for (const girl of entry.girls) {
        if (!girl.sourceId) continue;
        seenSourceIds.add(girl.sourceId);

        const existing = getGirlBySourceId.get(girl.sourceId);
        if (existing) {
          updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, existing.id);
          totalUpdated++;
          continue;
        }

        const seedMatch = getGirlByNameShop.get(girl.name, shopId);
        if (seedMatch) {
          reconcileGirl.run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, seedMatch.id);
          totalReconciled++;
          continue;
        }

        insertGirl.run(girl.name, shopId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.sourceId, now);
        totalNew++;
      }

      // Deactivate girls not seen
      if (seenSourceIds.size > 0) {
        const placeholders = [...seenSourceIds].map(() => '?').join(',');
        const result = db.prepare(`
          UPDATE girls SET is_active = 0
          WHERE shop_id = ? AND source_id IS NOT NULL AND is_active = 1
            AND source_id NOT IN (${placeholders})
        `).run(shopId, ...seenSourceIds);
        totalDeactivated += result.changes;
      }
    });

    transaction();
    shopsDone++;
    if (shopsDone % 100 === 0) console.log(`   ${shopsDone}/${data.length} 店舗処理完了...`);
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
  console.log(`✅ 完了: 新規=${totalNew} 更新=${totalUpdated} 照合=${totalReconciled} 退店=${totalDeactivated}`);
  console.log(`   アクティブ女性数: ${total.c}`);
  db.close();
}

const command = process.argv[2];
if (command === 'import-shops') importShops();
else if (command === 'import-girls') importGirls();
else console.log('使い方: node scripts/browser-scrape.mjs [import-shops|import-girls]');
