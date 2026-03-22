#!/usr/bin/env node
import puppeteer from 'puppeteer';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  // Check shop_list pagination
  for (let p = 1; p <= 5; p++) {
    const url = `https://tokyo.aromaesthe.co.jp/shop_list/${p}/`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const info = await page.evaluate(() => {
      const shops = [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))];
      const pageLinks = [...document.querySelectorAll('a')]
        .filter(a => a.href.includes('/shop_list/'))
        .map(a => ({ href: a.href, text: a.textContent.trim() }));
      return { count: shops.length, shops: shops.slice(0, 3), pages: pageLinks };
    });

    console.log(`Page ${p}: ${info.count} shops`);
    if (info.count === 0) break;
    console.log('  Sample:', info.shops[0]);
    if (p === 1) {
      console.log('  Page links:');
      info.pages.slice(0, 10).forEach(l => console.log(`    ${l.text} -> ${l.href}`));
    }
    await sleep(1500);
  }

  // Also try area-based listings
  const areas = [
    'https://tokyo.aromaesthe.co.jp/shop_list/1/area/%E6%96%B0%E5%AE%BF%E3%83%BB%E8%A5%BF%E6%9D%B1%E4%BA%AC/',
    'https://tokyo.aromaesthe.co.jp/shop_list/1/area/%E6%B1%A0%E8%A2%8B/',
  ];

  for (const url of areas) {
    await sleep(2000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000);
    const info = await page.evaluate(() => {
      const shops = [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))];
      return { count: shops.length, title: document.title };
    });
    console.log(`${decodeURIComponent(url)}: ${info.count} shops`);
  }

  await browser.close();
}

main().catch(console.error);
