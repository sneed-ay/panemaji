import db, { Area, Shop, Girl, Review } from './db';
import { seedIfEmpty } from './seed';

seedIfEmpty();

// Areas
export function getAllAreas(): Area[] {
  return db.prepare('SELECT * FROM areas ORDER BY id').all() as Area[];
}

export function getAreaBySlug(slug: string): Area | undefined {
  return db.prepare('SELECT * FROM areas WHERE slug = ?').get(slug) as Area | undefined;
}

// Common shop subqueries (only count active girls)
const SHOP_STATS = `
  (SELECT COUNT(*) FROM girls WHERE shop_id = s.id AND is_active = 1) as girl_count,
  (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = s.id) as review_count,
  (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = s.id AND r.panel_rating = 'panel_match') as panel_match_count,
  CASE
    WHEN (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = s.id) = 0 THEN -1
    ELSE ROUND(
      100.0 * (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = s.id AND r.panel_rating = 'panel_match')
      / (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id WHERE g.shop_id = s.id)
    )
  END as panemaji_pct
`;

// Shops (only active shops)
export function getShopsByArea(areaId: number): Shop[] {
  return db.prepare(`
    SELECT s.*, a.name as area_name, ${SHOP_STATS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.area_id = ? AND s.is_active = 1
    ORDER BY panemaji_pct DESC, review_count DESC, s.name
  `).all(areaId) as Shop[];
}

export function getShopById(id: number): Shop | undefined {
  return db.prepare(`
    SELECT s.*, a.name as area_name, ${SHOP_STATS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.id = ?
  `).get(id) as Shop | undefined;
}

export function searchShops(query: string): Shop[] {
  const q = `%${query}%`;
  return db.prepare(`
    SELECT s.*, a.name as area_name, ${SHOP_STATS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.name LIKE ? AND s.is_active = 1
    ORDER BY panemaji_pct DESC, review_count DESC, s.name
    LIMIT 50
  `).all(q) as Shop[];
}

// Common girl subqueries
const GIRL_STATS = `
  (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id) as review_count,
  (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id AND panel_rating = 'panel_match') as panel_match_count,
  (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id AND panel_rating = 'panel_diff') as panel_diff_count,
  (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id AND panel_rating = 'jirai') as jirai_count,
  CASE
    WHEN (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id) = 0 THEN -1
    ELSE ROUND(
      100.0 * (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id AND panel_rating = 'panel_match')
      / (SELECT COUNT(*) FROM reviews WHERE girl_id = g.id)
    )
  END as panemaji_pct
`;

// Girls (only active by default)
export function getGirlsByShop(shopId: number, search?: string): Girl[] {
  const where = search
    ? 'WHERE g.shop_id = ? AND g.is_active = 1 AND g.name LIKE ?'
    : 'WHERE g.shop_id = ? AND g.is_active = 1';
  const params = search ? [shopId, `%${search}%`] : [shopId];
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    ${where}
    ORDER BY panemaji_pct DESC, review_count DESC, g.name
  `).all(...params) as Girl[];
}

export function getGirlById(id: number): Girl | undefined {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    WHERE g.id = ?
  `).get(id) as Girl | undefined;
}

export function getGirlWithReviewStats(id: number): Girl | undefined {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, ${GIRL_STATS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    WHERE g.id = ?
  `).get(id) as Girl | undefined;
}

// Reviews
export function getReviewsByGirl(girlId: number): Review[] {
  return db.prepare(`
    SELECT r.*, g.name as girl_name, s.name as shop_name
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    WHERE r.girl_id = ?
    ORDER BY r.created_at DESC
  `).all(girlId) as Review[];
}

export function getLatestReviews(limit: number = 20): Review[] {
  return db.prepare(`
    SELECT r.*, g.name as girl_name, s.name as shop_name
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit) as Review[];
}

export function addReview(girlId: number, panelRating: string, comment: string | null, browserId: string) {
  const existing = db.prepare('SELECT id FROM reviews WHERE girl_id = ? AND browser_id = ?').get(girlId, browserId);
  if (existing) {
    throw new Error('ALREADY_REVIEWED');
  }
  const now = new Date().toISOString().split('T')[0];
  return db.prepare(
    'INSERT INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id) VALUES (?, ?, ?, ?, ?)'
  ).run(girlId, now, panelRating, comment, browserId);
}

// Stats (only active)
export function getStats() {
  const shopCount = (db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get() as { c: number }).c;
  const girlCount = (db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get() as { c: number }).c;
  const reviewCount = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as { c: number }).c;
  return { shopCount, girlCount, reviewCount };
}
