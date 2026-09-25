/**
 * 会員データの引き継ぎ (2026-09-25・一回限りの復旧用)
 *
 * 9/20 に本番DBが db-latest で上書きされ会員 3,770人が消えた。Render のスナップショットに戻す前に
 * 今の会員データを取り出し (GET)、戻した後に書き戻す (POST)。中身は AES-256-GCM で暗号化したまま
 * 受け渡すので、取り出した側 (作業者の手元) では読めない。処理本体は scripts/lib/carryover.mjs。
 *
 * 認証: ヘッダー x-carryover-token の SHA-256 が下の TOKEN_SHA256 と一致すること (public リポジトリなので
 *       ハッシュだけを置く。元の値は作業者の手元にしか無い)。
 * 暗号鍵: 本番にだけある環境変数 MEIRIS_API_KEY からサーバー内で導出する (スナップショットに戻しても
 *       環境変数は残るので、戻す前後で同じ鍵になる)。未設定なら 404。
 * 期限: EXPIRES_AT を過ぎたら常に 404 (復旧が終わったらこのファイルごと消す)。
 */
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { buildPackage, encrypt, decrypt, mergePackage, summarize } from '../../../../../scripts/lib/carryover.mjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TOKEN_SHA256 = '2505d279f1f7c6baf1b23c74cb82769ed74f9f3b36a9359fe17974310cf23c5c';
const EXPIRES_AT = Date.parse('2026-09-28T00:00:00+09:00');

function secret(): string | null {
  const base = process.env.MEIRIS_API_KEY;
  return base ? `panemaji-carryover-v1:${base}` : null;
}

function authorized(req: NextRequest): boolean {
  if (Date.now() > EXPIRES_AT || !secret()) return false;
  const token = req.headers.get('x-carryover-token') || '';
  const h = crypto.createHash('sha256').update(token).digest('hex');
  return token.length >= 32 && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(TOKEN_SHA256));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Not Found', { status: 404 });
  const since = req.nextUrl.searchParams.get('since') || '2026-09-20 08:36:00';
  const pkg = buildPackage(db, since);
  return NextResponse.json(
    { summary: summarize(pkg), blob: encrypt(pkg, secret()) },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Not Found', { status: 404 });
  let pkg;
  try {
    const body = await req.json();
    pkg = decrypt(body.blob ?? body, secret());
  } catch (e) {
    return NextResponse.json({ error: 'decrypt failed', message: (e as Error).message }, { status: 400 });
  }
  const before = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const report = mergePackage(db, pkg);
  const after = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  return NextResponse.json({ summary: summarize(pkg), report, users_before: before, users_after: after }, { headers: { 'Cache-Control': 'no-store' } });
}
