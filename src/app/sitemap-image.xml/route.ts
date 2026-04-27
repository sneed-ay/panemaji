import { NextResponse } from 'next/server';

const BASE_URL = 'https://panemaji.com';

// 画像sitemap (Google画像検索SEO効果)
// /sitemap-image.xml で 画像URL付き shop ページを列挙
export const revalidate = 86400; // 1日

export async function GET() {
  const { default: db } = await import('@/lib/db');
  // 画像付き shops を 取得 (上限 50,000件 = sitemap仕様準拠)
  const rows = db.prepare(`
    SELECT s.id, s.name, s.last_seen_at,
      (SELECT g.image_url FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND g.image_url IS NOT NULL AND g.image_url != '' LIMIT 1) AS img_url
    FROM shops s
    WHERE s.is_active=1 AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND g.image_url IS NOT NULL AND g.image_url != '')
    LIMIT 50000
  `).all() as Array<{ id: number; name: string; last_seen_at: string | null; img_url: string }>;

  const today = new Date().toISOString().split('T')[0];
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const entries = rows.map((r) => {
    const lastmod = r.last_seen_at ? r.last_seen_at.substring(0, 10) : today;
    return `  <url>
    <loc>${BASE_URL}/shop/${r.id}/</loc>
    <lastmod>${lastmod}</lastmod>
    <image:image>
      <image:loc>${escapeXml(r.img_url)}</image:loc>
      <image:title>${escapeXml(r.name)}</image:title>
    </image:image>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">
${entries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
