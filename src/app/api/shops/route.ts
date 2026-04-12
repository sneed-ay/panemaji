import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.category, a.name as area_name, a.prefecture
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.is_active = 1
  `).all();
  return NextResponse.json(rows);
}
