import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://panemaji.com';
const GIRLS_PER_SITEMAP = 50000;
const BATCH_ROWS = 200; // 1 pull() あたり 200 行送出

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildUrlEntry(loc: string, lastmod: string, changefreq: string, priority: number): string {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>\n`;
}

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
const FOOTER = `</urlset>\n`;

// メモリ最適化 v3: pull() pattern で 1 batch ずつ enqueue → ArrayBuffer 滞留ゼロ
// (Render Starter 512MB 対策・ v2 の start() 内同期 enqueue は並行リクエストで leak)
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

  if (sitemapId === 0) {
    // 静的 sitemap: top + guide + prefecture + area + shop
    // 静的部分 (top + guides + prefectures + areas) は事前に1度送出、 shop は iterator で pull
    const guideSlugs = getAllGuideSlugs().filter((s) => s !== 'shop' && s !== 'area');
    const prefSlugs = getPrefectureSlugs();
    const prefLastMod = getPrefectureLastModMap();
    const areas = getAllAreas();
    const areaLastMod = getAreaLastModMap();
    const shopIter = iterateAllShopIds();

    let phase: 'header' | 'static' | 'shops' | 'footer' | 'done' = 'header';

    const stream = new ReadableStream({
      pull(controller) {
        try {
          if (phase === 'header') {
            controller.enqueue(encoder.encode(HEADER));
            phase = 'static';
            return;
          }
          if (phase === 'static') {
            // 1 回で静的部分全部送出 (~600 行で ~100KB、 問題なし)
            let buf = '';
            buf += buildUrlEntry(BASE_URL, today, 'daily', 1.0);
            buf += buildUrlEntry(`${BASE_URL}/guide`, today, 'weekly', 0.8);
            for (const slug of guideSlugs) {
              buf += buildUrlEntry(`${BASE_URL}/guide/${slug}`, today, 'weekly', 0.7);
            }
            for (const slug of prefSlugs) {
              buf += buildUrlEntry(`${BASE_URL}/${slug}`, toLastMod(prefLastMod.get(slug)), 'daily', 0.9);
            }
            for (const area of areas) {
              buf += buildUrlEntry(`${BASE_URL}/area/${area.slug}`, toLastMod(areaLastMod.get(area.id)), 'daily', 0.8);
            }
            controller.enqueue(encoder.encode(buf));
            phase = 'shops';
            return;
          }
          if (phase === 'shops') {
            let buf = '';
            let count = 0;
            while (count < BATCH_ROWS) {
              const next = shopIter.next();
              if (next.done) {
                if (buf) controller.enqueue(encoder.encode(buf));
                phase = 'footer';
                return;
              }
              buf += buildUrlEntry(`${BASE_URL}/shop/${next.value.id}`, toLastMod(next.value.last_seen_at), 'weekly', 0.7);
              count++;
            }
            controller.enqueue(encoder.encode(buf));
            return;
          }
          if (phase === 'footer') {
            controller.enqueue(encoder.encode(FOOTER));
            phase = 'done';
            controller.close();
            return;
          }
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
    try { iter.return?.(undefined); } catch {}
    return new NextResponse('Not Found', { status: 404 });
  }

  let phase: 'header' | 'first' | 'rest' | 'footer' | 'done' = 'header';

  const stream = new ReadableStream({
    pull(controller) {
      try {
        if (phase === 'header') {
          controller.enqueue(encoder.encode(HEADER));
          phase = 'first';
          return;
        }
        if (phase === 'first') {
          const firstGirl = first.value;
          controller.enqueue(encoder.encode(buildUrlEntry(`${BASE_URL}/girl/${firstGirl.id}`, toLastMod(firstGirl.last_seen_at), 'weekly', 0.6)));
          phase = 'rest';
          return;
        }
        if (phase === 'rest') {
          let buf = '';
          let count = 0;
          while (count < BATCH_ROWS) {
            const next = iter.next();
            if (next.done) {
              if (buf) controller.enqueue(encoder.encode(buf));
              phase = 'footer';
              return;
            }
            buf += buildUrlEntry(`${BASE_URL}/girl/${next.value.id}`, toLastMod(next.value.last_seen_at), 'weekly', 0.6);
            count++;
          }
          controller.enqueue(encoder.encode(buf));
          return;
        }
        if (phase === 'footer') {
          controller.enqueue(encoder.encode(FOOTER));
          phase = 'done';
          controller.close();
          return;
        }
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
