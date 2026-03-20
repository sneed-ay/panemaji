import db, { Area, Shop, Girl, Review } from './db';
import { seedIfEmpty } from './seed';

// Skip seed during build phase
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  try { seedIfEmpty(); } catch { /* DB not available during build */ }
}

// Prefectures
export type Prefecture = {
  name: string;
  slug: string;
};

const PREFECTURE_SLUG_MAP: Record<string, string> = {
  '東京': 'tokyo',
  '神奈川': 'kanagawa',
  '埼玉': 'saitama',
  '千葉': 'chiba',
};

const SLUG_PREFECTURE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PREFECTURE_SLUG_MAP).map(([k, v]) => [v, k])
);

export function getPrefectures(): Prefecture[] {
  const rows = db.prepare('SELECT DISTINCT prefecture FROM areas ORDER BY prefecture').all() as { prefecture: string }[];
  return rows.map(r => ({
    name: r.prefecture,
    slug: PREFECTURE_SLUG_MAP[r.prefecture] || r.prefecture,
  }));
}

export function prefectureSlugToName(slug: string): string {
  return SLUG_PREFECTURE_MAP[slug] || '東京';
}

export function prefectureNameToSlug(name: string): string {
  return PREFECTURE_SLUG_MAP[name] || 'tokyo';
}

// Areas
export function getAllAreas(): Area[] {
  return db.prepare('SELECT * FROM areas ORDER BY id').all() as Area[];
}

export function getAreasByPrefecture(prefecture: string): Area[] {
  return db.prepare('SELECT * FROM areas WHERE prefecture = ? ORDER BY id').all(prefecture) as Area[];
}

export function getAreaBySlug(slug: string): Area | undefined {
  return db.prepare('SELECT * FROM areas WHERE slug = ?').get(slug) as Area | undefined;
}

// Shop stats via LEFT JOIN aggregation (replaces multiple correlated subqueries)
const SHOP_STATS_JOIN = `
  LEFT JOIN (
    SELECT shop_id, COUNT(*) as girl_count
    FROM girls WHERE is_active = 1
    GROUP BY shop_id
  ) gc ON gc.shop_id = s.id
  LEFT JOIN (
    SELECT g.shop_id,
      COUNT(*) as review_count,
      SUM(CASE WHEN r.panel_rating = 'panel_match' THEN 1 ELSE 0 END) as panel_match_count
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    GROUP BY g.shop_id
  ) rc ON rc.shop_id = s.id
`;

const SHOP_STATS_COLS = `
  COALESCE(gc.girl_count, 0) as girl_count,
  COALESCE(rc.review_count, 0) as review_count,
  COALESCE(rc.panel_match_count, 0) as panel_match_count,
  CASE
    WHEN COALESCE(rc.review_count, 0) = 0 THEN -1
    ELSE ROUND(100.0 * COALESCE(rc.panel_match_count, 0) / rc.review_count)
  END as panemaji_pct
`;

// Shops (only active shops)
export function getShopsByArea(areaId: number): Shop[] {
  return db.prepare(`
    SELECT s.*, a.name as area_name, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.area_id = ? AND s.is_active = 1
    ORDER BY panemaji_pct DESC, review_count DESC, s.name
  `).all(areaId) as Shop[];
}

export function getShopById(id: number): Shop | undefined {
  return db.prepare(`
    SELECT s.*, a.name as area_name, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.id = ?
  `).get(id) as Shop | undefined;
}

export function searchShops(query: string): Shop[] {
  const q = `%${query}%`;
  return db.prepare(`
    SELECT s.*, a.name as area_name, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.name LIKE ? AND s.is_active = 1
    ORDER BY panemaji_pct DESC, review_count DESC, s.name
    LIMIT 50
  `).all(q) as Shop[];
}

// Girl stats via LEFT JOIN aggregation (replaces multiple correlated subqueries)
const GIRL_STATS_JOIN = `
  LEFT JOIN (
    SELECT girl_id,
      COUNT(*) as review_count,
      SUM(CASE WHEN panel_rating = 'panel_match' THEN 1 ELSE 0 END) as panel_match_count,
      SUM(CASE WHEN panel_rating = 'panel_diff' THEN 1 ELSE 0 END) as panel_diff_count,
      SUM(CASE WHEN panel_rating = 'jirai' THEN 1 ELSE 0 END) as jirai_count
    FROM reviews
    GROUP BY girl_id
  ) rs ON rs.girl_id = g.id
`;

const GIRL_STATS_COLS = `
  COALESCE(rs.review_count, 0) as review_count,
  COALESCE(rs.panel_match_count, 0) as panel_match_count,
  COALESCE(rs.panel_diff_count, 0) as panel_diff_count,
  COALESCE(rs.jirai_count, 0) as jirai_count,
  CASE
    WHEN COALESCE(rs.review_count, 0) = 0 THEN -1
    ELSE ROUND(100.0 * rs.panel_match_count / rs.review_count)
  END as panemaji_pct
`;

// Girls (only active by default)
export function getGirlsByShop(shopId: number, search?: string): Girl[] {
  const where = search
    ? 'WHERE g.shop_id = ? AND g.is_active = 1 AND g.name LIKE ?'
    : 'WHERE g.shop_id = ? AND g.is_active = 1';
  const params = search ? [shopId, `%${search}%`] : [shopId];
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    ${GIRL_STATS_JOIN}
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
    SELECT g.*, s.name as shop_name, a.name as area_name, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    ${GIRL_STATS_JOIN}
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

// Update girl's twitter URL (only if not already set, or allow override)
export function updateGirlTwitter(girlId: number, twitterUrl: string) {
  // Always update with latest submission (newest wins)
  db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ?').run(twitterUrl, girlId);
}

// Stats (only active) - single query instead of 3
export function getStats() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM shops WHERE is_active = 1) as shopCount,
      (SELECT COUNT(*) FROM girls WHERE is_active = 1) as girlCount,
      (SELECT COUNT(*) FROM reviews) as reviewCount
  `).get() as { shopCount: number; girlCount: number; reviewCount: number };
}

export function getStatsByPrefecture(prefecture: string) {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM shops s JOIN areas a ON s.area_id = a.id WHERE s.is_active = 1 AND a.prefecture = ?) as shopCount,
      (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE g.is_active = 1 AND a.prefecture = ?) as girlCount,
      (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE a.prefecture = ?) as reviewCount
  `).get(prefecture, prefecture, prefecture) as { shopCount: number; girlCount: number; reviewCount: number };
}
