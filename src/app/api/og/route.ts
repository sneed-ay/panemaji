/**
 * 旧・共有用画像 (OGP) の生成 API。今は固定画像 /ogp-banner.png へ転送するだけ。
 *
 * 以前は next/og の ImageResponse で嬢・店ごとに画像を描いていたが、日本語を描くたびに
 * @vercel/og が Google Fonts からその名前の文字だけのフォントを取り、モジュール内の Map
 * (assetCache) に溜めて一度も捨てない。嬢・店は名前が全部違うので呼ばれるほどメモリが増え、
 * さらに初回に edge ランタイム + WASM で約42MB を確保する。本番の RSS が1時間に約16MB ずつ増えて
 * 1日2〜3回メモリ監視で再起動していた原因 (2026-09-25 に手元の Linux で再現して確認)。
 *
 * SNS やクローラーが既に覚えている /api/og?... の URL が来ても、画像を描かずに固定画像へ送る。
 */
import { NextResponse } from 'next/server';

// request.url はプロキシ越しだと http://localhost:… になるので、公開 URL を直接書く
export function GET() {
  return NextResponse.redirect('https://panemaji.com/ogp-banner.png', {
    status: 308,
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
