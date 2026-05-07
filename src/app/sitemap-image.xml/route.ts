import { NextResponse } from 'next/server';

const BASE_URL = 'https://panemaji.com';

// 画像sitemap (Google画像検索SEO効果)
// /sitemap-image.xml で 画像URL付き shop ページを列挙
// メモリ最適化: 50,000行を array.join で組み立てると ~80MB ピーク → ReadableStream で逐次送出に変更
// (Render Starter 512MB 対策)
export const revalidate = 86400; // 1日

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET() {
  const { iterateShopsWithImages } = await import('@/lib/queries');
  const today = new Date().toISOString().split('T')[0];
  const encoder = new TextEncoder();

  // ReadableStream + iterate(): 50k 行を array で持たず行単位で送出 → ピーク ~80MB → ~数MB
  // cancel ハンドラで iterator を確実に閉じる (client 切断時の DB busy 回避)
  const iter = iterateShopsWithImages(50000);
  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">\n`,
        ));
        const CHUNK = 1000;
        let buf = '';
        let i = 0;
        for (const r of iter) {
          const lastmod = r.last_seen_at ? r.last_seen_at.substring(0, 10) : today;
          buf += `  <url>\n    <loc>${BASE_URL}/shop/${r.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <image:image>\n      <image:loc>${escapeXml(r.img_url)}</image:loc>\n      <image:title>${escapeXml(r.name)}</image:title>\n    </image:image>\n  </url>\n`;
          i++;
          if (i % CHUNK === 0) {
            controller.enqueue(encoder.encode(buf));
            buf = '';
          }
        }
        if (buf) controller.enqueue(encoder.encode(buf));
        controller.enqueue(encoder.encode(`</urlset>\n`));
        controller.close();
      } catch (e) {
        try { iter.return?.(undefined); } catch {}
        controller.error(e);
      }
    },
    cancel() {
      try { iter.return?.(undefined); } catch {}
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
