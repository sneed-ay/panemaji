#!/usr/bin/env node
/**
 * 画像未取得の girls を 各ソースの girlslist から後付け補完 (UPDATE ONLY、新規 INSERT しない)
 *
 * 既存の update-rd-girl-images.mjs は INSERT OR IGNORE で new girl を 作るが、
 * (name, shop_id) に UNIQUE 制約がないため INSERT が常に成功し、 既存girl と
 * 同名の duplicate を 量産してしまうバグがあった (2026-05-12 発覚 / 5/12 daily maintenance
 * Phase 2 dedup で 復元される想定の上で 短時間動かしてしまった)。
 *
 * 本スクリプトは:
 *   - rd (ranking-deli) + purelovers + cityheaven の 3 ソースに対応
 *   - INSERT は 一切しない (UPDATE のみ)
 *   - 名前マッチは normalize (空白・記号除去・カナひらがな揺れ吸収) で 緩和
 *   - 1 シェル 1 ソース順次実行 (puppeteer 不使用、 fetch のみ)
 *
 * 使い方:
 *   node scripts/fill-missing-images-safe.mjs              # 全ソース
 *   node scripts/fill-missing-images-safe.mjs --source=rd  # rd だけ
 *   node scripts/fill-missing-images-safe.mjs --dry-run    # UPDATE せず確認のみ
 *   node scripts/fill-missing-images-safe.mjs --limit=100  # shops 上限
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const args = process.argv.slice(2);
const SOURCE = args.find(a => a.startsWith('--source='))?.split('=')[1] || 'all';
const DRY = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 名前 正規化 (girls の本名揺れ吸収) ─────────────────────────
function normalizeName(name) {
  if (!name) return '';
  let n = String(name).normalize('NFKC').trim();
  // 装飾記号を除去 (★☆♡♥◆●○■★☆等)
  n = n.replace(/[★☆♡♥♦♢♪♬◆◇●○■□▲▽△▼※#＃@＠＊*&＆+＋=＝/／\\￥]/g, '');
  // 中黒・ハイフン・括弧・記号を除去
  n = n.replace(/[・･\-―—‐ーｰ~～〜!！?？.,，、。'"`’‘“”]/g, '');
  n = n.replace(/[（(\[【〔『「].*?[）)\]】〕』」]/g, '');
  n = n.replace(/[\s　]/g, '');
  // ひらがな→カタカナ
  n = n.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  return n.toLowerCase();
}

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.error(`  retry ${i + 1}/${retries}: ${e.message}`);
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// ─── rd: ranking-deli HTML パーサ ───────────────────────────
// 画像ホストは fuzoku-images.ranking-deli.jp と mensesthe-images.ranking-deli.jp の 2 系統
const RD_IMG_HOSTS = /(?:fuzoku-images|mensesthe-images)\.ranking-deli\.jp/;

function parseRdGirls(html) {
  const out = new Map(); // normalizedName → image_url
  // パターン1: <p class="girls-name">嬢名</p> の周辺
  const re = /<p\s+class="girls-name[^"]*">\s*([^<]+?)\s*<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1].trim();
    if (!name) continue;
    const start = Math.max(0, m.index - 2000);
    const end = Math.min(html.length, m.index + 2000);
    const ctx = html.slice(start, end);
    // background:url() or src="" / data-src="" のどれでも 拾う
    let im = ctx.match(new RegExp(`background:\\s*url\\((https://${RD_IMG_HOSTS.source}/[^)]+\\.(?:jpg|jpeg|png|webp))`));
    if (!im) im = ctx.match(new RegExp(`(?:src|data-src)=["'](https://${RD_IMG_HOSTS.source}/[^"']+\\.(?:jpg|jpeg|png|webp))`));
    if (im) {
      // icon_unregistered.png (no-photo placeholder) は弾く
      if (im[1].includes('icon_unregistered')) continue;
      out.set(normalizeName(name), im[1]);
    }
  }
  // パターン2: <p class="data-name ellipsis">嬢名</p> の周辺
  const re2 = /class="data-name\s+ellipsis"[^>]*>\s*([^<]+?)\s*</g;
  while ((m = re2.exec(html))) {
    const name = m[1].trim();
    if (!name) continue;
    const nk = normalizeName(name);
    if (out.has(nk)) continue;
    const start = Math.max(0, m.index - 2000);
    const end = Math.min(html.length, m.index + 2000);
    const ctx = html.slice(start, end);
    let im = ctx.match(new RegExp(`(?:src|data-src)=["'](https://${RD_IMG_HOSTS.source}/[^"']+\\.(?:jpg|jpeg|png|webp))`));
    if (!im) im = ctx.match(new RegExp(`background:\\s*url\\((https://${RD_IMG_HOSTS.source}/[^)]+\\.(?:jpg|jpeg|png|webp))`));
    if (im) {
      if (im[1].includes('icon_unregistered')) continue;
      out.set(nk, im[1]);
    }
  }
  return out;
}

// ─── purelovers HTML パーサ ───────────────────────────────
// パターン: <img alt="嬢名" data-src="//contents.purelovers.com/.../photo/.../original.jpg">
function parsePurelovers(html) {
  const out = new Map();
  // alt="嬢名" data-src="...purelovers.com/upload/girl/.../photo/..." を抽出
  const re = /<img\s+[^>]*alt=["']([^"']+?)["'][^>]*data-src=["']([^"']*contents\.purelovers\.com\/upload\/girl\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const name = m[1].trim();
    let url = m[2];
    if (!name || /^[\d\W]+$/.test(name)) continue;  // 数字記号のみは除外
    // URL の querystring (例: ?p=&dw=189&dh=252) を 削除して 元画像 URL に揃える
    url = url.split('?')[0];
    if (url.startsWith('//')) url = 'https:' + url;
    out.set(normalizeName(name), url);
  }
  return out;
}

// ─── ソース別 設定 ────────────────────────────────────────
const SOURCES = {
  rd: {
    label: '駅ちか (ranking-deli)',
    shopUrlPattern: '%ranking-deli%',
    girlListSuffix: 'girlslist/',
    parse: parseRdGirls,
  },
  purelovers: {
    label: 'ぴゅあらば (purelovers)',
    shopUrlPattern: '%purelovers%',
    girlListSuffix: '',  // shop page itself has girls
    parse: parsePurelovers,
  },
};

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');

  const sources = SOURCE === 'all' ? Object.keys(SOURCES) : [SOURCE];
  const grandTotals = { shops: 0, updated: 0, matchedShops: 0 };

  for (const src of sources) {
    const cfg = SOURCES[src];
    if (!cfg) { console.error(`unknown source: ${src}`); continue; }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📷 ${cfg.label}: 画像未取得 girls を 後付け補完`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const shops = db.prepare(`
      SELECT s.id, s.name, s.source_url,
        (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND (g.image_url IS NULL OR g.image_url='')) AS missing
      FROM shops s
      WHERE s.is_active=1 AND s.source_url LIKE ?
        AND EXISTS (SELECT 1 FROM girls g2 WHERE g2.shop_id=s.id AND g2.is_active=1 AND (g2.image_url IS NULL OR g2.image_url=''))
      ORDER BY missing DESC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
    `).all(cfg.shopUrlPattern);

    console.log(`  対象 shops: ${shops.length} (画像未取得 girls 多い順)`);

    // 各 shop の active girls を namek マップに事前 load
    let totalShops = 0, totalUpdated = 0;
    for (const s of shops) {
      totalShops++;
      const url = s.source_url.replace(/\/?$/, '/') + cfg.girlListSuffix;
      const html = await fetchPage(url);
      if (!html) { await sleep(1500 + Math.random() * 800); continue; }

      const scraped = cfg.parse(html);
      if (scraped.size === 0) { await sleep(1500 + Math.random() * 800); continue; }

      // shop の active 嬢を ID + 正規化名 で load
      const dbGirls = db.prepare(`
        SELECT id, name, image_url FROM girls WHERE shop_id=? AND is_active=1
      `).all(s.id);

      let updatedHere = 0;
      const updateStmt = db.prepare('UPDATE girls SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = \'\')');

      const txn = db.transaction(() => {
        for (const g of dbGirls) {
          if (g.image_url) continue;
          const nk = normalizeName(g.name);
          const img = scraped.get(nk);
          if (!img) continue;
          if (DRY) {
            updatedHere++;
          } else {
            const r = updateStmt.run(img, g.id);
            if (r.changes > 0) updatedHere++;
          }
        }
      });
      txn();
      totalUpdated += updatedHere;
      if (updatedHere > 0) {
        console.log(`  [${totalShops}/${shops.length}] ${s.name}: +${updatedHere}枚 / ${dbGirls.length}人中`);
      }
      await sleep(1500 + Math.random() * 800);
    }
    console.log(`\n  ✅ ${cfg.label} 完了: shops=${totalShops}, 画像 UPDATE=${totalUpdated}${DRY ? ' (DRY RUN)' : ''}`);
    grandTotals.shops += totalShops;
    grandTotals.updated += totalUpdated;
  }

  // 最終 stats
  const totalNoImg = db.prepare(`SELECT COUNT(*) AS c FROM girls WHERE is_active=1 AND (image_url IS NULL OR image_url='')`).get();
  const totalGirls = db.prepare(`SELECT COUNT(*) AS c FROM girls WHERE is_active=1`).get();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 全体: shops 処理=${grandTotals.shops}, 画像 UPDATE=${grandTotals.updated}${DRY ? ' (DRY RUN)' : ''}`);
  console.log(`   画像有 girls: ${totalGirls.c - totalNoImg.c}/${totalGirls.c} (${Math.round((1 - totalNoImg.c / totalGirls.c) * 100)}%)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  db.close();
}

main().catch(e => { console.error('💀', e); process.exit(1); });
