import { NextResponse } from 'next/server';
import { getReviewsByGirl } from '@/lib/queries';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const girlId = parseInt(params.id);
  if (isNaN(girlId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  const reviews = getReviewsByGirl(girlId);
  return NextResponse.json(reviews);
}
