import type { MetadataRoute } from 'next';

const GIRLS_PER_SITEMAP = 50000;
const ESTIMATED_GIRLS = 150000;
const BASE_URL = 'https://panemaji.com';

// Sitemap index - uses estimated count to avoid build-time DB access
// The actual girl pages are generated dynamically in /sitemap/[id]
export default function sitemap(): MetadataRoute.Sitemap {
  const girlSitemapCount = Math.ceil(ESTIMATED_GIRLS / GIRLS_PER_SITEMAP);

  const sitemaps: MetadataRoute.Sitemap = [];

  // Static sitemap (id=0): top + prefectures + areas + shops
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
