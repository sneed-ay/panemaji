#!/usr/bin/env node
/**
 * aromaesthe.co.jp の店舗一覧ページ構造を調査
 */
import puppeteer from 'puppeteer';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  // 1. Try shop list page
  for (const url of [
    'https://tokyo.aromaesthe.co.jp/shoplist/',
    'https://tokyo.aromaesthe.co.jp/shop/',
    'https://tokyo.aromaesthe.co.jp/area/',
    'https://tokyo.aromaesthe.co.jp/search/',
    'https://tokyo.aromaesthe.co.jp/all/',
  ]) {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
    if (r && r.status() === 200) {
      const shopCount = await page.evaluate(() => document.querySelectorAll('a[href*="/shop/"]').length);
      console.log(`${url} -> OK, shops=${shopCount}`);
      if (shopCount > 5) {
        const links = await page.evaluate(() =>
          [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))].slice(0, 20)
        );
        links.forEach(l => console.log('  ', l));
      }
    } else {
      console.log(`${url} -> ${r ? r.status() : 'FAIL'}`);
    }
    await sleep(1500);
  }

  // 2. Try the top page scrolling - it might load more via ajax
  console.log('\n--- トップページの全リンク調査 ---');
  await page.goto('https://tokyo.aromaesthe.co.jp/', { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(2000);

  // Get ALL unique shop links
  const allShops = await page.evaluate(() => {
    return [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))];
  });
  console.log(`トップの店舗リンク: ${allShops.length}`);
  allShops.slice(0, 10).forEach(l => console.log('  ', l));

  // Find area/station links
  const navLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => {
        const href = a.href || '';
        return (href.includes('area') || href.includes('station') || href.includes('list') ||
                href.includes('search') || href.includes('all'));
      })
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }))
      .filter(l => l.href.includes('aromaesthe'));
  });
  console.log('\nナビリンク:');
  navLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Try scrolling to load more
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
  }
  const afterScroll = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))].length
  );
  console.log(`\nスクロール後の店舗リンク: ${afterScroll}`);

  // 3. Look for area/station pages
  console.log('\n--- エリア一覧の構造 ---');
  const areaListUrl = 'https://tokyo.aromaesthe.co.jp/area/shinjuku/';
  const r = await page.goto(areaListUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
  if (r && r.status() === 200) {
    const info = await page.evaluate(() => {
      const shops = [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))];
      const ladies = [...new Set([...document.querySelectorAll('a[href*="/lady/"]')].map(a => a.href))];
      return { shops: shops.length, ladies: ladies.length, title: document.title, body: document.body.innerText.substring(0, 500) };
    });
    console.log(`新宿エリア: shops=${info.shops}, ladies=${info.ladies}`);
    console.log('Title:', info.title);
    console.log('Body:', info.body.substring(0, 300));
  } else {
    console.log('新宿エリアページ: アクセス不可');
  }

  // 4. Check lady page structure more deeply
  console.log('\n--- セラピスト詳細の構造 ---');
  await sleep(2000);
  await page.goto('https://tokyo.aromaesthe.co.jp/lady/elteras_ffd00ad7554a/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1000);

  const ladyDetail = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    // Parse profile info from body text
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const profileLines = lines.filter(l => /T\d{3}|B\d{2}|W\d{2}|H\d{2}|\d{2}歳|cup/.test(l));

    // Also check for specific elements
    const nameEl = document.querySelector('h1, h2, .name, [class*="name"]');

    return {
      title: document.title,
      name: nameEl?.textContent?.trim(),
      profileLines,
      body: bodyText.substring(0, 1000),
    };
  });

  console.log('Title:', ladyDetail.title);
  console.log('Name:', ladyDetail.name);
  console.log('Profile lines:', ladyDetail.profileLines);
  console.log('Body:', ladyDetail.body.substring(0, 500));

  // 5. Check if we can get shop list from a full page
  console.log('\n--- 電話帳ページ ---');
  await sleep(2000);
  await page.goto('https://tokyo.aromaesthe.co.jp/tel/', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
  const telInfo = await page.evaluate(() => {
    const shops = [...new Set([...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.href))];
    return { shops: shops.length, title: document.title, body: document.body.innerText.substring(0, 500) };
  });
  console.log(`電話帳: shops=${telInfo.shops}`);
  console.log('Title:', telInfo.title);
  console.log('Body:', telInfo.body.substring(0, 300));

  await browser.close();
}

main().catch(console.error);
