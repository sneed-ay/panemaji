import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { updateReviewComment } from '@/lib/queries';

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

    updateReviewComment(girl_id, browser_id, comment);

    revalidatePath(`/girl/${girl_id}`);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'コメントの追加に失敗しました' }, { status: 500 });
  }
}
