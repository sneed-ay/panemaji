import { NextResponse } from 'next/server';

const BASE_URL = 'https://panemaji.com';

// エリア×業態ガイド専用 sitemap (既存sitemap汚染防止)
export const revalidate = 86400;

const CATEGORY_KEYS = ['deriheru', 'soap', 'health', 'hoteheru', 'esthe', 'menesu'];
const CATEGORY_LABELS: Record<string, string> = {
  deriheru: 'デリヘル',
  soap: 'ソープ',
  health: 'ヘルス',
  hoteheru: 'ホテヘル',
  esthe: 'エステ・アロマ',
  menesu: 'メンズエステ',
};

export async function GET() {
  const { default: db } = await import('@/lib/db');
  // 嬢付き shop 5件以上 ある area×category のみ
  const counts = db.prepare(`
    SELECT a.slug AS area_slug, s.category, COUNT(*) AS cnt
    FROM shops s
    JOIN areas a ON s.area_id=a.id
    WHERE s.is_active=1 AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
    GROUP BY a.slug, s.category
    HAVING cnt >= 5
  `).all() as Array<{ area_slug: string; category: string; cnt: number }>;

  const today = new Date().toISOString().split('T')[0];
  const entries: string[] = [];

  // index
  entries.push(`  <url>
    <loc>${BASE_URL}/guide/area</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);

  for (const c of counts) {
    const catKey = CATEGORY_KEYS.find((k) => CATEGORY_LABELS[k] === c.category);
    if (!catKey) continue;
    entries.push(`  <url>
    <loc>${BASE_URL}/guide/area/${c.area_slug}-${catKey}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
