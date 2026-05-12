#!/usr/bin/env node
/**
 * tokyo.aromaesthe.co.jp 系 shop の 画像 補完
 *
 * 対象 shop:
 *   - source_url LIKE '%aromaesthe%'
 *   - 全 girls が menesu-seed-* で 画像なし
 *
 * 戦略:
 *   1. 各 shop の page を fetch
 *   2. <a class="showGirlDetail" href="...lady/{slug}/"><img src="...photo/lady/{id}/gl.jpg" alt="{名前}"></a>
 *      パターンで lady 情報を 抽出
 *   3. NEW girls (source_id = aromaesthe-{shop_id}-{lady_id}) を INSERT (UNIQUE)
 *   4. 既存 menesu-seed-* girls を is_active=0 に (placeholder の 駆逐)
 *
 * 使い方:
 *   node scripts/fill-aromaesthe-images.mjs            # 実行
 *   node scripts/fill-aromaesthe-images.mjs --dry-run  # 確認のみ
 *   node scripts/fill-aromaesthe-images.mjs --limit=10 # 上限 shops
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
const delay = () => sleep(1500 + Math.random() * 800);

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

/**
 * aromaesthe shop page から 在籍 lady の (id, name, image_url) を 抽出
 * パターン: <a class="showGirlDetail" href="./../../lady/{slug}/"><img src="...lady/{ID}/gl.jpg" alt="{名前}"></a>
 */
function parseLadies(html) {
  const out = [];
  const re = /<a[^>]*class="showGirlDetail"[^>]*>\s*<img\s+src="(https?:\/\/www\.aromaesthe\.co\.jp\/photo\/lady\/(\d+)\/gl\.(?:jpg|jpeg|png|webp))"\s+alt="([^"]+)"/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(html))) {
    const url = m[1];
    const ladyId = m[2];
    const name = m[3].trim();
    if (!seen.has(ladyId)) {
      seen.add(ladyId);
      out.push({ ladyId, name, imageUrl: url });
    }
  }
  return out;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎀 aromaesthe 画像 補完 (menesu-seed → aromaesthe-{id})');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 対象 shop を 2 種類に 分類:
  //   - has_real: 既に aromaesthe_* (本物) girls が ある → seed deactivate のみ (scrape 不要)
  //   - seed_only: girls 全部が menesu-seed-* → page を scrape して INSERT 必要
  const allShops = db.prepare(`
    SELECT s.id AS shop_id, s.source_url, s.name,
      EXISTS(SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND g.source_id LIKE 'aromaesthe\\_%' ESCAPE '\\') AS has_real
    FROM shops s
    WHERE s.is_active=1
      AND s.source_url LIKE '%aromaesthe%'
      AND EXISTS(SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND g.source_id LIKE 'menesu-seed-%')
  `).all();

  // has_real な shops は scrape 不要・即 seed deactivate (idempotent)
  let seedDeactivatedFast = 0;
  for (const s of allShops.filter(x => x.has_real)) {
    if (!DRY) {
      const r = db.prepare(
        `UPDATE girls SET is_active=0 WHERE shop_id=? AND source_id LIKE 'menesu-seed-%' AND is_active=1`
      ).run(s.shop_id);
      seedDeactivatedFast += r.changes;
    }
  }
  if (seedDeactivatedFast > 0) {
    console.log(`  [pre-pass] 既存 aromaesthe_* 持ち shop (${allShops.filter(x => x.has_real).length} 件) の seed deactivate=${seedDeactivatedFast}`);
  }

  // 残りの seed-only shops を scrape 対象
  const rows = allShops.filter(x => !x.has_real);
  const targets = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`  対象 seed-only shop: ${rows.length}`);
  if (LIMIT > 0) console.log(`  処理対象 (limit): ${targets.length}`);

  const findExistingStmt = db.prepare(
    `SELECT id FROM girls WHERE shop_id=? AND source_id=? LIMIT 1`
  );
  const insertGirlStmt = db.prepare(
    `INSERT INTO girls (name, shop_id, source_id, image_url, is_active, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
  );
  const updateImageStmt = db.prepare(
    `UPDATE girls SET image_url=? WHERE id=? AND (image_url IS NULL OR image_url='')`
  );
  const deactivateSeedStmt = db.prepare(
    `UPDATE girls SET is_active=0 WHERE shop_id=? AND source_id LIKE 'menesu-seed-%' AND is_active=1`
  );

  let processed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalDeactivated = 0;

  for (const shop of targets) {
    processed++;
    const html = await fetchPage(shop.source_url);
    if (!html) {
      if (processed % 25 === 0) console.log(`  [${processed}/${targets.length}] ${shop.name}: page取得失敗`);
      await delay();
      continue;
    }

    const ladies = parseLadies(html);
    if (ladies.length === 0) {
      // page は 取得できたが lady 表示なし → 閉店相当・seed を 駆逐 (shop は girl_count=0 で 閉店リストへ)
      if (!DRY) {
        const r = deactivateSeedStmt.run(shop.shop_id);
        totalDeactivated += r.changes;
        if (r.changes > 0) {
          console.log(`  [${processed}/${targets.length}] ${shop.name}: lady ゼロ → seed deactivate -${r.changes} (閉店扱い)`);
        }
      }
      await delay();
      continue;
    }

    let inserted = 0;
    let updated = 0;
    let deactivated = 0;
    const txn = db.transaction(() => {
      for (const lady of ladies) {
        const sourceId = `aromaesthe-${shop.shop_id}-${lady.ladyId}`;
        const existing = findExistingStmt.get(shop.shop_id, sourceId);
        if (DRY) {
          if (!existing) inserted++;
          continue;
        }
        if (existing) {
          // 既に同 source_id がある場合 image 更新 (idempotent)
          const r = updateImageStmt.run(lady.imageUrl, existing.id);
          if (r.changes > 0) updated++;
        } else {
          insertGirlStmt.run(lady.name, shop.shop_id, sourceId, lady.imageUrl);
          inserted++;
        }
      }
      // seed deactivate
      if (!DRY && inserted + updated > 0) {
        const r = deactivateSeedStmt.run(shop.shop_id);
        deactivated += r.changes;
      }
    });
    txn();

    totalInserted += inserted;
    totalUpdated += updated;
    totalDeactivated += deactivated;

    if (inserted + updated > 0 || processed % 20 === 0) {
      console.log(
        `  [${processed}/${targets.length}] ${shop.name}: +${inserted} (img only +${updated}) / seed -${deactivated} (lady${ladies.length})`
      );
    }
    await delay();
  }

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `✅ 完了: shop=${processed}${DRY ? ' (DRY)' : ''}, INSERT=${totalInserted}, image UPDATE=${totalUpdated}, seed deactivate=${totalDeactivated}`
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  db.close();
}

main().catch((e) => {
  console.error('💀', e);
  process.exit(1);
});
