import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { girl_id, comment, browser_id } = body;

    if (!girl_id || !comment || !browser_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'コメントが長すぎます' }, { status: 400 });
    }

    // Try to update existing review first
    const existing = db.prepare(
      'SELECT id FROM reviews WHERE girl_id = ? AND browser_id = ?'
    ).get(girl_id, browser_id) as { id: number } | undefined;

    if (existing) {
      db.prepare('UPDATE reviews SET comment = ? WHERE id = ?').run(comment, existing.id);
    } else {
      // Create new review with comment only (no rating - use panel_diff as neutral default)
      const now = new Date().toISOString().split('T')[0];
      db.prepare(
        'INSERT OR IGNORE INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id) VALUES (?, ?, ?, ?, ?)'
      ).run(girl_id, now, 'panel_diff', comment, browser_id);
    }

    revalidatePath(`/girl/${girl_id}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'コメントの追加に失敗しました' }, { status: 500 });
  }
}
