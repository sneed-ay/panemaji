#!/usr/bin/env node
/**
 * ブラウザ補完スクレイピング
 *
 * 1. 残り40店舗 (568-607) の女性ページ1を取得
 * 2. 100人ちょうどの店舗のページ2を取得
 *
 * Puppeteer で年齢認証を突破し、データを収集する
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── DB ─────────────────────────────────────────────

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

// ─── ブラウザでの女性リスト抽出 ─────────────────────

async function extractGirlsFromPage(page) {
  return page.evaluate(() => {
    const girls = [];
    const lis = document.querySelectorAll('li');
    for (const li of lis) {
      const girlIdMatch = li.className.match(/girlid-(\d+)/) || li.innerHTML.match(/girlid-(\d+)/);
      if (!girlIdMatch) continue;

      const textEl = li.querySelector('.girllisttext');
      if (!textEl) continue;
      const text = textEl.innerText;
      const lines = text.split('\n').map(s => s.trim()).filter(s => s);
      if (lines.length < 1) continue;

      const name = lines[0].replace(/\s*(更新|NEW|新人).*$/, '').trim();
      const statsLine = lines[1] || '';
      const ageMatch = statsLine.match(/(\d+)歳/);
      const heightMatch = statsLine.match(/T(\d+)/);
      const sizeMatch = statsLine.match(/(\d+)\s*[（(](\w+)[）)]\s*[･・]\s*(\d+)\s*[･・]\s*(\d+)/);

      girls.push({
        name,
        sourceId: girlIdMatch[1],
        age: ageMatch ? parseInt(ageMatch[1]) : null,
        height: heightMatch ? parseInt(heightMatch[1]) : null,
        bust: sizeMatch ? parseInt(sizeMatch[1]) : null,
        cup: sizeMatch ? sizeMatch[2] : null,
        waist: sizeMatch ? parseInt(sizeMatch[3]) : null,
        hip: sizeMatch ? parseInt(sizeMatch[4]) : null,
      });
    }
    return girls;
  });
}

async function navigateWithAgeCheck(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 年齢認証ページ対応
  const currentUrl = page.url();
  if (currentUrl.includes('nenrei') || currentUrl.includes('age')) {
    // 「はい」ボタンをクリック
    try {
      await page.waitForSelector('a[href*="nenrei=y"], input[type="submit"], button', { timeout: 5000 });
      const clicked = await page.evaluate(() => {
        // リンクパターン
        const links = document.querySelectorAll('a');
        for (const a of links) {
          if (a.href.includes('nenrei=y') || a.textContent.includes('はい') || a.textContent.includes('YES') || a.textContent.includes('18歳以上')) {
            a.click();
            return true;
          }
        }
        // ボタンパターン
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        for (const btn of buttons) {
          if (btn.textContent.includes('はい') || btn.value?.includes('はい') || btn.textContent.includes('YES')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (clicked) {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await sleep(1000);
      }
    } catch {}
  }
}

// ─── DB 書き込み ─────────────────────────────────────

function upsertGirls(db, shopId, girls) {
  const now = new Date().toISOString();
  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const reconcileGirl = db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let sNew = 0, sUpd = 0, sRec = 0;

  for (const girl of girls) {
    const ex = getGirlBySourceId.get(girl.sourceId);
    if (ex) {
      const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height ||
        ex.bust !== girl.bust || ex.cup !== girl.cup || ex.waist !== girl.waist || ex.hip !== girl.hip;
      if (changed) updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, ex.id);
      else markSeen.run(now, ex.id);
      sUpd++;
      continue;
    }
    const seed = getGirlByNameShop.get(girl.name, shopId);
    if (seed) {
      reconcileGirl.run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, seed.id);
      sRec++;
      continue;
    }
    insertGirl.run(girl.name, shopId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.sourceId, now);
    sNew++;
  }

  return { sNew, sUpd, sRec };
}

// ─── メイン ─────────────────────────────────────────

async function main() {
  const db = openDb();

  // Task 1: 残り40店舗 (ID > 567, 女性0人)
  const remainingShops = db.prepare(`
    SELECT s.id, s.name, s.source_url
    FROM shops s
    LEFT JOIN girls g ON g.shop_id = s.id AND g.is_active = 1
    WHERE s.is_active = 1 AND s.source_url IS NOT NULL AND s.id > 567
    GROUP BY s.id
    HAVING COUNT(g.id) = 0
    ORDER BY s.id
  `).all();

  // Task 2: 100人ちょうどの店舗 (ページ2候補)
  const page2Shops = db.prepare(`
    SELECT s.id, s.name, s.source_url, COUNT(*) as cnt
    FROM girls g JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1
    GROUP BY g.shop_id
    HAVING cnt = 100
    ORDER BY s.id
  `).all();

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   ブラウザ補完スクレイピング             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n📋 残り店舗(ページ1): ${remainingShops.length} 店舗`);
  console.log(`📋 ページ2候補: ${page2Shops.length} 店舗`);
  console.log(`📋 合計: ${remainingShops.length + page2Shops.length} 巡回\n`);

  // ブラウザ起動
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // まず年齢認証をクリア
  console.log('🔑 年齢認証をクリア中...');
  try {
    await page.goto('https://www.cityheaven.net/tokyo/A1304/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    // 年齢認証リンクを探してクリック
    const ageCleared = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.href.includes('nenrei=y') || a.textContent.includes('はい') || a.textContent.includes('YES') || a.textContent.includes('18歳以上')) {
          a.click();
          return true;
        }
      }
      return false;
    });
    if (ageCleared) {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      console.log('✅ 年齢認証クリア\n');
    } else {
      console.log('✅ 年齢認証不要\n');
    }
    await sleep(2000);
  } catch (e) {
    console.log(`⚠ 年齢認証処理エラー: ${e.message}\n`);
  }

  let totalNew = 0, totalUpd = 0;

  // ─── Task 1: 残り店舗のページ1 ─────────────────────
  if (remainingShops.length > 0) {
    console.log('━━━ Task 1: 残り店舗のページ1 ━━━\n');

    for (let i = 0; i < remainingShops.length; i++) {
      const shop = remainingShops[i];
      const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

      try {
        process.stdout.write(`[${i + 1}/${remainingShops.length}] ${shop.name}... `);
        await navigateWithAgeCheck(page, girlListUrl);
        await sleep(1500);

        const girls = await extractGirlsFromPage(page);

        if (girls.length > 0) {
          const tx = db.transaction(() => upsertGirls(db, shop.id, girls));
          const result = tx();
          console.log(`${girls.length}人 (新:${result.sNew} 更新:${result.sUpd} 照合:${result.sRec})`);
          totalNew += result.sNew;
          totalUpd += result.sUpd;
        } else {
          console.log('0人');
        }

        // ページ2もチェック
        if (girls.length >= 100) {
          try {
            await sleep(1500);
            const p2Url = girlListUrl.replace(/\/$/, '') + '/p2/';
            await navigateWithAgeCheck(page, p2Url);
            await sleep(1500);
            const girls2 = await extractGirlsFromPage(page);
            if (girls2.length > 0) {
              const tx2 = db.transaction(() => upsertGirls(db, shop.id, girls2));
              const r2 = tx2();
              console.log(`  └ ページ2: ${girls2.length}人追加 (新:${r2.sNew} 更新:${r2.sUpd})`);
              totalNew += r2.sNew;
              totalUpd += r2.sUpd;
            }
          } catch {}
        }

        await sleep(1000 + Math.random() * 500);
      } catch (e) {
        console.log(`❌ ${e.message}`);
      }
    }
  }

  // ─── Task 2: 既存100人店舗のページ2 ─────────────────
  console.log('\n━━━ Task 2: 100人店舗のページ2 ━━━\n');

  let page2Done = 0, page2Found = 0;

  for (let i = 0; i < page2Shops.length; i++) {
    const shop = page2Shops[i];
    const p2Url = shop.source_url.replace(/\/$/, '') + '/girllist/p2/';

    try {
      process.stdout.write(`[${i + 1}/${page2Shops.length}] ${shop.name}... `);
      await navigateWithAgeCheck(page, p2Url);
      await sleep(1500);

      const girls = await extractGirlsFromPage(page);

      if (girls.length > 0) {
        const tx = db.transaction(() => upsertGirls(db, shop.id, girls));
        const result = tx();
        console.log(`${girls.length}人 (新:${result.sNew} 更新:${result.sUpd} 照合:${result.sRec})`);
        totalNew += result.sNew;
        totalUpd += result.sUpd;
        page2Found++;
      } else {
        console.log('ページ2なし');
      }

      page2Done++;
      await sleep(1000 + Math.random() * 500);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      page2Done++;
    }
  }

  await browser.close();

  // 最終統計
  const totalGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   補完スクレイピング完了                 ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  新規追加: ${totalNew}`);
  console.log(`  更新: ${totalUpd}`);
  console.log(`  ページ2あり: ${page2Found}/${page2Shops.length} 店舗`);
  console.log(`  アクティブ女性総数: ${totalGirls.c}`);

  db.close();
}

main().catch(e => { console.error('\n💀 エラー:', e.message); process.exit(1); });
