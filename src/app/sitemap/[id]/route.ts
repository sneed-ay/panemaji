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

  // Guide article slugs for sitemap
  const guideSlugs = [
    'shinjuku-deriheru', 'ikebukuro-deriheru', 'shibuya-deriheru', 'gotanda-deriheru',
    'kinshicho-deriheru', 'ueno-deriheru', 'osaka-deriheru', 'nagoya-deriheru',
    'fukuoka-deriheru', 'sapporo-deriheru', 'yokohama-deriheru', 'kyoto-deriheru',
    'kobe-deriheru', 'sendai-deriheru', 'hiroshima-deriheru',
    'chiba-deriheru', 'saitama-deriheru', 'kawasaki-deriheru',
    'panemaji-checker', 'how-to-use', 'panemaji-taisaku', 'panel-photo-check',
    'first-deriheru', 'kuchikomi-katsuyou', 'real-do-ranking', 'deriheru-erabikata',
    'ns-nn-toha', 'shame-nikki-mikata',
    'panemaji-trend-2026', 'panel-kaishu-sagasu', 'kuchikomi-tokou',
    'av-joyuu-zaiseki', 'hajimete-menesu', 'panemaji-kaishuu-gihou',
    'kuchikomi-shinjitsu', 'nenmatsu-nenshi-fuzoku', 'yoshiwara-soap-guide', 'gotanda-menesu',
    'menesu-nagare', 'menesu-kiwadoi', 'menesu-erabikata',
    'shinjuku-menesu', 'ikebukuro-menesu', 'ginza-menesu',
    'menesu-ryoukin-souba', 'menesu-panemaji', 'osaka-menesu', 'nagoya-menesu',
    'fukuoka-menesu', 'yokohama-menesu',
    'deriheru-vs-soap', 'menesu-vs-esthe', 'fuzoku-ryoukin-souba',
    'panemaji-faq', 'menesu-faq', 'fuzoku-yougo',
    'niigata-deriheru', 'okayama-deriheru', 'kumamoto-deriheru', 'kagoshima-deriheru',
    'kanazawa-deriheru', 'matsuyama-deriheru', 'naha-deriheru', 'takasaki-deriheru',
    'hamamatsu-deriheru', 'kitakyushu-deriheru', 'utsunomiya-deriheru', 'mito-deriheru',
    'deriheru-hajimete-faq', 'soap-hajimete-guide', 'fuzoku-trouble-taisaku',
    'panel-photo-kako-rekishi', 'fuzoku-eisei-guide', 'fuzoku-manner-guide',
    'sapporo-menesu', 'sendai-menesu', 'hiroshima-menesu', 'kobe-menesu',
    'nagano-deriheru', 'gifu-deriheru', 'toyama-deriheru', 'shizuoka-deriheru',
    'tokushima-deriheru', 'oita-deriheru', 'nagasaki-deriheru', 'miyazaki-deriheru',
    'nara-deriheru', 'wakayama-deriheru',
    'akita-deriheru', 'yamagata-deriheru', 'fukushima-deriheru', 'mie-deriheru',
    'saga-deriheru', 'kochi-deriheru', 'aomori-deriheru', 'iwate-deriheru',
    'takamatsu-deriheru', 'fukui-deriheru',
    'deriheru-ryoukin-guide', 'soap-vs-health', 'fuzoku-season-guide',
    'fuzoku-hotel-guide', 'panel-photo-mitiwake', 'fuzoku-repeat-guide',
    'fuzoku-reservation-guide', 'fuzoku-beginner-checklist',
    'chiba-menesu', 'saitama-menesu', 'kyoto-menesu', 'kawasaki-menesu',
    'nagoya-menesu-area', 'menesu-oil-guide', 'fuzoku-age-guide',
    'deriheru-time-guide', 'fuzoku-discount-guide', 'fuzoku-free-guide',
    'fuzoku-option-guide', 'fuzoku-after-guide', 'deriheru-change-guide',
    'menesu-difference-guide', 'fuzoku-review-guide', 'fuzoku-photo-diary-guide',
    'deriheru-area-guide',
  ];

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
