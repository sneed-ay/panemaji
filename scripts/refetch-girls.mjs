#!/usr/bin/env node
/**
 * 嬢データ再取得スクリプト
 *
 * DBの全cityheaven店舗から直接嬢データを取得。
 * エリア定義に依存せず、shop.source_urlから直接girllistを取得する。
 *
 * 対象: 嬢0人の店舗 + 嬢がちょうど100人の店舗（上限で止まっている可能性）
 *
 * 使い方:
 *   node scripts/refetch-girls.mjs                # 嬢0人 + 100人上限の店舗
 *   node scripts/refetch-girls.mjs --all          # 全cityheaven店舗
 *   node scripts/refetch-girls.mjs --resume       # 中断から再開
 */

import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const PROGRESS_FILE = path.join(PROJECT_ROOT, 'refetch-progress.json');

const DELAY_MIN = 1500;
const DELAY_JITTER = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function delay() { return sleep(DELAY_MIN + Math.random() * DELAY_JITTER); }

function parseGirlList(html) {
  const girls = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(liRegex)) {
    const liHtml = match[1];
    const girlIdMatch = liHtml.match(/girlid-(\d+)/);
    if (!girlIdMatch) continue;

    // 旧形式: class="girllisttext" / 新形式: class="girl_caption"
    let textBlock = liHtml.match(/<[^>]*class="girllisttext"[^>]*>([\s\S]*?)<\/div>/i);
    if (!textBlock) textBlock = liHtml.match(/<div[^>]*class="girl_caption"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (!textBlock) textBlock = liHtml.match(/<div[^>]*class="girl_caption"[^>]*>([\s\S]*)/i);

    const text = textBlock ? textBlock[1].replace(/<[^>]*>/g, '') : liHtml.replace(/<[^>]*>/g, '');
    const lines = text.split('\n').map(s => s.trim()).filter(s => s && s.length < 100);
    if (lines.length < 1) continue;

    // 名前の抽出: title属性 > girllisttext先頭行 > img alt
    let name = '';
    const titleMatch = liHtml.match(/title="([^"]+)"/);
    const altMatch = liHtml.match(/<img[^>]*alt="([^"]+)"/);
    if (titleMatch && titleMatch[1].length < 20) {
      name = titleMatch[1].trim();
    } else {
      // テキストブロックから名前を探す
      for (const line of lines) {
        const cleaned = line.replace(/\s*(更新|NEW|新人|現在待機中|✨[^✨]*✨|💥[^💥]*💥|ご新規[^\s]*).*$/, '').trim();
        if (cleaned && cleaned.length >= 1 && cleaned.length <= 15
            && !cleaned.includes('歳') && !cleaned.match(/^T\d/) && !cleaned.match(/^\d/)
            && !cleaned.includes('・') && !cleaned.includes('No.')
            && !cleaned.includes('写メ') && !cleaned.includes('口コミ')) {
          name = cleaned;
          break;
        }
      }
    }
    if (!name && altMatch) name = altMatch[1].trim();
    if (!name || name.length > 20) continue;

    // 全テキストから年齢・スペック抽出（タブ・改行を正規化）
    const fullText = liHtml.replace(/<[^>]*>/g, ' ').replace(/[\t\n\r]+/g, ' ').replace(/\s+/g, ' ');
    // 年齢: 「24歳」「〔24歳〕」
    const ageMatch = fullText.match(/[\[〔(]?(\d{2})歳[\]〕)]?/);
    // 身長: T157
    const heightMatch = fullText.match(/T(\d{3})/);
    // スペック: "82 (C) ・ 54 ・ 82" or "82（C）・54・82"
    const sizeMatch = fullText.match(/(\d{2,3})\s*[（(]\s*(\w+)\s*[）)]\s*[･・]\s*(\d{2,3})\s*[･・]\s*(\d{2,3})/);

    girls.push({
      name, sourceId: girlIdMatch[1],
      age: ageMatch ? parseInt(ageMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1]) : null,
      bust: sizeMatch ? parseInt(sizeMatch[1]) : null,
      cup: sizeMatch ? sizeMatch[2] : null,
      waist: sizeMatch ? parseInt(sizeMatch[3]) : null,
      hip: sizeMatch ? parseInt(sizeMatch[4]) : null,
    });
  }
  return girls;
}

