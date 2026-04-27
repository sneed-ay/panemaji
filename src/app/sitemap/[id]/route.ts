import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://panemaji.com';
const GIRLS_PER_SITEMAP = 50000;

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildUrlEntry(loc: string, lastmod: string, changefreq: string, priority: number): string {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  // Lazy import to avoid build-time DB connection
  const { getAllAreas, getAllShopIds, getGirlIdsPaginated, getPrefectureSlugs, getAreaLastModMap, getPrefectureLastModMap } = await import('@/lib/queries');
  const { getAllGuideSlugs } = await import('@/lib/guides');

  const sitemapId = parseInt(params.id);
  if (isNaN(sitemapId)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  // Normalize a timestamp string to YYYY-MM-DD; fallback to today
  const toLastMod = (ts: string | null | undefined): string => {
    if (!ts) return today;
    const d = ts.substring(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  };

  // Guide article slugs — enumerate all directories under src/app/guide/* (except dynamic /guide/shop/[shopId])
  const guideSlugs = getAllGuideSlugs().filter((s) => s !== 'shop' && s !== 'area');

  if (sitemapId === 0) {
    // Static sitemap: top page, guide pages, prefecture pages, area pages, shop pages
    // Top page
    entries.push(buildUrlEntry(BASE_URL, today, 'daily', 1.0));

    // Guide index
    entries.push(buildUrlEntry(`${BASE_URL}/guide`, today, 'weekly', 0.8));

    // Guide articles
    for (const slug of guideSlugs) {
      entries.push(buildUrlEntry(`${BASE_URL}/guide/${slug}`, today, 'weekly', 0.7));
    }

    // Prefecture pages (lastmod = MAX(shops.last_seen_at) in that prefecture)
    const prefSlugs = getPrefectureSlugs();
    const prefLastMod = getPrefectureLastModMap();
    for (const slug of prefSlugs) {
      entries.push(buildUrlEntry(`${BASE_URL}/${slug}`, toLastMod(prefLastMod.get(slug)), 'daily', 0.9));
    }

    // Area pages (lastmod = MAX(shops.last_seen_at) in that area)
    const areas = getAllAreas();
    const areaLastMod = getAreaLastModMap();
    for (const area of areas) {
      entries.push(buildUrlEntry(`${BASE_URL}/area/${area.slug}`, toLastMod(areaLastMod.get(area.id)), 'daily', 0.8));
    }

    // Shop pages (lastmod = shops.last_seen_at)
    const shops = getAllShopIds();
    for (const shop of shops) {
      entries.push(buildUrlEntry(`${BASE_URL}/shop/${shop.id}`, toLastMod(shop.last_seen_at), 'weekly', 0.7));
    }
  } else {
    // Girl sitemaps (1-indexed: sitemapId 1 = offset 0, sitemapId 2 = offset 50000, etc.)
    const offset = (sitemapId - 1) * GIRLS_PER_SITEMAP;
    const girls = getGirlIdsPaginated(offset, GIRLS_PER_SITEMAP);
    if (girls.length === 0) {
      return new NextResponse('Not Found', { status: 404 });
    }
    for (const girl of girls) {
      entries.push(buildUrlEntry(`${BASE_URL}/girl/${girl.id}`, toLastMod(girl.last_seen_at), 'weekly', 0.6));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
