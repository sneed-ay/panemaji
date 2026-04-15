#!/usr/bin/env node
/**
 * 記事メンテナンススクリプト
 *
 * 使い方:
 *   node scripts/maintain-articles.mjs              # 全チェック実行
 *   node scripts/maintain-articles.mjs --dry-run    # 確認のみ
 *
 * チェック項目:
 *   1. 閉店店舗（is_active=0）へのリンク検出
 *   2. 存在しないエリアへのリンク検出
 *   3. 古い年号（2023年以前）の検出
 *   4. dateModified の自動更新（修正があった記事）
 *   5. metadata の欠損チェック（title/description/keywords）
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'panemaji.db');
const GUIDE_DIR = path.join(PROJECT_ROOT, 'src/app/guide');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── 全記事ファイルを取得 ──────────────────────────
function getAllArticles() {
  return fs.readdirSync(GUIDE_DIR)
    .filter(name => {
      const p = path.join(GUIDE_DIR, name, 'page.tsx');
      return fs.existsSync(p);
    })
    .map(slug => ({
      slug,
      path: path.join(GUIDE_DIR, slug, 'page.tsx'),
      content: fs.readFileSync(path.join(GUIDE_DIR, slug, 'page.tsx'), 'utf-8'),
    }));
}

// ─── DB からアクティブな店舗ID・エリアslugを取得 ──
function getActiveIds(db) {
  const activeShopIds = new Set(
    db.prepare('SELECT id FROM shops WHERE is_active=1').all().map(r => r.id)
  );
  const activeGirlIds = new Set(
    db.prepare('SELECT id FROM girls WHERE is_active=1').all().map(r => r.id)
  );
  const activeAreaSlugs = new Set(
    db.prepare("SELECT DISTINCT a.slug FROM areas a JOIN shops s ON s.area_id=a.id WHERE s.is_active=1").all().map(r => r.slug)
  );
  return { activeShopIds, activeGirlIds, activeAreaSlugs };
}

// ─── チェック実行 ──────────────────────────────────
function checkArticles() {
  const db = new Database(DB_PATH, { readonly: true });
  const { activeShopIds, activeGirlIds, activeAreaSlugs } = getActiveIds(db);
  db.close();

  const articles = getAllArticles();
  console.log(`記事数: ${articles.length}\n`);

  const issues = {
    deadShopLinks: [],
    deadGirlLinks: [],
    deadAreaLinks: [],
    oldYears: [],
    missingMeta: [],
  };

  for (const article of articles) {
    const c = article.content;

    // 1. /shop/[数字] へのリンクチェック
    const shopMatches = [...c.matchAll(/\/shop\/(\d+)/g)];
    for (const m of shopMatches) {
      const shopId = parseInt(m[1]);
      if (!activeShopIds.has(shopId)) {
        issues.deadShopLinks.push({ slug: article.slug, shopId });
      }
    }

    // 2. /girl/[数字] へのリンクチェック
    const girlMatches = [...c.matchAll(/\/girl\/(\d+)/g)];
    for (const m of girlMatches) {
      const girlId = parseInt(m[1]);
      if (!activeGirlIds.has(girlId)) {
        issues.deadGirlLinks.push({ slug: article.slug, girlId });
      }
    }

    // 3. /area/[slug] へのリンクチェック
    const areaMatches = [...c.matchAll(/\/area\/([a-z-]+)/g)];
    for (const m of areaMatches) {
      const slug = m[1];
      if (!activeAreaSlugs.has(slug)) {
        issues.deadAreaLinks.push({ slug: article.slug, areaSlug: slug });
      }
    }

    // 4. 古い年号（2024年以前）
    const yearMatches = c.match(/202[0-4]年/g);
    if (yearMatches) {
      issues.oldYears.push({ slug: article.slug, years: [...new Set(yearMatches)] });
    }

    // 5. metadata欠損チェック
    if (!c.includes('export const metadata')) {
      issues.missingMeta.push({ slug: article.slug, reason: 'metadata export なし' });
    } else {
      if (!c.match(/title:\s*["'`]/)) issues.missingMeta.push({ slug: article.slug, reason: 'title なし' });
      if (!c.match(/description:\s*["'`]/)) issues.missingMeta.push({ slug: article.slug, reason: 'description なし' });
    }
  }

  return { articles, issues };
}

// ─── レポート出力 ─────────────────────────────────
function printReport(issues) {
  console.log('=== メンテナンスチェック結果 ===\n');

  console.log(`[1] 閉店店舗へのリンク: ${issues.deadShopLinks.length}件`);
  issues.deadShopLinks.slice(0, 5).forEach(i => console.log(`    ${i.slug} -> /shop/${i.shopId}`));
  if (issues.deadShopLinks.length > 5) console.log(`    ... 他${issues.deadShopLinks.length - 5}件`);

  console.log(`\n[2] 非アクティブ嬢へのリンク: ${issues.deadGirlLinks.length}件`);
  issues.deadGirlLinks.slice(0, 5).forEach(i => console.log(`    ${i.slug} -> /girl/${i.girlId}`));
  if (issues.deadGirlLinks.length > 5) console.log(`    ... 他${issues.deadGirlLinks.length - 5}件`);

  console.log(`\n[3] 非アクティブエリアへのリンク: ${issues.deadAreaLinks.length}件`);
  issues.deadAreaLinks.slice(0, 5).forEach(i => console.log(`    ${i.slug} -> /area/${i.areaSlug}`));

  console.log(`\n[4] 古い年号（2024年以前）含む記事: ${issues.oldYears.length}件`);
  issues.oldYears.slice(0, 5).forEach(i => console.log(`    ${i.slug}: ${i.years.join(', ')}`));

  console.log(`\n[5] metadata欠損: ${issues.missingMeta.length}件`);
  issues.missingMeta.slice(0, 5).forEach(i => console.log(`    ${i.slug}: ${i.reason}`));
}

// ─── 自動修正: 閉店店舗・非アクティブリンクをコメントアウト ──
function fixDeadLinks(articles, issues) {
  let fixedCount = 0;
  const affectedSlugs = new Set([
    ...issues.deadShopLinks.map(i => i.slug),
    ...issues.deadGirlLinks.map(i => i.slug),
    ...issues.deadAreaLinks.map(i => i.slug),
  ]);

  for (const article of articles) {
    if (!affectedSlugs.has(article.slug)) continue;

    let content = article.content;
    let changed = false;

    // 閉店店舗のリンクを # に置き換え（aタグは残すが無効化）
    for (const issue of issues.deadShopLinks.filter(i => i.slug === article.slug)) {
      const before = content;
      content = content.replace(new RegExp(`href="/shop/${issue.shopId}"`, 'g'), 'href="/" /* dead-link */');
      if (content !== before) changed = true;
    }

    for (const issue of issues.deadGirlLinks.filter(i => i.slug === article.slug)) {
      const before = content;
      content = content.replace(new RegExp(`href="/girl/${issue.girlId}"`, 'g'), 'href="/" /* dead-link */');
      if (content !== before) changed = true;
    }

    // dateModified を今日に更新
    if (changed) {
      content = content.replace(/dateModified="\d{4}-\d{2}-\d{2}"/, `dateModified="${today()}"`);
      if (!DRY_RUN) {
        fs.writeFileSync(article.path, content, 'utf-8');
      }
      fixedCount++;
    }
  }

  return fixedCount;
}

