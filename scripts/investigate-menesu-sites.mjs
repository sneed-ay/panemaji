#!/usr/bin/env node
/**
 * メンエス専門サイト構造調査スクリプト
 * 各サイトのトップページ、店舗一覧、店舗詳細、女性一覧の構造を調査
 */

import puppeteer from 'puppeteer';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SITES = [
  {
    name: 'エステナビ',
    topUrl: 'https://esthe-navi.com/',
    tokyoGuesses: [
      'https://esthe-navi.com/tokyo/',
      'https://esthe-navi.com/area/tokyo/',
      'https://esthe-navi.com/13/',
    ],
  },
  {
    name: 'メンエスタウン',
    topUrl: 'https://menesu-town.com/',
    tokyoGuesses: [
      'https://menesu-town.com/tokyo/',
      'https://menesu-town.com/area/tokyo/',
    ],
  },
  {
    name: 'エステじゃぱん',
    topUrl: 'https://esthe-japan.com/',
    tokyoGuesses: [
      'https://esthe-japan.com/tokyo/',
      'https://esthe-japan.com/area/tokyo/',
    ],
  },
  {
    name: 'メンズエステDB',
    topUrl: 'https://menesu-db.com/',
    tokyoGuesses: [
      'https://menesu-db.com/tokyo/',
      'https://menesu-db.com/area/tokyo/',
    ],
  },
];

async function investigateSite(browser, site) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`調査: ${site.name} (${site.topUrl})`);
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  try {
    // 1. トップページ
    console.log('\n--- トップページ ---');
    const resp = await page.goto(site.topUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => null);
    if (!resp) {
      console.log('  接続失敗');
      await page.close();
      return { name: site.name, status: 'connection_failed' };
    }
    console.log(`  Status: ${resp.status()}`);
    console.log(`  URL: ${page.url()}`);

    const title = await page.title();
    console.log(`  Title: ${title}`);

    // Check for age verification
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    const hasAgeCheck = bodyText.includes('18歳') || bodyText.includes('年齢') || bodyText.includes('確認');
    console.log(`  年齢確認: ${hasAgeCheck ? 'あり' : 'なし'}`);

    // Find links containing tokyo/area keywords
    const links = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll('a')];
      return anchors
        .filter(a => {
          const href = a.href || '';
          const text = a.textContent || '';
          return (href.includes('tokyo') || href.includes('13') || text.includes('東京') || href.includes('kanto'));
        })
        .slice(0, 20)
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 50) }));
    });
    console.log(`  東京関連リンク (${links.length}件):`);
    links.forEach(l => console.log(`    ${l.text} -> ${l.href}`));

    // Find all area/region links
    const allLinks = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll('a')];
      return anchors
        .filter(a => {
          const href = a.href || '';
          return href.includes('/area') || href.includes('/pref') || href.includes('/region');
        })
        .slice(0, 10)
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 50) }));
    });
    if (allLinks.length) {
      console.log(`  エリア関連リンク (${allLinks.length}件):`);
      allLinks.forEach(l => console.log(`    ${l.text} -> ${l.href}`));
    }

    // 2. Try Tokyo pages
    let tokyoUrl = null;
    for (const guess of site.tokyoGuesses) {
      await sleep(1500);
      const r = await page.goto(guess, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
      if (r && r.status() === 200) {
        tokyoUrl = page.url();
        console.log(`\n--- 東京ページ発見: ${tokyoUrl} ---`);
        const t2 = await page.title();
        console.log(`  Title: ${t2}`);

        // Look for shop links
        const shopLinks = await page.evaluate(() => {
          const anchors = [...document.querySelectorAll('a')];
          return anchors
            .filter(a => {
              const href = a.href || '';
              return href.includes('/shop') || href.includes('/detail') || href.includes('/store');
            })
            .slice(0, 10)
            .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }));
        });
        console.log(`  店舗リンク (${shopLinks.length}件):`);
        shopLinks.forEach(l => console.log(`    ${l.text} -> ${l.href}`));

        // Look for shop list items
        const shopItems = await page.evaluate(() => {
          // Common selectors for shop listings
          const selectors = [
            '.shop-list', '.shop-item', '.shopList', '.shopItem',
            '[class*="shop"]', '[class*="store"]', '.list-item',
            'article', '.card'
          ];
          const results = [];
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) {
              results.push({ selector: sel, count: els.length, sample: els[0].innerHTML.substring(0, 200) });
            }
          }
          return results;
        });
        if (shopItems.length) {
          console.log('  店舗一覧要素:');
          shopItems.forEach(s => console.log(`    ${s.selector}: ${s.count}件`));
        }
        break;
      } else if (r) {
        console.log(`  ${guess} -> ${r.status()}`);
      }
    }

    // If we found tokyo link from top page, try it
    if (!tokyoUrl && links.length > 0) {
      await sleep(1500);
      const firstLink = links[0].href;
      console.log(`\n--- トップの東京リンクを試行: ${firstLink} ---`);
      const r = await page.goto(firstLink, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null);
      if (r && r.status() === 200) {
        tokyoUrl = page.url();
        console.log(`  URL: ${tokyoUrl}`);
        console.log(`  Title: ${await page.title()}`);

        const shopLinks = await page.evaluate(() => {
          return [...document.querySelectorAll('a')]
            .filter(a => a.href.includes('/shop') || a.href.includes('/detail') || a.href.includes('/store'))
            .slice(0, 10)
            .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) }));
        });
        console.log(`  店舗リンク (${shopLinks.length}件):`);
        shopLinks.forEach(l => console.log(`    ${l.text} -> ${l.href}`));
      }
    }

    // 3. HTML structure overview
    const structure = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      return {
        length: html.length,
        hasCloudflare: html.includes('cloudflare') || html.includes('cf-browser-verification'),
        hasRecaptcha: html.includes('recaptcha') || html.includes('g-recaptcha'),
        metaDesc: document.querySelector('meta[name="description"]')?.content?.substring(0, 100) || '',
      };
    });
    console.log(`  HTML長さ: ${structure.length}`);
    console.log(`  Cloudflare: ${structure.hasCloudflare}`);
    console.log(`  reCAPTCHA: ${structure.hasRecaptcha}`);
    console.log(`  Meta desc: ${structure.metaDesc}`);

    await page.close();
    return { name: site.name, status: 'ok', tokyoUrl };

  } catch (e) {
    console.log(`  エラー: ${e.message}`);
    await page.close();
    return { name: site.name, status: 'error', error: e.message };
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  for (const site of SITES) {
    const result = await investigateSite(browser, site);
    results.push(result);
    await sleep(2000);
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('調査結果サマリー');
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`  ${r.name}: ${r.status}${r.tokyoUrl ? ' -> ' + r.tokyoUrl : ''}`);
  });

  await browser.close();
}

main().catch(console.error);
