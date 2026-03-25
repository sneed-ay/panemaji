#!/usr/bin/env node
/**
 * 東京の問題店舗修正スクリプト
 *
 * 1. 在籍0人の店舗（ページ取得失敗）→ 再スクレイピング
 * 2. ちょうど100人の店舗（ページ2未取得）→ ページ2取得
 *
 * cityheaven.net と men-esthe.jp の両方に対応
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
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

// ─── cityheaven 用パーサー ─────────────────────────────

async function extractCityheavenGirls(page) {
  return page.evaluate(() => {
    const girls = [];
    const lis = document.querySelectorAll('li');
    for (const li of lis) {
      const girlIdMatch = li.className.match(/girlid-(\d+)/) || li.innerHTML?.match(/girlid-(\d+)/);
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

      // 画像URL取得
      const img = li.querySelector('img');
      let imageUrl = null;
      if (img) {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
        if (src && !src.includes('noimage') && !src.includes('now_printing')) {
          imageUrl = src;
        }
      }

      girls.push({
        name,
        sourceId: girlIdMatch[1],
        age: ageMatch ? parseInt(ageMatch[1]) : null,
        height: heightMatch ? parseInt(heightMatch[1]) : null,
        bust: sizeMatch ? parseInt(sizeMatch[1]) : null,
        cup: sizeMatch ? sizeMatch[2] : null,
        waist: sizeMatch ? parseInt(sizeMatch[3]) : null,
        hip: sizeMatch ? parseInt(sizeMatch[4]) : null,
        imageUrl,
      });
    }
    return girls;
  });
}

// ─── men-esthe.jp 用パーサー ─────────────────────────

function parseBodyInfo(text) {
  if (!text) return {};
  let m = text.match(/T\.?(\d{3})\s*(?:cm)?\s*[/\s]+B\.?(\d{2,3})\s*\(([A-K])\)\s*[/\s]+W\.?(\d{2,3})\s*[/\s]+H\.?(\d{2,3})/);
  if (m) return { height: parseInt(m[1]), bust: parseInt(m[2]), cup: m[3], waist: parseInt(m[4]), hip: parseInt(m[5]) };
  m = text.match(/T\.?\s*(\d{3})\s*(?:cm)?\s*\/?\s*B\.?\s*(\d{2,3})\s*\(([A-K])(?:cup)?\)\s*\/?\s*W\.?\s*(\d{2,3})\s*\/?\s*H\.?\s*(\d{2,3})/);
  if (m) return { height: parseInt(m[1]), bust: parseInt(m[2]), cup: m[3], waist: parseInt(m[4]), hip: parseInt(m[5]) };
  m = text.match(/T\.?\s*(\d{3})\s*(?:cm)?\s+B\.?\s*(\d{2,3})\s*\(([A-K])\)\s+W\.?\s*(\d{2,3})\s+H\.?\s*(\d{2,3})/);
  if (m) return { height: parseInt(m[1]), bust: parseInt(m[2]), cup: m[3], waist: parseInt(m[4]), hip: parseInt(m[5]) };
  return {};
}

async function extractMenestheGirls(page) {
  // Scroll to load all
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      window.scrollBy(0, 800);
      await new Promise(r => setTimeout(r, 200));
    }
  });
  await sleep(1000);

  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    const tLinks = [...document.querySelectorAll('a[href*="therapist.php?id="]')];

    for (const a of tLinks) {
      const match = a.href.match(/therapist\.php\?id=(\d+)/);
      if (!match) continue;
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);

      const linkText = a.textContent.trim();
      let name = null, age = null;
      const nameAgeMatch = linkText.match(/([^\n\s(]+)\s*\((\d{2})\)\s*(?:さん)?/);
      if (nameAgeMatch) {
        name = nameAgeMatch[1].trim();
        age = parseInt(nameAgeMatch[2]);
      }

      if (name && (name.includes('セラピスト') || name.includes('おすすめ') || name.includes('マッサージ') || name.includes('新人') || name.length > 15)) {
        const lines = linkText.split('\n').map(l => l.trim()).filter(l => l);
        for (const line of lines) {
          const m = line.match(/^([^\s(]{1,10})\s*\((\d{2})\)/);
          if (m && !m[1].includes('セラピスト') && !m[1].includes('おすすめ') && !m[1].includes('マッサージ') && !m[1].includes('新人')) {
            name = m[1];
            age = parseInt(m[2]);
            break;
          }
        }
      }

      if (!name || name.length > 15) continue;

      const img = a.querySelector('img');
      const imgSrc = img?.src || '';
      const validImg = imgSrc.includes('men-esthe.jp/contents/therapist/') ? imgSrc : null;

      results.push({ id, name, age, text: linkText.substring(0, 200), img: validImg });
    }
    return results;
  });
}

// ─── 年齢認証突破 ─────────────────────────────────────

async function navigateWithAgeCheck(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const currentUrl = page.url();
  if (currentUrl.includes('nenrei') || currentUrl.includes('age')) {
    try {
      await page.waitForSelector('a[href*="nenrei=y"], input[type="submit"], button', { timeout: 5000 });
      const clicked = await page.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (const a of links) {
          if (a.href.includes('nenrei=y') || a.textContent.includes('はい') || a.textContent.includes('YES') || a.textContent.includes('18歳以上')) {
            a.click();
            return true;
          }
        }
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

// ─── DB書き込み ─────────────────────────────────────

function upsertCityheavenGirls(db, shopId, girls) {
  const now = new Date().toISOString();
  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, image_url, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, image_url = COALESCE(?, image_url), is_active = 1, last_seen_at = ? WHERE id = ?');
  const reconcileGirl = db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, image_url = COALESCE(?, image_url), is_active = 1, last_seen_at = ? WHERE id = ?');
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let sNew = 0, sUpd = 0, sRec = 0;

  for (const girl of girls) {
    const ex = getGirlBySourceId.get(girl.sourceId);
    if (ex) {
      const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height ||
        ex.bust !== girl.bust || ex.cup !== girl.cup || ex.waist !== girl.waist || ex.hip !== girl.hip;
      if (changed) updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.imageUrl, now, ex.id);
      else markSeen.run(now, ex.id);
      sUpd++;
      continue;
    }
    const seed = getGirlByNameShop.get(girl.name, shopId);
    if (seed) {
      reconcileGirl.run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.imageUrl, now, seed.id);
      sRec++;
      continue;
    }
    insertGirl.run(girl.name, shopId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, girl.imageUrl, girl.sourceId, now);
    sNew++;
  }

  return { sNew, sUpd, sRec };
}

function upsertMenestheGirls(db, shopId, therapists) {
  const findGirlBySource = db.prepare('SELECT id FROM girls WHERE source_id = ?');
  const insertGirl = db.prepare(`
    INSERT INTO girls (name, shop_id, age, height, bust, waist, hip, cup, image_url, source_id, is_active, last_seen_at, created_at)
    VALUES (@name, @shop_id, @age, @height, @bust, @waist, @hip, @cup, @image_url, @source_id, 1, datetime('now'), datetime('now'))
  `);
  const updateGirl = db.prepare(`
    UPDATE girls SET age = @age, height = @height, bust = @bust, waist = @waist, hip = @hip,
      cup = @cup, image_url = @image_url, last_seen_at = datetime('now'), is_active = 1
    WHERE source_id = @source_id
  `);

  let sNew = 0, sUpd = 0;

  for (const t of therapists) {
    const sourceId = `menesthe_${t.id}`;
    const body = parseBodyInfo(t.text);

    const existing = findGirlBySource.get(sourceId);
    if (existing) {
      updateGirl.run({
        age: t.age,
        height: body.height || null,
        bust: body.bust || null,
        waist: body.waist || null,
        hip: body.hip || null,
        cup: body.cup || null,
        image_url: t.img,
        source_id: sourceId,
      });
      sUpd++;
    } else {
      insertGirl.run({
        name: t.name,
        shop_id: shopId,
        age: t.age,
        height: body.height || null,
        bust: body.bust || null,
        waist: body.waist || null,
        hip: body.hip || null,
        cup: body.cup || null,
        image_url: t.img,
        source_id: sourceId,
      });
      sNew++;
    }
  }

  return { sNew, sUpd };
}

// ─── メイン ─────────────────────────────────────────

async function main() {
  const db = openDb();

  // 0人の店舗を取得
  const zeroGirlShops = db.prepare(`
    SELECT s.id, s.name, s.source_url
    FROM shops s
    WHERE s.is_active = 1
    AND s.area_id IN (SELECT id FROM areas WHERE prefecture = 'tokyo')
    AND s.id NOT IN (SELECT DISTINCT shop_id FROM girls WHERE is_active = 1)
    ORDER BY s.id
  `).all();

  // 100人ちょうどの店舗を取得
  const page2Shops = db.prepare(`
    SELECT s.id, s.name, s.source_url, COUNT(g.id) as cnt
    FROM shops s
    JOIN girls g ON g.shop_id = s.id AND g.is_active = 1
    WHERE s.is_active = 1
    AND s.area_id IN (SELECT id FROM areas WHERE prefecture = 'tokyo')
    GROUP BY s.id
    HAVING cnt = 100
    ORDER BY s.id
  `).all();

  // ソース別に分類
  const chZero = zeroGirlShops.filter(s => s.source_url.includes('cityheaven'));
  const meZero = zeroGirlShops.filter(s => s.source_url.includes('men-esthe'));
  const chPage2 = page2Shops.filter(s => s.source_url.includes('cityheaven'));
  // men-estheにはページネーションがないので100人制限はcityheavenのみ

  console.log('========================================');
  console.log('  東京 女性データ修正スクリプト');
  console.log('========================================');
  console.log(`  0人 cityheaven: ${chZero.length} 店舗`);
  console.log(`  0人 men-esthe:  ${meZero.length} 店舗`);
  console.log(`  100人 cityheaven (page2): ${chPage2.length} 店舗`);
  console.log(`  合計巡回: ${chZero.length + meZero.length + chPage2.length}\n`);

  // ブラウザ起動
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en;q=0.9' });

  let totalNew = 0, totalUpd = 0;
  let failedShops = [];

  // ─── Task 1: cityheaven 0人店舗のページ1 ─────────────
  if (chZero.length > 0) {
    console.log('--- Task 1: cityheaven 0人店舗 ---\n');

    // まず年齢認証をクリア
    try {
      await page.goto('https://www.cityheaven.net/tokyo/A1304/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);
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
        console.log('  年齢認証クリア\n');
      }
      await sleep(2000);
    } catch (e) {
      console.log(`  年齢認証エラー: ${e.message}\n`);
    }

    for (let i = 0; i < chZero.length; i++) {
      const shop = chZero[i];
      const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

      try {
        process.stdout.write(`  [${i + 1}/${chZero.length}] ${shop.name}... `);
        await navigateWithAgeCheck(page, girlListUrl);
        await sleep(1500);

        const girls = await extractCityheavenGirls(page);

        if (girls.length > 0) {
          const tx = db.transaction(() => upsertCityheavenGirls(db, shop.id, girls));
          const result = tx();
          console.log(`${girls.length}人 (新:${result.sNew} 更新:${result.sUpd} 照合:${result.sRec})`);
          totalNew += result.sNew;
          totalUpd += result.sUpd;

          // ページ2もチェック
          if (girls.length >= 100) {
            try {
              await sleep(1500);
              const p2Url = girlListUrl.replace(/\/$/, '') + '/p2/';
              await navigateWithAgeCheck(page, p2Url);
              await sleep(1500);
              const girls2 = await extractCityheavenGirls(page);
              if (girls2.length > 0) {
                const tx2 = db.transaction(() => upsertCityheavenGirls(db, shop.id, girls2));
                const r2 = tx2();
                console.log(`    page2: ${girls2.length}人 (新:${r2.sNew} 更新:${r2.sUpd})`);
                totalNew += r2.sNew;
                totalUpd += r2.sUpd;
              }
            } catch {}
          }
        } else {
          console.log('0人 (店舗閉店の可能性)');
          failedShops.push({ id: shop.id, name: shop.name, reason: 'no_girls' });
        }

        await sleep(1000 + Math.random() * 500);
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
        failedShops.push({ id: shop.id, name: shop.name, reason: e.message });
      }
    }
  }

  // ─── Task 2: cityheaven 100人店舗のページ2 ──────────
  if (chPage2.length > 0) {
    console.log('\n--- Task 2: cityheaven 100人店舗 page2 ---\n');

    let page2Found = 0;
    for (let i = 0; i < chPage2.length; i++) {
      const shop = chPage2[i];
      const p2Url = shop.source_url.replace(/\/$/, '') + '/girllist/p2/';

      try {
        process.stdout.write(`  [${i + 1}/${chPage2.length}] ${shop.name}... `);
        await navigateWithAgeCheck(page, p2Url);
        await sleep(1500);

        const girls = await extractCityheavenGirls(page);

        if (girls.length > 0) {
          const tx = db.transaction(() => upsertCityheavenGirls(db, shop.id, girls));
          const result = tx();
          console.log(`${girls.length}人 (新:${result.sNew} 更新:${result.sUpd} 照合:${result.sRec})`);
          totalNew += result.sNew;
          totalUpd += result.sUpd;
          page2Found++;
        } else {
          console.log('page2なし');
        }

        await sleep(1000 + Math.random() * 500);
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
      }
    }

    console.log(`\n  page2あり: ${page2Found}/${chPage2.length} 店舗`);
  }

  // ─── Task 3: men-esthe 0人店舗 ───────────────────────
  if (meZero.length > 0) {
    console.log('\n--- Task 3: men-esthe 0人店舗 ---\n');

    for (let i = 0; i < meZero.length; i++) {
      const shop = meZero[i];

      try {
        process.stdout.write(`  [${i + 1}/${meZero.length}] ${shop.name}... `);
        await page.goto(shop.source_url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);

        const therapists = await extractMenestheGirls(page);

        if (therapists.length > 0) {
          const tx = db.transaction(() => upsertMenestheGirls(db, shop.id, therapists));
          const result = tx();
          console.log(`${therapists.length}人 (新:${result.sNew} 更新:${result.sUpd})`);
          totalNew += result.sNew;
          totalUpd += result.sUpd;
        } else {
          console.log('0人 (店舗閉店の可能性)');
          failedShops.push({ id: shop.id, name: shop.name, reason: 'no_girls_menesthe' });
        }

        await sleep(2000 + Math.random() * 1500);
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
        failedShops.push({ id: shop.id, name: shop.name, reason: e.message });
      }
    }
  }

  await browser.close();

  // ─── 統計 ──────────────────────────────────────────
  console.log('\n========================================');
  console.log('  完了');
  console.log('========================================');
  console.log(`  新規追加: ${totalNew}人`);
  console.log(`  更新:     ${totalUpd}人`);
  console.log(`  失敗店舗: ${failedShops.length}`);

  if (failedShops.length > 0) {
    console.log('\n  失敗した店舗:');
    for (const s of failedShops) {
      console.log(`    - [${s.id}] ${s.name}: ${s.reason}`);
    }
  }

  // 修正後の確認
  const remainingZero = db.prepare(`
    SELECT COUNT(*) as cnt FROM shops s
    WHERE s.is_active = 1
    AND s.area_id IN (SELECT id FROM areas WHERE prefecture = 'tokyo')
    AND s.id NOT IN (SELECT DISTINCT shop_id FROM girls WHERE is_active = 1)
  `).get();

  const remaining100 = db.prepare(`
    SELECT COUNT(*) as cnt FROM (
      SELECT s.id, COUNT(g.id) as gcnt
      FROM shops s JOIN girls g ON g.shop_id = s.id AND g.is_active = 1
      WHERE s.is_active = 1
      AND s.area_id IN (SELECT id FROM areas WHERE prefecture = 'tokyo')
      GROUP BY s.id HAVING gcnt = 100
    )
  `).get();

  console.log(`\n  修正後 0人店舗: ${remainingZero.cnt}`);
  console.log(`  修正後 100人店舗: ${remaining100.cnt}`);

  db.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
