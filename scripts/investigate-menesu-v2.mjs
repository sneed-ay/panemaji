#!/usr/bin/env node
/**
 * メンエス専門サイト構造調査 v2
 * 実在するメンエスポータルサイトを調査
 */

import puppeteer from 'puppeteer';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SITES = [
  {
    name: 'メンズエステサーチ',
    urls: ['https://m-este.com/', 'https://m-este.com/tokyo/'],
  },
  {
    name: '週刊エステ',
    urls: ['https://www.fues.jp/', 'https://www.fues.jp/tokyoto/'],
  },
  {
    name: 'アロマエステ案内所',
    urls: ['https://www.aromaesthe.co.jp/', 'https://www.aromaesthe.co.jp/tokyo/'],
  },
  {
    name: 'エステ歓歓',
    urls: ['https://www.hoan-hoan.com/', 'https://www.hoan-hoan.com/tokyo/'],
  },
  {
    name: 'メンエス案内所',
    urls: ['https://www.menesu-annai.com/', 'https://www.menesu-annai.com/tokyo/'],
  },
  {
    name: 'men-esthe.jp',
    urls: ['https://men-esthe.jp/', 'https://men-esthe.jp/tokyo/'],
  },
  {
    name: 'メンズエステ・ポータル',
    urls: ['https://mensesthe-portal.com/', 'https://mensesthe-portal.com/tokyo/'],
  },
];

async function investigateSite(browser, site) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`調査: ${site.name}`);
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja,en;q=0.9' });

  const result = { name: site.name, accessible: false, tokyoUrl: null, shopCount: 0 };

  for (const url of site.urls) {
    try {
      console.log(`\n  URL: ${url}`);
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => null);
      if (!resp) {
        console.log('    接続失敗');
        continue;
      }
      const status = resp.status();
      console.log(`    Status: ${status}`);
      if (status >= 400) continue;

      const finalUrl = page.url();
      console.log(`    Final URL: ${finalUrl}`);
      const title = await page.title();
      console.log(`    Title: ${title}`);

      result.accessible = true;

      // Check for age verification or Cloudflare
      const checks = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        const bodyText = document.body?.innerText || '';
        return {
          hasAgeCheck: bodyText.includes('18歳') || bodyText.includes('年齢確認'),
          hasCloudflare: html.includes('cloudflare') || html.includes('cf-browser'),
          hasRecaptcha: html.includes('recaptcha'),
          bodyLength: html.length,
        };
      });
      console.log(`    年齢確認: ${checks.hasAgeCheck}, CF: ${checks.hasCloudflare}, reCAPTCHA: ${checks.hasRecaptcha}`);
      console.log(`    HTML length: ${checks.bodyLength}`);

      // Click age verification if present
      if (checks.hasAgeCheck) {
        const clicked = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('a, button, input[type="submit"]')];
          const ageBtn = btns.find(b => {
            const text = b.textContent || b.value || '';
            return text.includes('はい') || text.includes('入場') || text.includes('18歳以上') || text.includes('ENTER') || text.includes('同意');
          });
          if (ageBtn) { ageBtn.click(); return true; }
          return false;
        });
        if (clicked) {
          await sleep(2000);
          console.log(`    年齢確認クリック -> ${page.url()}`);
        }
      }

      // Find tokyo/area links
      const tokyoLinks = await page.evaluate(() => {
        return [...document.querySelectorAll('a')]
          .filter(a => {
            const href = (a.href || '').toLowerCase();
            const text = a.textContent || '';
            return (href.includes('tokyo') || href.includes('13') || text.includes('東京'))
              && !href.includes('javascript:');
          })
          .slice(0, 15)
          .map(a => ({ href: a.href, text: (a.textContent || '').trim().substring(0, 60) }));
      });
      if (tokyoLinks.length) {
        console.log(`    東京リンク (${tokyoLinks.length}件):`);
        tokyoLinks.slice(0, 8).forEach(l => console.log(`      ${l.text} -> ${l.href}`));
      }

      // If this is a tokyo page, look for shop listings
      if (url.includes('tokyo') || finalUrl.includes('tokyo')) {
        result.tokyoUrl = finalUrl;

        // Find shop-like elements
        const shopAnalysis = await page.evaluate(() => {
          const allLinks = [...document.querySelectorAll('a')];
          const shopLinks = allLinks.filter(a => {
            const href = (a.href || '').toLowerCase();
            return href.includes('shop') || href.includes('salon') || href.includes('detail') || href.includes('store');
          });

          // Look for listing containers
          const listSelectors = [
            '.shop', '.salon', '.store', '.item', '.card', 'article',
            '[class*="shop"]', '[class*="salon"]', '[class*="list"]',
            'table tr', '.result', '.search-result'
          ];
          const containers = {};
          for (const sel of listSelectors) {
            const els = document.querySelectorAll(sel);
            if (els.length > 1) {
              containers[sel] = {
                count: els.length,
                sampleHTML: els[0].innerHTML.substring(0, 300),
                sampleText: els[0].textContent.trim().substring(0, 150),
              };
            }
          }

          return {
            shopLinkCount: shopLinks.length,
            shopLinkSamples: shopLinks.slice(0, 5).map(a => ({
              href: a.href,
              text: (a.textContent || '').trim().substring(0, 80),
            })),
            containers,
            totalLinks: allLinks.length,
          };
        });

        console.log(`    店舗リンク数: ${shopAnalysis.shopLinkCount}`);
        if (shopAnalysis.shopLinkSamples.length) {
          console.log('    店舗リンクサンプル:');
          shopAnalysis.shopLinkSamples.forEach(l => console.log(`      ${l.text} -> ${l.href}`));
        }
        if (Object.keys(shopAnalysis.containers).length) {
          console.log('    リスト要素:');
          for (const [sel, info] of Object.entries(shopAnalysis.containers)) {
            console.log(`      ${sel}: ${info.count}件`);
            console.log(`        text: ${info.sampleText.substring(0, 100)}`);
          }
        }
        result.shopCount = shopAnalysis.shopLinkCount;
      }

      await sleep(2000);
    } catch (e) {
      console.log(`    エラー: ${e.message}`);
    }
  }

  await page.close();
  return result;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  for (const site of SITES) {
    const r = await investigateSite(browser, site);
    results.push(r);
    await sleep(2000);
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('調査結果サマリー');
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`  ${r.name}: accessible=${r.accessible}, tokyo=${r.tokyoUrl || 'なし'}, shops=${r.shopCount}`);
  });

  await browser.close();
}

main().catch(console.error);
