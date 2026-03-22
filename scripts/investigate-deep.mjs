#!/usr/bin/env node
/**
 * m-este.com と fues.jp の詳細構造調査
 */

import puppeteer from 'puppeteer';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function investigateMeste(browser) {
  console.log('\n' + '='.repeat(60));
  console.log('m-este.com 詳細調査');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // 1. Tokyo area page - get area links and shop listing structure
  await page.goto('https://m-este.com/tokyo/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);

  // Get area sub-links
  const areaLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => a.href.includes('m-este.com/tokyo/') && a.href !== 'https://m-este.com/tokyo/')
      .slice(0, 30)
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));
  });
  console.log('\nエリアリンク:');
  areaLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Get shop list structure
  const shopListInfo = await page.evaluate(() => {
    // Check for shop cards
    const shopLinks = [...document.querySelectorAll('a[href*="/shops/"]')];
    const uniqueShops = [...new Set(shopLinks.map(a => a.href))];

    // Sample a shop card
    let sampleCard = null;
    const cards = document.querySelectorAll('.card, article, [class*="shop"], [class*="item"]');
    for (const card of cards) {
      const link = card.querySelector('a[href*="/shops/"]');
      if (link) {
        sampleCard = {
          html: card.outerHTML.substring(0, 500),
          text: card.textContent.trim().substring(0, 200),
          classes: card.className,
        };
        break;
      }
    }

    // Check pagination
    const pagination = document.querySelector('.pagination, [class*="pager"], [class*="page-nav"], nav[aria-label*="ページ"]');
    const pageLinks = [...document.querySelectorAll('a')]
      .filter(a => a.href.includes('page/') || a.href.includes('page='))
      .slice(0, 5)
      .map(a => ({ href: a.href, text: a.textContent.trim() }));

    return {
      uniqueShopCount: uniqueShops.length,
      shopUrls: uniqueShops.slice(0, 5),
      sampleCard,
      hasPagination: !!pagination,
      pageLinks,
    };
  });

  console.log(`\n店舗数(このページ): ${shopListInfo.uniqueShopCount}`);
  console.log('サンプルURL:', shopListInfo.shopUrls);
  console.log('ページネーション:', shopListInfo.hasPagination, shopListInfo.pageLinks);
  if (shopListInfo.sampleCard) {
    console.log('カード構造:', shopListInfo.sampleCard.classes);
    console.log('カードテキスト:', shopListInfo.sampleCard.text);
  }

  // 2. Visit a shop detail page
  if (shopListInfo.shopUrls.length > 0) {
    const shopUrl = shopListInfo.shopUrls[0];
    console.log(`\n--- 店舗詳細: ${shopUrl} ---`);
    await sleep(2000);
    await page.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000);

    const shopDetail = await page.evaluate(() => {
      const title = document.querySelector('h1, h2, [class*="title"]')?.textContent?.trim() || '';
      const bodyText = document.body.innerText.substring(0, 2000);

      // Look for therapist/girl links
      const therapistLinks = [...document.querySelectorAll('a')]
        .filter(a => {
          const href = a.href || '';
          return href.includes('therapist') || href.includes('girl') || href.includes('cast') || href.includes('staff');
        })
        .slice(0, 10)
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }));

      // Look for images
      const images = [...document.querySelectorAll('img')]
        .filter(img => {
          const src = img.src || '';
          return (src.includes('therapist') || src.includes('girl') || src.includes('cast') || src.includes('staff') || src.includes('profile'))
            && !src.includes('icon') && !src.includes('logo');
        })
        .slice(0, 5)
        .map(img => img.src);

      // Find area/location info
      const meta = {};
      document.querySelectorAll('table td, table th, dt, dd, [class*="info"], [class*="detail"]').forEach(el => {
        const text = el.textContent.trim();
        if (text.includes('エリア') || text.includes('住所') || text.includes('最寄') || text.includes('アクセス')) {
          meta[text.substring(0, 20)] = el.nextElementSibling?.textContent?.trim()?.substring(0, 100) || '';
        }
      });

      return { title, therapistLinks, images, meta, bodyTextSample: bodyText.substring(0, 500) };
    });

    console.log('店舗名:', shopDetail.title);
    console.log('セラピストリンク:', shopDetail.therapistLinks);
    console.log('画像:', shopDetail.images);
    console.log('メタ情報:', shopDetail.meta);
    console.log('本文サンプル:', shopDetail.bodyTextSample.substring(0, 300));
  }

  await page.close();
}

