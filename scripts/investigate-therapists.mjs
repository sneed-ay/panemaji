#!/usr/bin/env node
/**
 * fues.jp と aromaesthe.co.jp のセラピスト情報構造を調査
 */

import puppeteer from 'puppeteer';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function investigateFuesTherapists(browser) {
  console.log('\n' + '='.repeat(60));
  console.log('fues.jp セラピスト一覧調査');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  // Visit therapist list page
  const url = 'https://www.fues.jp/store/1528857202/photo.html';
  console.log(`URL: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);

  const info = await page.evaluate(() => {
    const title = document.title;
    const html = document.documentElement.outerHTML;

    // Find therapist cards/elements
    const images = [...document.querySelectorAll('img')]
      .filter(img => {
        const src = (img.src || '').toLowerCase();
        return src.includes('photo') || src.includes('girl') || src.includes('cast') || src.includes('therapist') || src.includes('lady') || src.includes('upload');
      })
      .slice(0, 10)
      .map(img => ({ src: img.src.substring(0, 120), alt: img.alt, parent: img.parentElement?.tagName }));

    // Body text for names/ages
    const bodyText = document.body.innerText;

    // Look for profile-like structures
    const profileEls = [...document.querySelectorAll('[class*="photo"], [class*="girl"], [class*="cast"], [class*="therapist"], [class*="profile"], [class*="staff"]')];
    const profileInfo = profileEls.slice(0, 5).map(el => ({
      tag: el.tagName,
      class: el.className,
      text: el.textContent.trim().substring(0, 150),
      html: el.outerHTML.substring(0, 400),
    }));

    // Look for tables or structured data
    const tables = document.querySelectorAll('table');
    const tableInfo = [...tables].slice(0, 3).map(t => ({
      rows: t.rows.length,
      sample: t.outerHTML.substring(0, 500),
    }));

    return { title, images, profileInfo, tableInfo, bodyText: bodyText.substring(0, 2000) };
  });

  console.log('Title:', info.title);
  console.log('画像:', JSON.stringify(info.images, null, 2));
  console.log('プロフィール要素:', JSON.stringify(info.profileInfo, null, 2));
  console.log('テーブル:', info.tableInfo.length, '件');
  if (info.tableInfo.length) {
    info.tableInfo.forEach((t, i) => console.log(`  Table ${i}: ${t.rows} rows`));
  }
  console.log('本文(先頭):', info.bodyText.substring(0, 500));

  // Get all links on the page
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .slice(0, 50)
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }))
      .filter(l => l.href.includes('fues.jp'));
  });
  console.log('リンク数:', links.length);
  links.filter(l => l.text.length > 0 && l.text.length < 30).slice(0, 20).forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  await page.close();
}

async function investigateAromaestheShop(browser) {
  console.log('\n' + '='.repeat(60));
  console.log('aromaesthe.co.jp 店舗・セラピスト調査');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  // 1. Visit shop list - try area page
  console.log('\n--- エリアページ調査 ---');
  await page.goto('https://tokyo.aromaesthe.co.jp/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);

  // Find area links
  const areaLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => a.href.includes('aromaesthe.co.jp/area/') || a.href.includes('aromaesthe.co.jp/station/'))
      .slice(0, 30)
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));
  });
  console.log('エリアリンク:');
  areaLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Find shop links
  const shopLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a[href*="/shop/"]')]
      .slice(0, 20)
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));
  });
  console.log('\n店舗リンク:', shopLinks.length);
  shopLinks.slice(0, 10).forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Try area page
  if (areaLinks.length > 0) {
    const areaUrl = areaLinks[0].href;
    console.log(`\n--- エリアページ: ${areaUrl} ---`);
    await sleep(2000);
    await page.goto(areaUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000);

    const areaInfo = await page.evaluate(() => {
      const shopLinks = [...document.querySelectorAll('a[href*="/shop/"]')];
      return {
        title: document.title,
        shopCount: shopLinks.length,
        shops: shopLinks.slice(0, 10).map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) })),
        body: document.body.innerText.substring(0, 500),
      };
    });
    console.log('Title:', areaInfo.title);
    console.log('店舗数:', areaInfo.shopCount);
    areaInfo.shops.forEach(s => console.log(`  ${s.text} -> ${s.href}`));
  }

  // 2. Visit shop detail
  if (shopLinks.length > 0) {
    const shopUrl = shopLinks[0].href;
    console.log(`\n--- 店舗詳細: ${shopUrl} ---`);
    await sleep(2000);
    await page.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000);

    const shopInfo = await page.evaluate(() => {
      const title = document.querySelector('h1, h2')?.textContent?.trim() || document.title;

      // Look for therapist/lady links
      const ladyLinks = [...document.querySelectorAll('a[href*="/lady/"]')];

      // Look for images
      const images = [...document.querySelectorAll('img')]
        .filter(img => !img.src.includes('icon') && !img.src.includes('logo') && img.src.includes('http'))
        .slice(0, 10)
        .map(img => ({ src: img.src.substring(0, 120), alt: img.alt }));

      return {
        title,
        ladyCount: ladyLinks.length,
        ladyLinks: ladyLinks.slice(0, 10).map(a => ({
          href: a.href,
          text: (a.textContent || '').trim().substring(0, 60),
          img: a.querySelector('img')?.src?.substring(0, 120) || '',
        })),
        images,
        body: document.body.innerText.substring(0, 1000),
      };
    });

    console.log('店舗名:', shopInfo.title);
    console.log('セラピスト数:', shopInfo.ladyCount);
    shopInfo.ladyLinks.slice(0, 5).forEach(l => console.log(`  ${l.text} -> ${l.href}`));
    console.log('  画像:', shopInfo.ladyLinks.slice(0, 3).map(l => l.img));
    console.log('本文:', shopInfo.body.substring(0, 300));

    // 3. Visit a therapist/lady page
    if (shopInfo.ladyLinks.length > 0) {
      const ladyUrl = shopInfo.ladyLinks[0].href;
      console.log(`\n--- セラピスト詳細: ${ladyUrl} ---`);
      await sleep(2000);
      await page.goto(ladyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(1000);

      const ladyInfo = await page.evaluate(() => {
        const title = document.querySelector('h1, h2')?.textContent?.trim() || document.title;
        const bodyText = document.body.innerText;

        // Extract profile data patterns
        const ageMatch = bodyText.match(/(\d{2})歳/);
        const heightMatch = bodyText.match(/(\d{3})\s*cm/i) || bodyText.match(/身長[：:\s]*(\d{3})/);
        const bwh = bodyText.match(/[BW]?\d{2,3}[(\(（][A-K][)\)）]?\s*[/-]\s*\d{2,3}\s*[/-]\s*\d{2,3}/i)
               || bodyText.match(/(\d{2,3})\s*\/\s*(\d{2,3})\s*\/\s*(\d{2,3})/);

        // Images
        const images = [...document.querySelectorAll('img')]
          .filter(img => !img.src.includes('icon') && !img.src.includes('logo') && img.src.includes('http'))
          .slice(0, 5)
          .map(img => img.src.substring(0, 120));

        // Find structured profile data
        const profileData = {};
        document.querySelectorAll('th, dt, label, [class*="label"]').forEach(el => {
          const key = el.textContent.trim();
          const val = el.nextElementSibling?.textContent?.trim() || '';
          if (key && val && key.length < 20) profileData[key] = val.substring(0, 50);
        });

        return {
          title,
          age: ageMatch ? ageMatch[1] : null,
          height: heightMatch ? heightMatch[1] : null,
          bwh: bwh ? bwh[0] : null,
          images,
          profileData,
          body: bodyText.substring(0, 800),
        };
      });

      console.log('名前:', ladyInfo.title);
      console.log('年齢:', ladyInfo.age);
      console.log('身長:', ladyInfo.height);
      console.log('BWH:', ladyInfo.bwh);
      console.log('画像:', ladyInfo.images);
      console.log('プロフィール:', ladyInfo.profileData);
      console.log('本文:', ladyInfo.body.substring(0, 400));
    }
  }

  await page.close();
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  await investigateFuesTherapists(browser);
  await investigateAromaestheShop(browser);

  await browser.close();
}

main().catch(console.error);
