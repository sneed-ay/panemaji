import type { MetadataRoute } from 'next';

const GIRLS_PER_SITEMAP = 50000;
// build 時に DB が無くても 404 を返さないためのフォールバック
// 実際の girl 数はリクエスト時 DB から取得する (revalidate=daily)
const FALLBACK_ESTIMATED_GIRLS = 500000;
const BASE_URL = 'https://panemaji.com';

// 1日に1回 revalidate して girl 数の増加に追従する
// (sitemap.xml index は対象 URL 数が多くないので毎リクエストでも軽い)
export const revalidate = 86400;

// Sitemap index - リクエスト時に DB から girl 数を取得して動的に shard を決める
// 子 sitemap (/sitemap/[id]/route.ts) は force-dynamic で実体生成
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let girlCount = FALLBACK_ESTIMATED_GIRLS;
  try {
    const { getActiveGirlCount } = await import('@/lib/queries');
    girlCount = getActiveGirlCount();
  } catch {
    // DB 未接続時 (build 時など) は fallback を使う
  }
  const girlSitemapCount = Math.ceil(girlCount / GIRLS_PER_SITEMAP);

  const sitemaps: MetadataRoute.Sitemap = [];

  // Static sitemap (id=0): top + guides + prefectures + areas + shops
  sitemaps.push({
    url: `${BASE_URL}/sitemap/0`,
    lastModified: new Date(),
  });

  // Girl sitemaps (id=1..N)
  for (let i = 0; i < girlSitemapCount; i++) {
    sitemaps.push({
      url: `${BASE_URL}/sitemap/${i + 1}`,
      lastModified: new Date(),
    });
  }

  return sitemaps;
}
