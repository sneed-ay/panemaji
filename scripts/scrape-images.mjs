#!/usr/bin/env node
/**
 * 女性画像URL収集スクリプト
 * 各店舗の女性一覧ページから画像URLを取得してDBを更新
 */
import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'panemaji.db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // 画像URLがnullの女性がいる店舗を取得
  const shops = db.prepare(`
    SELECT DISTINCT s.id, s.name, s.source_url,
      (SELECT COUNT(*) FROM girls g WHERE g.shop_id = s.id AND g.is_active = 1 AND (g.image_url IS NULL OR g.image_url = '')) as missing_count,
      (SELECT COUNT(*) FROM girls g WHERE g.shop_id = s.id AND g.is_active = 1) as total_count
    FROM shops s
    WHERE s.is_active = 1 AND s.source_url IS NOT NULL
      AND (SELECT COUNT(*) FROM girls g2 WHERE g2.shop_id = s.id AND g2.is_active = 1 AND (g2.image_url IS NULL OR g2.image_url = '')) > 0
    ORDER BY s.id
  `).all();

  console.log(`📷 画像URL収集: ${shops.length} 店舗 (画像未取得の女性あり)`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setCookie({ name: 'nenrei', value: 'y', domain: '.cityheaven.net', path: '/' });

  const updateStmt = db.prepare('UPDATE girls SET image_url = ? WHERE source_id = ? AND (image_url IS NULL OR image_url = \'\')');

  let totalUpdated = 0;
  let shopsDone = 0;

  for (const shop of shops) {
    shopsDone++;
    const shopPath = shop.source_url.replace('https://www.cityheaven.net', '').replace(/\/$/, '');

    // ページ1とページ2から画像を取得
    const pages = [1];
    if (shop.total_count >= 100) pages.push(2);
    if (shop.total_count >= 200) pages.push(3);

    let shopUpdated = 0;

    for (const pageNum of pages) {
      const url = pageNum === 1
        ? `https://www.cityheaven.net${shopPath}/girllist/`
        : `https://www.cityheaven.net${shopPath}/girllist/${pageNum}/`;

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(1500);

        const girls = await page.evaluate(() => {
          const results = [];
          const links = document.querySelectorAll('a[href*="girlid-"]');
          for (const link of links) {
            const match = link.href.match(/girlid-(\d+)/);
            if (!match) continue;
            const girlId = match[1];
            const img = link.querySelector('img.no_login') || link.querySelector('img[alt]');
            if (img) {
              const src = img.src || img.getAttribute('data-original') || img.getAttribute('data-src') || '';
              if (src.includes('img2.cityheaven.net/img/girls')) {
                results.push({ sourceId: girlId, imageUrl: src.split('?')[0] });
              }
            }
          }
          return results;
        });

        for (const girl of girls) {
          const result = updateStmt.run(girl.imageUrl, girl.sourceId);
          if (result.changes > 0) shopUpdated++;
        }
      } catch (e) {
        // Skip page errors
      }

      await sleep(800);
    }

    totalUpdated += shopUpdated;
    if (shopUpdated > 0) {
      process.stdout.write(`[${shopsDone}/${shops.length}] ${shop.name}... ${shopUpdated}枚\n`);
    } else {
      process.stdout.write('.');
      if (shopsDone % 50 === 0) process.stdout.write(` (${shopsDone}/${shops.length})\n`);
    }
  }

  console.log(`\n\n✅ 画像URL収集完了: ${totalUpdated}枚 更新`);

  // 結果確認
  const withImg = db.prepare("SELECT COUNT(*) as c FROM girls WHERE is_active=1 AND image_url IS NOT NULL AND image_url != ''").get();
  const total = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
  console.log(`画像あり: ${withImg.c}/${total.c} (${Math.round(withImg.c/total.c*100)}%)`);

  await browser.close();
  db.close();
}

main().catch(console.error);
