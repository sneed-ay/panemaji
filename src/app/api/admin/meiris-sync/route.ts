/**
 * GET /api/admin/meiris-sync — メール配信システムへの連絡先同期 (管理者専用)
 *
 * 会員登録時の送信 (api/auth/register) が通信失敗で取りこぼした会員を拾い直す。
 * 既存会員のまとめ送り (初回バックフィル) にも使う。
 * 重複送信は updated が返るだけで安全 (仕様書 4章)。
 *
 * 認証: 管理者セッション、または ?token= が ADMIN_STATS_TOKEN と一致すること。
 *
 * 🚨 対象は ad_opt_in = 1 の会員のみ。未同意の会員は絶対に送らない。
 *
 * クエリ:
 *   ?dry=1     件数を数えるだけで送信しない
 *   ?ping=1    疎通確認のみ (副作用なし / 仕様書 5章)
 *   ?limit=N   1回で処理する上限 (既定 2000)
 *   ?resend=1  同期済の会員も対象に含める (通常不要)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ping, isMeirisConfigured, MEIRIS_MAX_BATCH } from '@/lib/meiris';
import { countPending, selectTargets, flushPending } from '@/lib/meiris-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const token = req.nextUrl.searchParams.get('token');
  const expected = process.env.ADMIN_STATS_TOKEN;
  if (expected && token && token === expected) return true;
  const user = await getCurrentUser();
  return !!user?.is_admin;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  if (!isMeirisConfigured()) {
    return NextResponse.json(
      { error: 'MEIRIS_API_KEY 未設定', hint: 'Render のダッシュボードで環境変数を設定してください' },
      { status: 503, headers: NO_STORE }
    );
  }

  const sp = req.nextUrl.searchParams;

  if (sp.get('ping') === '1') {
    return NextResponse.json({ ping: await ping() }, { headers: NO_STORE });
  }

  const limit = Math.min(Math.max(Number(sp.get('limit')) || 2000, 1), 20000);
  const resend = sp.get('resend') === '1';
  const totals = countPending();

  if (sp.get('dry') === '1') {
    const targets = selectTargets(limit, resend);
    return NextResponse.json(
      { dry: true, totals, would_send: targets.length, batches: Math.ceil(targets.length / MEIRIS_MAX_BATCH) },
      { headers: NO_STORE }
    );
  }

  const report = await flushPending({ limit, resend });
  return NextResponse.json(
    { ok: report.batch_errors.length === 0, totals_before: totals, ...report, totals_after: countPending() },
    { headers: NO_STORE }
  );
}
