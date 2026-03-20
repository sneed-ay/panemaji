import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// Temporary endpoint to sync image URLs from local DB to Render
// Protected by admin secret
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== 'sync-images-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updates: { source_id: string; image_url: string }[] = body.updates;

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 });
  }

  const stmt = db.prepare(
    "UPDATE girls SET image_url = ? WHERE source_id = ? AND (image_url IS NULL OR image_url = '')"
  );

  let updated = 0;
  const tx = db.transaction(() => {
    for (const u of updates) {
      const result = stmt.run(u.image_url, u.source_id);
      updated += result.changes;
    }
  });
  tx();

  return NextResponse.json({ updated, total: updates.length });
}