async function investigateFues(browser) {
  console.log('\n' + '='.repeat(60));
  console.log('fues.jp (週刊エステ) 詳細調査');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // 1. Tokyo page
  await page.goto('https://www.fues.jp/tokyoto/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(2000);

  // Get area sub-links
  const areaLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => {
        const href = a.href || '';
        return href.includes('fues.jp/tokyoto/') || href.includes('fues.jp/shinbashi') ||
               href.includes('fues.jp/shinjuku') || href.includes('fues.jp/ikebukuro') ||
               href.includes('fues.jp/shibuya') || href.includes('fues.jp/roppongi');
      })
      .slice(0, 30)
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));
  });
  console.log('\nエリアリンク:');
  [...new Map(areaLinks.map(l => [l.href, l])).values()].forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Get shop list structure
  const shopListInfo = await page.evaluate(() => {
    const shopLinks = [...document.querySelectorAll('a[href*="/store/"]')];
    const uniqueShops = [...new Set(shopLinks.map(a => a.href))];

    // Sample card
    const shopEls = document.querySelectorAll('[class*="shop"]');
    let sampleText = '';
    let sampleHTML = '';
    if (shopEls.length > 0) {
      sampleText = shopEls[0].textContent.trim().substring(0, 300);
      sampleHTML = shopEls[0].outerHTML.substring(0, 500);
    }

    // Get cards
    const cards = document.querySelectorAll('.card');
    let cardSample = '';
    if (cards.length > 1) {
      cardSample = cards[1].outerHTML.substring(0, 500);
    }

    // Pagination
    const pageLinks = [...document.querySelectorAll('a')]
      .filter(a => a.href.includes('page=') || a.href.includes('/page/') || a.textContent.trim() === '2')
      .slice(0, 5)
      .map(a => ({ href: a.href, text: a.textContent.trim() }));

    return { uniqueShopCount: uniqueShops.length, shopUrls: uniqueShops.slice(0, 5), sampleText, sampleHTML, cardSample, pageLinks };
  });

  console.log(`\n店舗数: ${shopListInfo.uniqueShopCount}`);
  console.log('サンプルURL:', shopListInfo.shopUrls);
  console.log('ページネーション:', shopListInfo.pageLinks);
  console.log('shop要素テキスト:', shopListInfo.sampleText?.substring(0, 200));
  // console.log('カードHTML:', shopListInfo.cardSample?.substring(0, 300));

  // 2. Shop detail page
  if (shopListInfo.shopUrls.length > 0) {
    const shopUrl = shopListInfo.shopUrls[0];
    console.log(`\n--- 店舗詳細: ${shopUrl} ---`);
    await sleep(2000);
    await page.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(1000);

    const shopDetail = await page.evaluate(() => {
      const title = document.querySelector('h1, h2, [class*="title"]')?.textContent?.trim()?.substring(0, 100) || '';

      // Therapist links
      const therapistLinks = [...document.querySelectorAll('a')]
        .filter(a => {
          const href = a.href || '';
          return href.includes('therapist') || href.includes('girl') || href.includes('cast') || href.includes('staff');
        })
        .slice(0, 10)
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }));

      // All links with profile-like patterns
      const profileLinks = [...document.querySelectorAll('a')]
        .filter(a => {
          const href = a.href || '';
          return href.includes('/profile') || href.includes('/detail') || href.includes('/cast/') || href.includes('/staff/');
        })
        .slice(0, 10)
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }));

      // Images (potential therapist photos)
      const images = [...document.querySelectorAll('img')]
        .filter(img => {
          const w = img.naturalWidth || parseInt(img.getAttribute('width')) || 0;
          const src = img.src || '';
          return !src.includes('icon') && !src.includes('logo') && !src.includes('banner') && src.includes('http');
        })
        .slice(0, 10)
        .map(img => ({ src: img.src.substring(0, 100), alt: img.alt }));

      const bodyText = document.body.innerText.substring(0, 1500);

      // Look for schedule/therapist section
      const sections = [...document.querySelectorAll('h2, h3, h4, .section-title, [class*="heading"]')]
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0 && t.length < 50);

      return { title, therapistLinks, profileLinks, images: images.slice(0, 5), sections, bodyText: bodyText.substring(0, 500) };
    });

    console.log('店舗名:', shopDetail.title);
    console.log('セクション:', shopDetail.sections);
    console.log('セラピストリンク:', shopDetail.therapistLinks);
    console.log('プロフィールリンク:', shopDetail.profileLinks);
    console.log('画像:', shopDetail.images);
    console.log('本文:', shopDetail.bodyText.substring(0, 300));

    // Look for therapist list pages
    const allLinks = await page.evaluate(() => {
      return [...document.querySelectorAll('a')]
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }))
        .filter(l => l.text.includes('セラピスト') || l.text.includes('在籍') || l.text.includes('スタッフ') || l.text.includes('キャスト'))
        .slice(0, 10);
    });
    console.log('セラピスト関連リンク:', allLinks);
  }

  // 3. Try area sub-page (e.g., ikebukuro)
  console.log('\n--- エリア別ページ: 池袋 ---');
  await sleep(2000);
  await page.goto('https://www.fues.jp/tokyoto/ikebukuro/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1000);

  const ikebukuro = await page.evaluate(() => {
    const shopLinks = [...document.querySelectorAll('a[href*="/store/"]')];
    const uniqueShops = [...new Set(shopLinks.map(a => a.href))];
    return {
      count: uniqueShops.length,
      urls: uniqueShops.slice(0, 5),
      title: document.title,
    };
  });
  console.log('池袋 店舗数:', ikebukuro.count);
  console.log('URLs:', ikebukuro.urls);

  await page.close();
}

