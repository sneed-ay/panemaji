import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://panemaji.com';
const GIRLS_PER_SITEMAP = 50000;

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildUrlEntry(loc: string, lastmod: string, changefreq: string, priority: number): string {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>\n`;
}

// メモリ最適化: 50,000行 array.join を ReadableStream の chunk 送出に変更
// (Render Starter 512MB 対策・大型 sitemap で OOM しないよう)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  // Lazy import to avoid build-time DB connection
  const { getAllAreas, iterateAllShopIds, iterateGirlIdsPaginated, getPrefectureSlugs, getAreaLastModMap, getPrefectureLastModMap } = await import('@/lib/queries');
  const { getAllGuideSlugs } = await import('@/lib/guides');

  const sitemapId = parseInt(params.id);
  if (isNaN(sitemapId)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const encoder = new TextEncoder();

  // Normalize a timestamp string to YYYY-MM-DD; fallback to today
  const toLastMod = (ts: string | null | undefined): string => {
    if (!ts) return today;
    const d = ts.substring(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  };

  // sitemap 0 (静的) は事前に上限件数決まってる (47 + 325 + 19k shops + ~10 guide = 20k 弱)
  // sitemap N (動的) は最大 50,000 girls/shard
  // どちらも ReadableStream で chunk 送出してピークメモリを抑制

  if (sitemapId === 0) {
    // 静的 sitemap: top + guide + prefecture + area + shop
    const guideSlugs = getAllGuideSlugs().filter((s) => s !== 'shop' && s !== 'area');
    const prefSlugs = getPrefectureSlugs();
    const prefLastMod = getPrefectureLastModMap();
    const areas = getAllAreas();
    const areaLastMod = getAreaLastModMap();
    const shopIter = iterateAllShopIds();

    const stream = new ReadableStream({
      start(controller) {
        try {
          controller.enqueue(encoder.encode(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`,
          ));
          const CHUNK = 1000;
          let buf = '';
          const flush = () => {
            if (buf) {
              controller.enqueue(encoder.encode(buf));
              buf = '';
            }
          };

          // Top
          buf += buildUrlEntry(BASE_URL, today, 'daily', 1.0);
          // Guide index + articles
          buf += buildUrlEntry(`${BASE_URL}/guide`, today, 'weekly', 0.8);
          for (const slug of guideSlugs) {
            buf += buildUrlEntry(`${BASE_URL}/guide/${slug}`, today, 'weekly', 0.7);
          }
          // Prefectures
          for (const slug of prefSlugs) {
            buf += buildUrlEntry(`${BASE_URL}/${slug}`, toLastMod(prefLastMod.get(slug)), 'daily', 0.9);
          }
          // Areas
          for (const area of areas) {
            buf += buildUrlEntry(`${BASE_URL}/area/${area.slug}`, toLastMod(areaLastMod.get(area.id)), 'daily', 0.8);
          }
          // Shops (iterate で 1 行ずつ → 19k array allocation 回避)
          let i = 0;
          for (const shop of shopIter) {
            buf += buildUrlEntry(`${BASE_URL}/shop/${shop.id}`, toLastMod(shop.last_seen_at), 'weekly', 0.7);
            i++;
            if (i % CHUNK === 0) flush();
          }
          flush();
          controller.enqueue(encoder.encode(`</urlset>\n`));
          controller.close();
        } catch (e) {
          try { shopIter.return?.(undefined); } catch {}
          controller.error(e);
        }
      },
      cancel() {
        try { shopIter.return?.(undefined); } catch {}
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  }

  // Girl sitemaps (1-indexed)
  // 空 shard 検出のため最初の 1 行を peek してから iterate ストリーミングに切替
  const offset = (sitemapId - 1) * GIRLS_PER_SITEMAP;
  const iter = iterateGirlIdsPaginated(offset, GIRLS_PER_SITEMAP);
  const first = iter.next();
  if (first.done) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`,
        ));
        const CHUNK = 1000;
        let buf = '';
        let i = 0;
        // 最初の peek 行を先に出す
        const firstGirl = first.value;
        buf += buildUrlEntry(`${BASE_URL}/girl/${firstGirl.id}`, toLastMod(firstGirl.last_seen_at), 'weekly', 0.6);
        i++;
        // 残りを iterator から逐次出す
        for (const girl of iter) {
          buf += buildUrlEntry(`${BASE_URL}/girl/${girl.id}`, toLastMod(girl.last_seen_at), 'weekly', 0.6);
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
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
