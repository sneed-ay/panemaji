import { NextRequest, NextResponse } from 'next/server';
import { addReview, getLatestReviews } from '@/lib/queries';

export async function GET() {
  const reviews = getLatestReviews(20);
  return NextResponse.json(reviews);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { girl_id, panel_rating, comment, browser_id } = body;

    if (!girl_id || !panel_rating || !browser_id) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    if (!['panel_match', 'panel_diff', 'jirai'].includes(panel_rating)) {
      return NextResponse.json({ error: '不正な評価値です' }, { status: 400 });
    }

    addReview(girl_id, panel_rating, comment || null, browser_id);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
      return NextResponse.json({ error: 'ALREADY_REVIEWED' }, { status: 409 });
    }
    return NextResponse.json({ error: '投稿に失敗しました' }, { status: 500 });
  }
}
