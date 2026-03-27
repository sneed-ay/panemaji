import { NextRequest, NextResponse } from 'next/server';
import { getShopComments, addShopComment, getLastShopCommentTime } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get('shop_id');
  if (!shopId || isNaN(Number(shopId))) {
    return NextResponse.json({ error: 'shop_id is required' }, { status: 400 });
  }

  const comments = getShopComments(Number(shopId), 20);
  return NextResponse.json({ comments });
}

export function POST(request: NextRequest) {
  return request.json().then((body) => {
    const { shop_id, comment, browser_id } = body;

    if (!shop_id || !comment) {
      return NextResponse.json({ error: 'shop_id and comment are required' }, { status: 400 });
    }

    // Validate comment length
    const trimmed = String(comment).trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'コメントを入力してください' }, { status: 400 });
    }
    if (trimmed.length > 500) {
      return NextResponse.json({ error: 'コメントは500文字以内で入力してください' }, { status: 400 });
    }

    // Rate limit: 1 minute per browser_id per shop
    if (browser_id) {
      const lastTime = getLastShopCommentTime(Number(shop_id), String(browser_id));
      if (lastTime) {
        const lastDate = new Date(lastTime + 'Z');
        const now = new Date();
        const diffMs = now.getTime() - lastDate.getTime();
        if (diffMs < 60 * 1000) {
          const waitSec = Math.ceil((60 * 1000 - diffMs) / 1000);
          return NextResponse.json(
            { error: `連投制限中です。${waitSec}秒後に再度お試しください` },
            { status: 429 }
          );
        }
      }
    }

    try {
      const newComment = addShopComment(Number(shop_id), trimmed, browser_id || null);
      return NextResponse.json({ comment: newComment }, { status: 201 });
    } catch (err) {
      console.error('Failed to add shop comment:', err);
      return NextResponse.json({ error: '投稿に失敗しました' }, { status: 500 });
    }
  });
}
