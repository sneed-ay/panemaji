import { NextResponse } from 'next/server';

const GIRLS_PER_SITEMAP = 50000;
// build 時に DB が無くても 404 を出さないためのフォールバック
const FALLBACK_GIRL_COUNT = 500000;
const BASE_URL = 'https://panemaji.com';

// 1日に1回 revalidate して girl 数の増加に追従する
export const revalidate = 86400;

export async function GET() {
  let girlCount = FALLBACK_GIRL_COUNT;
  // 2026-06-03: lastmod を today固定 → 最新 last_seen_at(日付) ベースに (CLAUDE.md準拠・クロールバジェット節約)。
  let lastmod = new Date().toISOString().slice(0, 10);
  try {
    // 質フィルタ後の数で shard 計算 (image OR review がない girls は sitemap 対象外)
    const { getActiveGirlCountForSitemap, getGlobalMaxLastSeen } = await import('@/lib/queries');
    girlCount = getActiveGirlCountForSitemap();
    const max = getGlobalMaxLastSeen();
    if (max) lastmod = max.slice(0, 10); // "YYYY-MM-DD" (W3C date format, lastmod として valid)
  } catch {
    // DB 未接続時 (build 時など) は fallback を使う
  }
  const girlSitemapCount = Math.ceil(girlCount / GIRLS_PER_SITEMAP);

  const entries: string[] = [];
  // /sitemap/0 = top + guides + prefectures + areas + shops
  entries.push(
    `  <sitemap>
    <loc>${BASE_URL}/sitemap/0</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  );
  // 画像 sitemap (Google画像検索 SEO)
  entries.push(
    `  <sitemap>
    <loc>${BASE_URL}/sitemap-image.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  );
  // エリア×業態ガイド sitemap
  entries.push(
    `  <sitemap>
    <loc>${BASE_URL}/sitemap-area-guide.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  );
  // /sitemap/1..N = girl sitemaps (5万件/shard)
  for (let i = 1; i <= girlSitemapCount; i++) {
    entries.push(
      `  <sitemap>
    <loc>${BASE_URL}/sitemap/${i}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
