/**
 * 会員データの引き継ぎ (2026-09-25・一回限りの復旧用)
 *
 * 9/20 に本番DBが db-latest で上書きされ会員 3,770人が消えた。Render のスナップショットに戻す前に
 * 今の会員データを取り出し (GET)、戻した後に書き戻す (POST)。中身は AES-256-GCM で暗号化したまま
 * 受け渡すので、取り出した側 (作業者の手元) では読めない。処理本体は scripts/lib/carryover.mjs。
 *
 * 認証: ヘッダー x-carryover-token = 環境変数 CARRYOVER_TOKEN。暗号鍵は CARRYOVER_KEY。
 *       どちらかが未設定なら 404 (public リポジトリなので fail-closed)。復旧が終わったら env を消す。
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { buildPackage, encrypt, decrypt, mergePackage, summarize } from '../../../../../scripts/lib/carryover.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function authorized(req: NextRequest): boolean {
  const token = process.env.CARRYOVER_TOKEN;
  const key = process.env.CARRYOVER_KEY;
  return !!token && !!key && token.length >= 32 && req.headers.get('x-carryover-token') === token;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Not Found', { status: 404 });
  const since = req.nextUrl.searchParams.get('since') || '2026-09-20 08:36:00';
  const pkg = buildPackage(db, since);
  return NextResponse.json(
    { summary: summarize(pkg), blob: encrypt(pkg, process.env.CARRYOVER_KEY) },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Not Found', { status: 404 });
  let pkg;
  try {
    const body = await req.json();
    pkg = decrypt(body.blob ?? body, process.env.CARRYOVER_KEY);
  } catch (e) {
    return NextResponse.json({ error: 'decrypt failed', message: (e as Error).message }, { status: 400 });
  }
  const before = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const report = mergePackage(db, pkg);
  const after = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  return NextResponse.json({ summary: summarize(pkg), report, users_before: before, users_after: after }, { headers: { 'Cache-Control': 'no-store' } });
}
