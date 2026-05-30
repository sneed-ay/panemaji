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

// シンプル & 包括的な bot 判定
function isBotComment(comment: string): boolean {
  // includes() で直接マッチ (regex の罠を避ける)
  if (comment.includes('パネマジ')) return true;
  if (comment.includes('掲示板')) return true;

  // 文字伏せ系の partial: パネマ + 何か + 板/示
  const hasPanemaji = comment.includes('パネマ') || comment.includes('ネマジ') || comment.includes('パネマジ');
  const hasBbs = comment.includes('掲') && comment.includes('板');
  if (hasPanemaji && hasBbs) return true;

  // パ◯マジ / パネ◯ジ / パネマ◯ のような中1文字置換も
  if (/パ.マジ|パネ.ジ|パネマ.|.ネマジ/u.test(comment) && (comment.includes('板') || comment.includes('示'))) return true;

  // 60文字以下で「掲」「板」両方ある場合は bot 寄り (ただし誤検出リスクあり)
  if (comment.length <= 60 && comment.includes('掲') && comment.includes('板')) return true;

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
