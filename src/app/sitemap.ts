import type { MetadataRoute } from 'next';
import { getActiveGirlCount } from '@/lib/queries';

const GIRLS_PER_SITEMAP = 50000;
const BASE_URL = 'https://panemaji.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const girlCount = getActiveGirlCount();
  const girlSitemapCount = Math.ceil(girlCount / GIRLS_PER_SITEMAP);

  // Sitemap index entries - we use numbered sitemaps
  // 0 = static pages (top, prefectures, areas, shops)
  // 1..N = girl pages (50,000 per sitemap)
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