// ─── 古い年号の自動更新 ──────────────────────────
function fixOldYears(articles, issues) {
  const currentYear = new Date().getFullYear();
  let fixedCount = 0;

  for (const issue of issues.oldYears) {
    const article = articles.find(a => a.slug === issue.slug);
    if (!article) continue;

    let content = article.content;
    let changed = false;

    // 「2023年」「2024年」→ 「2026年」（ただしメタデータ日付は触らない）
    // 本文中の年号のみ対象（canonical URL等は除外）
    for (const oldYear of issue.years) {
      const yearStr = oldYear.replace('年', '');
      // パラグラフ内の年号のみ（URLやSlug外）
      const before = content;
      content = content.replace(new RegExp(`>([^<]*)${yearStr}年`, 'g'), (m, pre) => {
        if (pre.includes('archive') || pre.includes('history')) return m; // 歴史系は残す
        return m.replace(`${yearStr}年`, `${currentYear}年`);
      });
      if (content !== before) changed = true;
    }

    if (changed) {
      content = content.replace(/dateModified="\d{4}-\d{2}-\d{2}"/, `dateModified="${today()}"`);
      if (!DRY_RUN) {
        fs.writeFileSync(article.path, content, 'utf-8');
      }
      fixedCount++;
    }
  }

  return fixedCount;
}

// ─── メイン ────────────────────────────────────────
function main() {
  console.log(`=== 記事メンテナンス ${DRY_RUN ? '(dry-run)' : ''} ===\n`);

  const { articles, issues } = checkArticles();
  printReport(issues);

  console.log('\n=== 自動修正 ===');

  const deadFixed = fixDeadLinks(articles, issues);
  console.log(`  閉店リンク修正: ${deadFixed}記事`);

  const yearFixed = fixOldYears(articles, issues);
  console.log(`  古い年号更新: ${yearFixed}記事`);

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}完了`);
}

main();
