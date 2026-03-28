import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const total = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as {c:number}).c;
  const ext = (db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-%'").get() as {c:number}).c;
  const ximport = (db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'x-import-%'").get() as {c:number}).c;
  const user = total - ext - ximport;
  const daily = db.prepare("SELECT substr(created_at,1,10) as date, COUNT(*) as cnt FROM reviews WHERE browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%' GROUP BY date ORDER BY date DESC LIMIT 30").all();
  return NextResponse.json({ total, ext, ximport, user, daily });
}