async function investigateAromaesthe(browser) {
  console.log('\n' + '='.repeat(60));
  console.log('tokyo.aromaesthe.co.jp 詳細調査');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  try {
    await page.goto('https://tokyo.aromaesthe.co.jp/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const info = await page.evaluate(() => {
      const title = document.title;
      const bodyText = document.body.innerText.substring(0, 1000);
      const links = [...document.querySelectorAll('a')]
        .filter(a => a.href.includes('aromaesthe'))
        .slice(0, 20)
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));

      // Check for age verification
      const hasAge = bodyText.includes('18歳') || bodyText.includes('年齢');

      return { title, bodyText: bodyText.substring(0, 500), links, hasAge };
    });

    console.log('Title:', info.title);
    console.log('年齢確認:', info.hasAge);
    console.log('本文:', info.bodyText.substring(0, 300));
    console.log('リンク:');
    info.links.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

    // If age check, try to pass it
    if (info.hasAge) {
      const clicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('a, button, input')];
        const ageBtn = btns.find(b => {
          const text = (b.textContent || b.value || '').trim();
          return text.includes('はい') || text.includes('入場') || text.includes('18歳以上') || text.includes('ENTER');
        });
        if (ageBtn) { ageBtn.click(); return ageBtn.textContent || ageBtn.value; }
        return null;
      });
      if (clicked) {
        await sleep(2000);
        console.log(`年齢確認クリック: "${clicked}" -> ${page.url()}`);

        const afterAge = await page.evaluate(() => {
          const links = [...document.querySelectorAll('a')]
            .filter(a => a.href.includes('aromaesthe'))
            .slice(0, 20)
            .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));
          return { title: document.title, bodyText: document.body.innerText.substring(0, 500), links };
        });
        console.log('After age check:', afterAge.title);
        console.log('Links:', afterAge.links.slice(0, 10));
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  await page.close();
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  await investigateMeste(browser);
  await investigateFues(browser);
  await investigateAromaesthe(browser);

  await browser.close();
}

main().catch(console.error);
