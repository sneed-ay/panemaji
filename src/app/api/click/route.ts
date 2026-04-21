import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * サーバー側クリック計測プロキシ
 *
 * 目的: GA の banner_click は広告ブロッカー・beacon 送信漏れ・onClick → target="_blank" 遷移
 * との競合で取りこぼすケースが多い。このエンドポイントを通すことで、サーバーログ上で
 * 確実にクリック数をカウントできる。
 *
 * 使い方:
 *   <a href="/api/click?to=<URLENCODED_DEST>&ad_type=fanza&ad_size=header&ad_page=/shop/123">
 *
 * セキュリティ: open redirect を防ぐため、遷移先ホストは allow-list 方式。
 */

// 許可する遷移先ホスト (suffix マッチ)
const ALLOWED_HOST_SUFFIXES = [
  'dmm.com',        // DMM アフィリンク (al.dmm.com, affiliate.dmm.com 等)
  'dmm.co.jp',
  'fanza.co.jp',    // FANZA (al.fanza.co.jp が /api/fanza から返る)
  'note.com',       // note 自社広告
  'ad-stir.com',    // adstir
  'adsterra.com',
];

function isAllowedDest(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith('.' + suffix));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get('to');
  const adType = (searchParams.get('ad_type') || '').slice(0, 30);
  const adSize = (searchParams.get('ad_size') || '').slice(0, 30) || null;
  const adPage = (searchParams.get('ad_page') || '').slice(0, 200) || null;
  const browserId = (searchParams.get('bid') || '').slice(0, 100) || null;

  // 必須パラメータ検証
  if (!to || !adType) {
    return NextResponse.json({ error: 'missing to / ad_type' }, { status: 400 });
  }
  if (!isAllowedDest(to)) {
    return NextResponse.json({ error: 'destination not allowed' }, { status: 400 });
  }

  // DB 記録 (失敗してもリダイレクトは続行)
  try {
    const destHost = new URL(to).hostname;
    const ua = request.headers.get('user-agent')?.slice(0, 300) || null;
    const referer = request.headers.get('referer')?.slice(0, 300) || null;

    db.prepare(
      `INSERT INTO ad_clicks (created_at, ad_type, ad_size, ad_page, dest_host, browser_id, user_agent, referer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(Date.now(), adType, adSize, adPage, destHost, browserId, ua, referer);
  } catch (e) {
    console.error('ad_clicks insert failed:', e);
  }

  // 302 redirect to destination
  return NextResponse.redirect(to, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
