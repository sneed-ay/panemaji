import { NextResponse } from 'next/server';

const BASE_URL = 'https://panemaji.com';

// 画像sitemap (Google画像検索SEO効果)
// /sitemap-image.xml で 画像URL付き shop ページを列挙
//
// メモリ最適化 v2:
//   - v1: array.join で 50k 行を一括組立 → ~80MB ピーク
//   - v2: ReadableStream の start() 内で全 chunk を 同期 enqueue → 内部キュー滞留で
//         並行リクエスト時に ArrayBuffer leak (~321MB 蓄積を観測)
//   - v3: pull() で 1 batch ずつ enqueue → consumer (HTTP socket) drain 同期で 滞留ゼロ
//
// (Render Starter 512MB 対策)
export const revalidate = 86400; // 1日

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">\n`;
const FOOTER = `</urlset>\n`;
const BATCH_ROWS = 200; // 1 pull() あたり 200 行送出 → ~30KB chunk (HTTP MTU 数倍)

export async function GET() {
  const { iterateShopsWithImages } = await import('@/lib/queries');
  const today = new Date().toISOString().split('T')[0];
  const encoder = new TextEncoder();

  const iter = iterateShopsWithImages(50000);
  let headerSent = false;
  let footerSent = false;

  const stream = new ReadableStream({
    pull(controller) {
      try {
        if (!headerSent) {
          controller.enqueue(encoder.encode(HEADER));
          headerSent = true;
          return; // 次の pull で行データ送出
        }
        if (footerSent) {
          controller.close();
          return;
        }

        let buf = '';
        let count = 0;
        while (count < BATCH_ROWS) {
          const next = iter.next();
          if (next.done) {
            // 残りバッファ + footer
            if (buf) controller.enqueue(encoder.encode(buf));
            controller.enqueue(encoder.encode(FOOTER));
            footerSent = true;
            controller.close();
            return;
          }
          const r = next.value;
          const lastmod = r.last_seen_at ? r.last_seen_at.substring(0, 10) : today;
          buf += `  <url>\n    <loc>${BASE_URL}/shop/${r.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <image:image>\n      <image:loc>${escapeXml(r.img_url)}</image:loc>\n      <image:title>${escapeXml(r.name)}</image:title>\n    </image:image>\n  </url>\n`;
          count++;
        }
        controller.enqueue(encoder.encode(buf));
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
