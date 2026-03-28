import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const total = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as {c:number}).c;
  const ext = (db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'ext-%'").get() as {c:number}).c;
  const ximport = (db.prepare("SELECT COUNT(*) as c FROM reviews WHERE browser_id LIKE 'x-import-%'").get() as {c:number}).c;
  const user = total - ext - ximport;
  
  // 全browser_idパターン別の件数
  const patterns = db.prepare(`
    SELECT 
      CASE 
        WHEN browser_id LIKE 'ext-trend-%' THEN 'ext-trend'
        WHEN browser_id LIKE 'ext-ch-%' THEN 'ext-ch'
        WHEN browser_id LIKE 'ext-trend-menesu-%' THEN 'ext-menesu'
        WHEN browser_id LIKE 'ext-trend-kamiesthe-%' THEN 'ext-kamiesthe'
        WHEN browser_id LIKE 'x-import-%' THEN 'x-import'
        WHEN browser_id LIKE 'test-%' OR browser_id LIKE 'clean-%' OR browser_id LIKE 'final-%' OR browser_id LIKE 'url-param-%' OR browser_id LIKE 'urlparam-%' THEN 'test'
        ELSE 'user'
      END as type,
      COUNT(*) as cnt
    FROM reviews GROUP BY type ORDER BY cnt DESC
  `).all();
  
  // ユーザー投稿の日別（user typeのみ）
  const daily = db.prepare(`
    SELECT substr(created_at,1,10) as date, COUNT(*) as cnt 
    FROM reviews 
    WHERE browser_id NOT LIKE 'ext-%' 
      AND browser_id NOT LIKE 'x-import-%'
      AND browser_id NOT LIKE 'test-%'
      AND browser_id NOT LIKE 'clean-%'
      AND browser_id NOT LIKE 'final-%'
      AND browser_id NOT LIKE 'url-param-%'
      AND browser_id NOT LIKE 'urlparam-%'
    GROUP BY date ORDER BY date DESC LIMIT 30
  `).all();

  // 最新のユーザー口コミ10件
  const latest = db.prepare(`
    SELECT r.created_at, r.browser_id, r.panel_rating, g.name as girl_name, s.name as shop_name
    FROM reviews r JOIN girls g ON r.girl_id=g.id JOIN shops s ON g.shop_id=s.id
    WHERE r.browser_id NOT LIKE 'ext-%' 
      AND r.browser_id NOT LIKE 'x-import-%'
      AND r.browser_id NOT LIKE 'test-%'
      AND r.browser_id NOT LIKE 'clean-%'
      AND r.browser_id NOT LIKE 'final-%'
    ORDER BY r.created_at DESC LIMIT 10
  `).all();
  
  return NextResponse.json({ total, ext, ximport, user, patterns, daily, latest });
}
