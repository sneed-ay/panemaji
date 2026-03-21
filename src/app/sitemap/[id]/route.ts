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
  const { getAllAreas, getAllShopIds, getGirlIdsPaginated, getPrefectureSlugs } = await import('@/lib/queries');

  const sitemapId = parseInt(params.id);
  if (isNaN(sitemapId)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  if (sitemapId === 0) {
    // Static sitemap: top page, prefecture pages, area pages, shop pages
    // Top page
    entries.push(buildUrlEntry(BASE_URL, today, 'daily', 1.0));

    // Prefecture pages
    const prefSlugs = getPrefectureSlugs();
    for (const slug of prefSlugs) {
      entries.push(buildUrlEntry(`${BASE_URL}/${slug}`, today, 'daily', 0.9));
    }

    // Area pages
    const areas = getAllAreas();
    for (const area of areas) {
      entries.push(buildUrlEntry(`${BASE_URL}/area/${area.slug}`, today, 'daily', 0.8));
    }

    // Shop pages
    const shops = getAllShopIds();
    for (const shop of shops) {
      entries.push(buildUrlEntry(`${BASE_URL}/shop/${shop.id}`, today, 'weekly', 0.7));
    }
  } else {
    // Girl sitemaps (1-indexed: sitemapId 1 = offset 0, sitemapId 2 = offset 50000, etc.)
    const offset = (sitemapId - 1) * GIRLS_PER_SITEMAP;
    const girls = getGirlIdsPaginated(offset, GIRLS_PER_SITEMAP);
    if (girls.length === 0) {
      return new NextResponse('Not Found', { status: 404 });
    }
    for (const girl of girls) {
      entries.push(buildUrlEntry(`${BASE_URL}/girl/${girl.id}`, today, 'weekly', 0.6));
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
