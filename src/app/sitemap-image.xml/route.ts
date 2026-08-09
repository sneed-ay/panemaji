import { NextResponse } from 'next/server';

// 画像sitemap
// 2026-08: 嬢のパネル写真(外部ホットリンク)をサイトから全面撤去したため、
//   画像sitemap は空 (urlset のみ) を返す。外部画像URLを Google に告知しない。
//   ※復活させる場合は git 履歴の v3 (ReadableStream ストリーミング版) を参照。
export const revalidate = 86400; // 1日

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">\n</urlset>\n`;

export async function GET() {
  return new NextResponse(EMPTY, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
