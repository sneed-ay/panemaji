#!/usr/bin/env node
/**
 * esthe-zukan.com girls の 画像補完 (UPDATE only)
 *
 * 対象: girls.source_id LIKE 'esthezukan_%' で image_url が NULL なもの (~4,940人)
 *
 * パターン:
 *   - DB の source_id: esthezukan_{stfid}  例) esthezukan_44244
 *   - 画像 URL: https://esthe-zukan.com/data/staff/{N}/{stfid}/stf_{hash}.jpg
 *   - 取得元: shop の source_url (例: https://esthe-zukan.com/hokkaido/.../4226) に /staff 付与
 *
 * 使い方:
 *   node scripts/fill-esthezukan-images.mjs            # 実行
 *   node scripts/fill-esthezukan-images.mjs --dry-run  # 確認のみ
 *   node scripts/fill-esthezukan-images.mjs --limit=50 # shop 数上限
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(1200 + Math.random() * 600);

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// /data/staff/{N}/{stfid}/stf_{hash}.{ext} を マッチ
// stfid → image URL の Map を 返す
function parseStaffImages(html) {
  const out = new Map();
  const re = /https?:\/\/esthe-zukan\.com\/data\/staff\/(\d+)\/(\d+)\/stf_[a-f0-9]+\.(?:jpg|jpeg|png|webp)/g;
  let m;
  while ((m = re.exec(html))) {
    const stfid = m[2];
    const url = m[0];
    if (!out.has(stfid)) out.set(stfid, url);
  }
  return out;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎀 esthe-zukan.com の girls 画像補完');
  console.log('   (esthezukan_NNNN source_id の 画像なし girls)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // shop 別に girls を まとめる
  const rows = db.prepare(`
    SELECT g.id, g.source_id, g.shop_id, s.source_url
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE g.is_active=1
      AND (g.image_url IS NULL OR g.image_url='')
      AND g.source_id LIKE 'esthezukan_%'
      AND s.source_url LIKE '%esthe-zukan.com%'
  `).all();

  // shop_id → { source_url, girls: [{id, stfid}] }
  const byShop = new Map();
  for (const g of rows) {
    const m = g.source_id.match(/^esthezukan_(\d+)$/);
    if (!m) continue;
    const stfid = m[1];
    if (!byShop.has(g.shop_id)) {
      byShop.set(g.shop_id, { source_url: g.source_url, girls: [] });
    }
    byShop.get(g.shop_id).girls.push({ id: g.id, stfid });
  }

  const shopIds = [...byShop.keys()];
  // girls 数の多い順 (大きい shop 優先で 効率良く)
  shopIds.sort((a, b) => byShop.get(b).girls.length - byShop.get(a).girls.length);
  const targets = LIMIT > 0 ? shopIds.slice(0, LIMIT) : shopIds;

  console.log(`  対象 esthe-zukan shop: ${shopIds.length} / girls: ${rows.length}`);
  if (LIMIT > 0) console.log(`  処理対象 (limit): ${targets.length}`);

  const updateStmt = db.prepare(
    `UPDATE girls SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '')`
  );

  let processed = 0;
  let totalUpdated = 0;
  let totalImagesFound = 0;
  for (const shopId of targets) {
    processed++;
    const { source_url, girls } = byShop.get(shopId);
    // /staff 付与 (末尾 / は 削る)
    const cleanUrl = source_url.replace(/\/+$/, '');
    const staffUrl = `${cleanUrl}/staff`;

    const html = await fetchPage(staffUrl);
    if (!html) {
      if (processed % 50 === 0) {
        console.log(`  [${processed}/${targets.length}] shop_id=${shopId}: page取得失敗`);
      }
      continue;
    }

    const stfMap = parseStaffImages(html);
    totalImagesFound += stfMap.size;
    if (stfMap.size === 0) {
      await delay();
      continue;
    }

    let updated = 0;
    const txn = db.transaction(() => {
      for (const g of girls) {
        const img = stfMap.get(g.stfid);
        if (!img) continue;
        if (DRY) {
          updated++;
        } else {
          const r = updateStmt.run(img, g.id);
          if (r.changes > 0) updated++;
        }
      }
    });
    txn();
    totalUpdated += updated;

    if (updated > 0 || processed % 25 === 0) {
      console.log(
        `  [${processed}/${targets.length}] shop_id=${shopId}: img+${updated}/${girls.length} (page画像${stfMap.size})`
      );
    }
    await delay();
  }

  const remaining = db.prepare(`
    SELECT COUNT(*) AS c FROM girls
    WHERE is_active=1 AND (image_url IS NULL OR image_url='')
      AND source_id LIKE 'esthezukan_%'
  `).get();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 完了: shop=${processed}, 画像 UPDATE=${totalUpdated}${DRY ? ' (DRY)' : ''}, ページ画像合計=${totalImagesFound}`);
  console.log(`   esthezukan_* 残り画像なし girls: ${remaining.c}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  db.close();
}

main().catch((e) => {
  console.error('💀', e);
  process.exit(1);
});
