#!/usr/bin/env node
/**
 * ブラウザ補完スクレイピング v2
 *
 * 修正点:
 * - 0人の232店舗のページ1を再取得
 * - ページ2のURLを /girllist/2/ に修正（/girllist/p2/ は誤り）
 * - 全店舗で100人以上の場合ページ2も取得
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

async function extractGirlsFromPage(page) {
  return page.evaluate(() => {
    const girls = [];

    // パターン1: girl_img + girl_caption 構造 (多くの店舗)
    const girlImgs = document.querySelectorAll('.girl_img');
    for (const imgDiv of girlImgs) {
      const li = imgDiv.parentElement;
      if (!li) continue;

      // girlid を <a> href から取得
      const links = li.querySelectorAll('a[href*="girlid-"]');
      let sourceId = null;
      for (const a of links) {
        const m = a.href.match(/girlid-(\d+)/);
        if (m) { sourceId = m[1]; break; }
      }
      if (!sourceId) continue;

      // girl_caption からテキスト取得
      const cap = li.querySelector('.girl_caption');
      if (!cap) continue;

      const text = cap.innerText;
      const lines = text.split('\n').map(s => s.trim()).filter(s => s);

      // 名前を探す（「更新」「NEW」等の前の部分）
      // 典型パターン: "紀香(のりか)  〔33歳〕 更新"
      // or: "名前  更新" then "T160 ・ 87 (F) ・ 55 ・ 85"
      let name = '', age = null, height = null, bust = null, cup = null, waist = null, hip = null;

      for (const line of lines) {
        // 名前+年齢行: "紀香(のりか)  〔33歳〕 更新"
        const nameAgeMatch = line.match(/^(.+?)(?:\s*[\(（].*?[\)）])?\s*(?:〔|【|\[)?(\d+)歳(?:〕|】|\])?/);
        if (nameAgeMatch && !name) {
          name = nameAgeMatch[1].replace(/\s*(更新|NEW|新人).*$/i, '').replace(/[\(（].*?[\)）]/g, '').trim();
          age = parseInt(nameAgeMatch[2]);
          continue;
        }
        // 名前のみ行（年齢なし）
        if (!name && !line.match(/^[T\d]/) && !line.match(/^現在/) && !line.match(/^体験/) && !line.match(/^スタイル/) && !line.match(/^口コミ/) && line.length < 30) {
          const cleanName = line.replace(/\s*(更新|NEW|新人).*$/i, '').trim();
          if (cleanName.length > 0 && cleanName.length < 20) {
            name = cleanName;
          }
        }
        // サイズ行: "T160 ・ 87 (F) ・ 55 ・ 85"
        const heightM = line.match(/T(\d+)/);
        if (heightM) height = parseInt(heightM[1]);
        const sizeM = line.match(/(\d+)\s*[（(](\w+)[）)]\s*[・･]\s*(\d+)\s*[・･]\s*(\d+)/);
        if (sizeM) {
          bust = parseInt(sizeM[1]);
          cup = sizeM[2];
          waist = parseInt(sizeM[3]);
          hip = parseInt(sizeM[4]);
        }
        // 年齢が別行の場合
        if (!age) {
          const ageOnly = line.match(/(\d+)歳/);
          if (ageOnly) age = parseInt(ageOnly[1]);
        }
      }

      if (!name) continue;

      girls.push({ name, sourceId, age, height, bust, cup, waist, hip });
    }

    // パターン2: girllisttext 構造 (一部の店舗 - フォールバック)
    if (girls.length === 0) {
      const lis = document.querySelectorAll('li');
      for (const li of lis) {
        // href内のgirlid を探す
        const links = li.querySelectorAll('a[href*="girlid-"]');
        let sourceId = null;
        for (const a of links) {
          const m = a.href.match(/girlid-(\d+)/);
          if (m) { sourceId = m[1]; break; }
        }
        if (!sourceId) {
          // クラス名パターンも試す
          const clsMatch = li.className.match(/girlid-(\d+)/);
          if (clsMatch) sourceId = clsMatch[1];
          else continue;
        }

        const textEl = li.querySelector('.girllisttext') || li.querySelector('.girl_caption');
        if (!textEl) continue;
        const text = textEl.innerText;
        const allLines = text.split('\n').map(s => s.trim()).filter(s => s);
        if (allLines.length < 1) continue;

        const nameRaw = allLines[0].replace(/\s*(更新|NEW|新人).*$/, '').trim();
        const statsLine = allLines[1] || '';
        const ageMatch = statsLine.match(/(\d+)歳/) || allLines[0].match(/(\d+)歳/);
        const heightMatch = text.match(/T(\d+)/);
        const sizeMatch = text.match(/(\d+)\s*[（(](\w+)[）)]\s*[・･]\s*(\d+)\s*[・･]\s*(\d+)/);

        girls.push({
          name: nameRaw.replace(/[\(（].*?[\)）]/g, '').trim() || nameRaw,
          sourceId,
          age: ageMatch ? parseInt(ageMatch[1]) : null,
          height: heightMatch ? parseInt(heightMatch[1]) : null,
          bust: sizeMatch ? parseInt(sizeMatch[1]) : null,
          cup: sizeMatch ? sizeMatch[2] : null,
          waist: sizeMatch ? parseInt(sizeMatch[3]) : null,
          hip: sizeMatch ? parseInt(sizeMatch[4]) : null,
        });
      }
    }

    return girls;
  });
}

async function checkHasPage2(page) {
  return page.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      if (a.textContent.trim() === '2' && a.href.includes('/girllist/2')) {
        return a.href;
      }
    }
    // Also check for "次の女の子へ"
    for (const a of links) {
      if (a.textContent.includes('次の女の子') && a.href.includes('/girllist/')) {
        return a.href;
      }
    }
    return null;
  });
}

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

async function main() {
  const db = openDb();

  // Task 1: 0人の店舗を再スクレイプ（ページ1）
  const zeroGirlShops = db.prepare(`
    SELECT s.id, s.name, s.source_url
    FROM shops s
    LEFT JOIN girls g ON g.shop_id = s.id AND g.is_active = 1
    WHERE s.is_active = 1 AND s.source_url IS NOT NULL
    GROUP BY s.id
    HAVING COUNT(g.id) = 0
    ORDER BY s.id
  `).all();

  // Task 2: 100人ちょうどの店舗（ページ2を /girllist/2/ で取得）
  const page2Shops = db.prepare(`
    SELECT s.id, s.name, s.source_url, COUNT(*) as cnt
    FROM girls g JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active = 1
    GROUP BY g.shop_id
    HAVING cnt = 100
    ORDER BY s.id
  `).all();

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   ブラウザ補完スクレイピング v2          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n📋 Task 1: 0人店舗の再取得: ${zeroGirlShops.length} 店舗`);
  console.log(`📋 Task 2: ページ2取得 (/girllist/2/): ${page2Shops.length} 店舗`);
  console.log(`📋 合計: ${zeroGirlShops.length + page2Shops.length} 巡回\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // 年齢認証クリア - 直接 cookie をセット
  console.log('🔑 年齢認証 cookie をセット...');
  await page.setCookie({
    name: 'nenrei',
    value: 'y',
    domain: '.cityheaven.net',
    path: '/',
  });
  console.log('✅ Cookie セット完了\n');

  let totalNew = 0, totalUpd = 0;
  let reallyEmpty = 0, scraped = 0, errors = 0;

  // ─── Task 1: 0人店舗のページ1再取得 ─────────────────
  console.log('━━━ Task 1: 0人店舗のページ1再取得 ━━━\n');

  for (let i = 0; i < zeroGirlShops.length; i++) {
    const shop = zeroGirlShops[i];
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      process.stdout.write(`[${i + 1}/${zeroGirlShops.length}] ${shop.name}... `);

      await page.goto(girlListUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);

      // 年齢認証ページだった場合のフォールバック
      const currentUrl = page.url();
      if (currentUrl.includes('nenrei') && !currentUrl.includes('nenrei=y')) {
        const clicked = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const a of links) {
            if (a.href.includes('nenrei=y') || a.textContent.includes('はい') || a.textContent.includes('YES') || a.textContent.includes('18歳以上')) {
              a.click();
              return true;
            }
          }
          return false;
        });
        if (clicked) {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          await sleep(2000);
        }
      }

      const girls = await extractGirlsFromPage(page);

      if (girls.length > 0) {
        const tx = db.transaction(() => upsertGirls(db, shop.id, girls));
        const result = tx();
        console.log(`${girls.length}人 (新:${result.sNew} 更新:${result.sUpd} 照合:${result.sRec})`);
        totalNew += result.sNew;
        totalUpd += result.sUpd;
        scraped++;

        // ページ2チェック
        if (girls.length >= 100) {
          const page2Url = await checkHasPage2(page);
          if (page2Url) {
            try {
              await sleep(1500);
              await page.goto(page2Url, { waitUntil: 'domcontentloaded', timeout: 30000 });
              await sleep(2000);
              const girls2 = await extractGirlsFromPage(page);
              if (girls2.length > 0) {
                const tx2 = db.transaction(() => upsertGirls(db, shop.id, girls2));
                const r2 = tx2();
                console.log(`  └ ページ2: ${girls2.length}人 (新:${r2.sNew} 更新:${r2.sUpd})`);
                totalNew += r2.sNew;
                totalUpd += r2.sUpd;
              }
            } catch (e2) {
              console.log(`  └ ページ2エラー: ${e2.message}`);
            }
          }
        }
      } else {
        console.log('0人 (本当に空)');
        reallyEmpty++;
      }

      await sleep(800 + Math.random() * 400);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Task 1 結果: 取得=${scraped} 本当に空=${reallyEmpty} エラー=${errors}\n`);

  // ─── Task 2: 既存100人店舗のページ2（正しいURL） ─────
  console.log('━━━ Task 2: 100人店舗のページ2 (/girllist/2/) ━━━\n');

  let page2Done = 0, page2Found = 0;

  for (let i = 0; i < page2Shops.length; i++) {
    const shop = page2Shops[i];
    // まずページ1にアクセスしてページ2リンクを確認
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      process.stdout.write(`[${i + 1}/${page2Shops.length}] ${shop.name}... `);

      await page.goto(girlListUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1500);

      const page2Url = await checkHasPage2(page);

      if (page2Url) {
        await sleep(1000);
        await page.goto(page2Url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);

        const girls = await extractGirlsFromPage(page);
        if (girls.length > 0) {
          const tx = db.transaction(() => upsertGirls(db, shop.id, girls));
          const result = tx();
          console.log(`${girls.length}人 (新:${result.sNew} 更新:${result.sUpd} 照合:${result.sRec})`);
          totalNew += result.sNew;
          totalUpd += result.sUpd;
          page2Found++;
        } else {
          console.log('ページ2あるが0人');
        }
      } else {
        console.log('ページ2なし');
      }

      page2Done++;
      await sleep(800 + Math.random() * 400);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      page2Done++;
    }
  }

  await browser.close();

  const totalGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
  const shopsWithGirls = db.prepare(`SELECT COUNT(DISTINCT s.id) as c FROM shops s JOIN girls g ON g.shop_id=s.id AND g.is_active=1 WHERE s.is_active=1`).get();
  const zeroAfter = db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT s.id FROM shops s
      LEFT JOIN girls g ON g.shop_id = s.id AND g.is_active = 1
      WHERE s.is_active = 1 AND s.source_url IS NOT NULL
      GROUP BY s.id HAVING COUNT(g.id) = 0
    )
  `).get();

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   補完スクレイピング v2 完了             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  新規追加: ${totalNew}`);
  console.log(`  更新: ${totalUpd}`);
  console.log(`  ページ2あり: ${page2Found}/${page2Shops.length} 店舗`);
  console.log(`  女性在籍店舗: ${shopsWithGirls.c}`);
  console.log(`  まだ0人の店舗: ${zeroAfter.c}`);
  console.log(`  アクティブ女性総数: ${totalGirls.c}`);

  db.close();
}

main().catch(e => { console.error('\n💀 エラー:', e.message); process.exit(1); });
