/**
 * Content-based Bot review purge (闘値無視, 内容で判定)
 *
 * 判定: 匿名 (user_id IS NULL) review の comment に
 *       「パネマジ掲示板」を文字伏せした形 (パ◯マジ, 掲示_板 等) が含まれる
 *       → bot 認定して削除
 *
 * 使い方:
 *   GET /api/admin/purge-bot-by-content?token=XXX&action=count|delete
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_TOKEN = 'purge-bot-content-9c7f4a3b8e2d1f5a-20260530';

// SQL の cast a wide net: comment が「掲示」「示板」「パネマ」「ネマジ」のいずれかを含む匿名 review
// (会員投稿は user_id IS NOT NULL なので除外、外部取込も除外)
const CANDIDATE_SQL = `
  SELECT r.id, r.browser_id, r.created_at, r.comment, r.girl_id
  FROM reviews r
  WHERE r.user_id IS NULL
    AND r.browser_id NOT LIKE 'ext-%'
    AND r.browser_id NOT LIKE 'x-import-%'
    AND r.browser_id NOT LIKE 'test-%'
    AND r.browser_id NOT LIKE 'clean-%'
    AND r.browser_id NOT LIKE 'final-%'
    AND r.browser_id NOT LIKE 'url-param-%'
    AND r.browser_id NOT LIKE 'urlparam-%'
    AND r.comment IS NOT NULL
    AND (
      r.comment LIKE '%パネマジ%' OR
      r.comment LIKE '%パネマ%' OR
      r.comment LIKE '%ネマジ%' OR
      r.comment LIKE '%パネ%ジ%' OR
      r.comment LIKE '%パ%マジ%' OR
      r.comment LIKE '%掲示板%' OR
      r.comment LIKE '%示板%' OR
      r.comment LIKE '%掲示%' OR
      r.comment LIKE '%掲%板%'
    )
`;

// JS で更に厳密に判定: panemaji 言及 + 掲示板 言及 の両方を持つ
function isBotComment(comment: string): boolean {
  // 「パネマジ」相当: パネマジ / パネマ + 任意1 / パネ + 任意1 + ジ / パ + 任意1 + マジ / 任意1 + ネマジ
  const panemajiRegex = /パネマジ|パネマ[^\s]|パネ[^\s]ジ|パ[^\s]マジ|[^\s]ネマジ|パネマ[　-ヿ　]|パネ[　-ヿ]ジ/u;
  // 「掲示板」相当
  const bbsRegex = /掲示板|掲示[^\s]板|掲[^\s]示板|[^\s]示板|掲示[　-ヿ]板|掲示[^\s]/u;
  // 両方マッチ = bot 確実
  if (panemajiRegex.test(comment) && bbsRegex.test(comment)) return true;
  // 「パネマジ」+「示板」or「掲示」も bot
  if (panemajiRegex.test(comment) && /示板|掲示|示_板/.test(comment)) return true;
  // 単独「示板」「掲_板」「掲示_」等の特殊文字混入も bot
  if (/掲[^\s]板|[^\s]示板|掲示[^\s]/.test(comment)) {
    // ASCII 記号 or 特殊な記号がmidに入ってる = obfuscation
    if (/掲[●○◎◐⬤◇◆◯★☆▽△♡♥×＿_□■△▲！＊\*\+\-]板|[●○◎◐⬤◇◆◯★☆▽△♡♥×＿_□■△▲！＊\*\+\-]示板|掲示[●○◎◐⬤◇◆◯★☆▽△♡♥×＿_□■△▲！＊\*\+\-]/.test(comment)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('token') !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const action = sp.get('action') || 'count';

  const candidates = db.prepare(CANDIDATE_SQL).all() as Array<{
    id: number; browser_id: string; created_at: string; comment: string; girl_id: number;
  }>;

  const botIds: number[] = [];
  const sample: typeof candidates = [];
  for (const r of candidates) {
    if (isBotComment(r.comment)) {
      botIds.push(r.id);
      if (sample.length < 10) sample.push(r);
    }
  }

  const summary = {
    candidate_count: candidates.length,
    bot_count: botIds.length,
    sample: sample.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      bid: s.browser_id.slice(0, 8),
      comment: s.comment.slice(0, 60),
    })),
  };

  if (action === 'count') {
    return NextResponse.json({ mode: 'dry-run', ...summary });
  }

  if (action === 'delete') {
    if (botIds.length === 0) {
      return NextResponse.json({ mode: 'deleted', deleted_rows: 0, ...summary });
    }
    // 大量削除を batch で
    const chunkSize = 500;
    let totalDeleted = 0;
    for (let i = 0; i < botIds.length; i += chunkSize) {
      const chunk = botIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const r = db.prepare(`DELETE FROM reviews WHERE id IN (${placeholders})`).run(...chunk);
      totalDeleted += r.changes;
    }
    return NextResponse.json({ mode: 'deleted', deleted_rows: totalDeleted, ...summary });
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}
