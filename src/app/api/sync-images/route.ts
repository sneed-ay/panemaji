import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// Temporary endpoint to sync girl data from local DB to Render
// Protected by admin secret. Supports image_url and twitter_url sync.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== 'sync-images-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const field = body.field || 'image_url'; // 'image_url' or 'twitter_url'
  const updates: { source_id: string; image_url?: string; twitter_url?: string; value?: string }[] = body.updates;

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 });
  }

  let updated = 0;

  if (field === 'twitter_url') {
    const stmt = db.prepare(
      "UPDATE girls SET twitter_url = ? WHERE source_id = ? AND (twitter_url IS NULL OR twitter_url = '')"
    );
    const tx = db.transaction(() => {
      for (const u of updates) {
        const val = u.twitter_url || u.value || '';
        const result = stmt.run(val, u.source_id);
        updated += result.changes;
      }
    });
    tx();
  } else {
    const stmt = db.prepare(
      "UPDATE girls SET image_url = ? WHERE source_id = ? AND (image_url IS NULL OR image_url = '')"
    );
    const tx = db.transaction(() => {
      for (const u of updates) {
        const val = u.image_url || u.value || '';
        const result = stmt.run(val, u.source_id);
        updated += result.changes;
      }
    });
    tx();
  }

  return NextResponse.json({ updated, total: updates.length, field });
}