async function parseImageUrls(page) {
  try {
    return await page.evaluate(() => {
      const results = {};
      const links = document.querySelectorAll('a[href*="girlid-"]');
      for (const link of links) {
        const match = link.href.match(/girlid-(\d+)/);
        if (!match) continue;
        const img = link.querySelector('img.no_login') || link.querySelector('img[alt]');
        if (img) {
          const src = img.src || img.getAttribute('data-original') || img.getAttribute('data-src') || '';
          if (src.includes('img2.cityheaven.net/img/girls')) {
            results[match[1]] = src.split('?')[0];
          }
        }
      }
      return results;
    });
  } catch { return {}; }
}

// ─── メイン ──────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const fetchAll = args.includes('--all');
  const resumeMode = args.includes('--resume');
  const minIdArg = args.find(a => a.startsWith('--min-id='));
  const maxIdArg = args.find(a => a.startsWith('--max-id='));
  const minId = minIdArg ? parseInt(minIdArg.split('=')[1]) : 0;
  const maxId = maxIdArg ? parseInt(maxIdArg.split('=')[1]) : Infinity;

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');

  // 対象店舗を取得
  let query;
  if (fetchAll) {
    query = `SELECT id, name, source_url FROM shops
             WHERE is_active = 1 AND source_url LIKE '%cityheaven.net%'
             ORDER BY id`;
  } else {
    query = `SELECT s.id, s.name, s.source_url FROM shops s
             WHERE s.is_active = 1 AND s.source_url LIKE '%cityheaven.net%'
               AND (
                 NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id = s.id AND g.is_active = 1)
                 OR (SELECT COUNT(*) FROM girls g WHERE g.shop_id = s.id AND g.is_active = 1) BETWEEN 95 AND 105
                 OR (SELECT COUNT(*) FROM girls g WHERE g.shop_id = s.id AND g.is_active = 1) BETWEEN 195 AND 205
               )
             ORDER BY s.id`;
  }
  let shops = db.prepare(query).all();

  // ID範囲フィルタ（並列実行用）
  if (minId > 0 || maxId < Infinity) {
    shops = shops.filter(s => s.id >= minId && s.id <= maxId);
  }

  // resume
  let resumeId = 0;
  if (resumeMode) {
    try {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      resumeId = progress.lastShopId || 0;
      console.log(`Resuming from shop id > ${resumeId}`);
    } catch {}
  }
  if (resumeId > 0) shops = shops.filter(s => s.id > resumeId);

  console.log(`=== 嬢データ再取得 ===`);
  console.log(`対象: ${shops.length} 店舗 (${fetchAll ? '全店舗' : '嬢0人 + 100人上限'})`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  await page.setCookie({ name: 'nenrei', value: 'y', domain: '.cityheaven.net' });
  await page.setViewport({ width: 1280, height: 800 });

  const now = new Date().toISOString();
  const getGirlBySourceId = db.prepare('SELECT id, name, age, height, bust, cup, waist, hip FROM girls WHERE source_id = ?');
  const getGirlByNameShop = db.prepare('SELECT id FROM girls WHERE name = ? AND shop_id = ? AND source_id IS NULL');
  const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, age, height, bust, cup, waist, hip, image_url, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
  const updateGirl = db.prepare('UPDATE girls SET name = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, is_active = 1, last_seen_at = ? WHERE id = ?');
  const updateGirlImage = db.prepare("UPDATE girls SET image_url = ? WHERE source_id = ? AND (image_url IS NULL OR image_url = '')");
  const markSeen = db.prepare('UPDATE girls SET is_active = 1, last_seen_at = ? WHERE id = ?');

  let totalNew = 0, totalUpdated = 0, totalImages = 0, totalProcessed = 0, totalErrors = 0;

  for (const shop of shops) {
    totalProcessed++;
    const girlListUrl = shop.source_url.replace(/\/$/, '') + '/girllist/';

    try {
      // ページ1
      await page.goto(girlListUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);
      let html = await page.content();

      // 年齢確認ページの場合
      if (html.length < 5000 && html.includes('nenrei')) {
        await page.setCookie({ name: 'nenrei', value: 'y', domain: '.cityheaven.net' });
        await page.goto(girlListUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(1000);
        html = await page.content();
      }

      let allScraped = parseGirlList(html);
      let allImages = allScraped.length > 0 ? await parseImageUrls(page) : {};

      // 全ページ取得
      if (allScraped.length > 0) {
        const firstCount = allScraped.length;
        let pageNum = 2;
        let emptyCount = 0;
        while (pageNum <= 50) {
          try {
            await delay();
            const pageUrl = girlListUrl.replace(/\/$/, '') + `/p${pageNum}/`;
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(1000);
            const htmlN = await page.content();
            const girlsN = parseGirlList(htmlN);
            if (girlsN.length === 0) {
              emptyCount++;
              if (emptyCount >= 2) break;
              pageNum++;
              continue;
            }
            emptyCount = 0;
            allScraped = [...allScraped, ...girlsN];
            Object.assign(allImages, await parseImageUrls(page));
            pageNum++;
          } catch { break; }
        }
      }

      // DB書き込み
      if (allScraped.length > 0) {
        let sNew = 0, sUpd = 0, sImg = 0;
        const tx = db.transaction(() => {
          for (const girl of allScraped) {
            const imageUrl = allImages[girl.sourceId] || null;
            const ex = getGirlBySourceId.get(girl.sourceId);
            if (ex) {
              const changed = ex.name !== girl.name || ex.age !== girl.age || ex.height !== girl.height;
              if (changed) updateGirl.run(girl.name, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, now, ex.id);
              else markSeen.run(now, ex.id);
              if (imageUrl) { const r = updateGirlImage.run(imageUrl, girl.sourceId); if (r.changes > 0) sImg++; }
              sUpd++;
              continue;
            }
            const seed = getGirlByNameShop.get(girl.name, shop.id);
            if (seed) {
              db.prepare('UPDATE girls SET source_id = ?, age = ?, height = ?, bust = ?, cup = ?, waist = ?, hip = ?, image_url = COALESCE(image_url, ?), is_active = 1, last_seen_at = ? WHERE id = ?')
                .run(girl.sourceId, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, imageUrl, now, seed.id);
              sUpd++;
              continue;
            }
            insertGirl.run(girl.name, shop.id, girl.age, girl.height, girl.bust, girl.cup, girl.waist, girl.hip, imageUrl, girl.sourceId, now);
            sNew++;
            if (imageUrl) sImg++;
          }
        });
        tx();
        totalNew += sNew;
        totalUpdated += sUpd;
        totalImages += sImg;
      }

      if (totalProcessed % 50 === 0 || allScraped.length > 0) {
        console.log(`  [${totalProcessed}/${shops.length}] ${shop.name}: ${allScraped.length}人取得 (新規${totalNew} 更新${totalUpdated})`);
      }

      // 進捗保存
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastShopId: shop.id, totalProcessed, totalNew, totalUpdated }));
      await delay();

    } catch (e) {
      totalErrors++;
      if (totalErrors % 10 === 0) console.log(`  [error] ${shop.name}: ${e.message}`);
      await sleep(3000);
    }
  }

  await browser.close();

  console.log('');
  console.log('=== 完了 ===');
  console.log(`処理: ${totalProcessed}店`);
  console.log(`新規嬢: ${totalNew}`);
  console.log(`更新嬢: ${totalUpdated}`);
  console.log(`画像: ${totalImages}`);
  console.log(`エラー: ${totalErrors}`);

  // 最終統計
  const finalShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get().c;
  const finalGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get().c;
  const zeroGirls = db.prepare('SELECT COUNT(*) as c FROM shops s WHERE s.is_active=1 AND s.source_url LIKE \'%cityheaven%\' AND NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)').get().c;
  console.log(`\n店舗: ${finalShops} | 嬢: ${finalGirls} | cityheaven嬢0人残: ${zeroGirls}`);

  try { fs.unlinkSync(PROGRESS_FILE); } catch {}
  db.close();
}

main().catch(e => { console.error(e); process.exit(1); });
