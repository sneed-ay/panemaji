import db, { Area, Shop, Girl, Review, ShopComment } from './db';
import { seedIfEmpty } from './seed';

// Skip seed during build phase
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  try { seedIfEmpty(); } catch { /* DB not available during build */ }
}

// Prefectures
export type Prefecture = {
  name: string;
  slug: string;
  region: string;
};

const PREFECTURE_MAP: Record<string, { name: string; region: string }> = {
  hokkaido: { name: '北海道', region: '北海道・東北' },
  aomori: { name: '青森', region: '北海道・東北' },
  iwate: { name: '岩手', region: '北海道・東北' },
  miyagi: { name: '宮城', region: '北海道・東北' },
  akita: { name: '秋田', region: '北海道・東北' },
  yamagata: { name: '山形', region: '北海道・東北' },
  fukushima: { name: '福島', region: '北海道・東北' },
  ibaraki: { name: '茨城', region: '関東' },
  tochigi: { name: '栃木', region: '関東' },
  gunma: { name: '群馬', region: '関東' },
  saitama: { name: '埼玉', region: '関東' },
  chiba: { name: '千葉', region: '関東' },
  tokyo: { name: '東京', region: '関東' },
  kanagawa: { name: '神奈川', region: '関東' },
  niigata: { name: '新潟', region: '中部' },
  toyama: { name: '富山', region: '中部' },
  ishikawa: { name: '石川', region: '中部' },
  fukui: { name: '福井', region: '中部' },
  yamanashi: { name: '山梨', region: '中部' },
  nagano: { name: '長野', region: '中部' },
  gifu: { name: '岐阜', region: '中部' },
  shizuoka: { name: '静岡', region: '中部' },
  aichi: { name: '愛知', region: '中部' },
  mie: { name: '三重', region: '近畿' },
  shiga: { name: '滋賀', region: '近畿' },
  kyoto: { name: '京都', region: '近畿' },
  osaka: { name: '大阪', region: '近畿' },
  hyogo: { name: '兵庫', region: '近畿' },
  nara: { name: '奈良', region: '近畿' },
  wakayama: { name: '和歌山', region: '近畿' },
  tottori: { name: '鳥取', region: '中国・四国' },
  shimane: { name: '島根', region: '中国・四国' },
  okayama: { name: '岡山', region: '中国・四国' },
  hiroshima: { name: '広島', region: '中国・四国' },
  yamaguchi: { name: '山口', region: '中国・四国' },
  tokushima: { name: '徳島', region: '中国・四国' },
  kagawa: { name: '香川', region: '中国・四国' },
  ehime: { name: '愛媛', region: '中国・四国' },
  kochi: { name: '高知', region: '中国・四国' },
  fukuoka: { name: '福岡', region: '九州・沖縄' },
  saga: { name: '佐賀', region: '九州・沖縄' },
  nagasaki: { name: '長崎', region: '九州・沖縄' },
  kumamoto: { name: '熊本', region: '九州・沖縄' },
  oita: { name: '大分', region: '九州・沖縄' },
  miyazaki: { name: '宮崎', region: '九州・沖縄' },
  kagoshima: { name: '鹿児島', region: '九州・沖縄' },
  okinawa: { name: '沖縄', region: '九州・沖縄' },
};

const REGION_ORDER = ['北海道・東北', '関東', '中部', '近畿', '中国・四国', '九州・沖縄'];

// Category mapping (URL slug -> DB value)
export const CATEGORY_MAP: Record<string, string> = {
  deriheru: 'デリヘル',
  menesu: 'メンズエステ',
  soap: 'ソープ',
  health: 'ヘルス',
  esthe: 'エステ・アロマ',
  hotelhel: 'ホテヘル',
  sekkyaba: 'セクキャバ',
};

export const CATEGORY_TABS = [
  { slug: '', label: 'すべて' },
  { slug: 'deriheru', label: 'デリヘル' },
  { slug: 'menesu', label: 'メンエス' },
  { slug: 'soap', label: 'ソープ' },
  { slug: 'health', label: 'ヘルス' },
  { slug: 'esthe', label: 'エステ' },
  { slug: 'hotelhel', label: 'ホテヘル' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'デリヘル': 'bg-pink-100 text-pink-700',
  'メンズエステ': 'bg-purple-100 text-purple-700',
  'ソープ': 'bg-blue-100 text-blue-700',
  'ヘルス': 'bg-green-100 text-green-700',
  'エステ・アロマ': 'bg-teal-100 text-teal-700',
  'ホテヘル': 'bg-orange-100 text-orange-700',
  'セクキャバ': 'bg-red-100 text-red-700',
};

export function isValidCategory(slug: string): boolean {
  return slug in CATEGORY_MAP;
}

function categoryToDbValue(catSlug?: string): string | undefined {
  if (!catSlug) return undefined;
  return CATEGORY_MAP[catSlug];
}

export function getPrefectures(): Prefecture[] {
  // Return all 47 prefectures from PREFECTURE_MAP (ordered by map key insertion order)
  return Object.entries(PREFECTURE_MAP).map(([slug, info]) => ({
    name: info.name,
    slug,
    region: info.region,
  }));
}

export function getRegionOrder(): string[] {
  return REGION_ORDER;
}

export function prefectureSlugToName(slug: string): string {
  return PREFECTURE_MAP[slug]?.name || '東京';
}

export function prefectureNameToSlug(name: string): string {
  const entry = Object.entries(PREFECTURE_MAP).find(([, v]) => v.name === name);
  return entry ? entry[0] : 'tokyo';
}

// Areas
export function getAllAreas(): Area[] {
  return db.prepare('SELECT * FROM areas ORDER BY id').all() as Area[];
}

export function getAreasByPrefecture(prefectureSlug: string, catSlug?: string): Area[] {
  const catValue = categoryToDbValue(catSlug);
  if (catValue) {
    // Only return areas that have at least one active shop in this category
    return db.prepare(`
      SELECT DISTINCT a.* FROM areas a
      JOIN shops s ON s.area_id = a.id
      WHERE a.prefecture = ? AND s.is_active = 1 AND s.category = ?
      ORDER BY a.display_order, a.id
    `).all(prefectureSlug, catValue) as Area[];
  }
  return db.prepare('SELECT * FROM areas WHERE prefecture = ? ORDER BY display_order, id').all(prefectureSlug) as Area[];
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
      SUM(CASE WHEN r.panel_rating = 'panel_match' THEN 1 ELSE 0 END) as panel_match_count,
      SUM(CASE WHEN r.panel_rating = 'panel_diff' THEN 1 ELSE 0 END) as panel_diff_count,
      SUM(CASE WHEN r.panel_rating = 'jirai' THEN 1 ELSE 0 END) as jirai_count
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    GROUP BY g.shop_id
  ) rc ON rc.shop_id = s.id
`;

const SHOP_STATS_COLS = `
  COALESCE(gc.girl_count, 0) as girl_count,
  COALESCE(rc.review_count, 0) as review_count,
  COALESCE(rc.panel_match_count, 0) as panel_match_count,
  COALESCE(rc.panel_diff_count, 0) as panel_diff_count,
  COALESCE(rc.jirai_count, 0) as jirai_count,
  CASE
    WHEN COALESCE(rc.review_count, 0) = 0 THEN -1
    ELSE ROUND((COALESCE(rc.panel_match_count, 0) * 100.0 + COALESCE(rc.panel_diff_count, 0) * 50.0) / rc.review_count)
  END as real_pct
`;

// Shops (only active shops)
export function getShopsByArea(areaId: number, catSlug?: string): Shop[] {
  const catValue = categoryToDbValue(catSlug);
  const catFilter = catValue ? ' AND s.category = ?' : '';
  const params = catValue ? [areaId, catValue] : [areaId];
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.area_id = ? AND s.is_active = 1${catFilter}
    ORDER BY real_pct DESC, review_count DESC, s.name
  `).all(...params) as Shop[];
}

export function getShopById(id: number): Shop | undefined {
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.id = ?
  `).get(id) as Shop | undefined;
}

export function searchShops(query: string): Shop[] {
  const q = `%${query}%`;
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.name LIKE ? AND s.is_active = 1
    ORDER BY real_pct DESC, review_count DESC, s.name
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
    ELSE ROUND((rs.panel_match_count * 100.0 + rs.panel_diff_count * 50.0) / rs.review_count)
  END as real_pct
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
    ORDER BY real_pct DESC, review_count DESC, g.name
  `).all(...params) as Girl[];
}

export function getGirlById(id: number): Girl | undefined {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    WHERE g.id = ?
  `).get(id) as Girl | undefined;
}

export function getGirlWithReviewStats(id: number): Girl | undefined {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS}
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

export function getReviewsByShop(shopId: number, limit: number = 5): Review[] {
  return db.prepare(`
    SELECT r.*, g.name as girl_name, s.name as shop_name
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    WHERE g.shop_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(shopId, limit) as Review[];
}

export function getLatestReviews(limit: number = 20): Review[] {
  return db.prepare(`
    SELECT r.*, g.name as girl_name, s.name as shop_name, g.image_url as girl_image_url
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

// Update review comment (add comment after voting)
export function updateReviewComment(girlId: number, browserId: string, comment: string) {
  return db.prepare(
    'UPDATE reviews SET comment = ? WHERE girl_id = ? AND browser_id = ?'
  ).run(comment, girlId, browserId);
}

// Get other girls in the same shop (for post-vote recommendations)
// Prioritizes girls with fewer reviews, excludes the current girl
export function getOtherGirlsInShop(shopId: number, excludeGirlId: number, limit: number = 3): Girl[] {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    ${GIRL_STATS_JOIN}
    WHERE g.shop_id = ? AND g.id != ? AND g.is_active = 1
    ORDER BY COALESCE(rs.review_count, 0) ASC, g.name
    LIMIT ?
  `).all(shopId, excludeGirlId, limit) as Girl[];
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

export function getStatsByPrefecture(prefectureSlug: string, catSlug?: string) {
  const catValue = categoryToDbValue(catSlug);
  if (catValue) {
    return db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM shops s JOIN areas a ON s.area_id = a.id WHERE s.is_active = 1 AND a.prefecture = ? AND s.category = ?) as shopCount,
        (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE g.is_active = 1 AND a.prefecture = ? AND s.category = ?) as girlCount,
        (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE a.prefecture = ? AND s.category = ?) as reviewCount
    `).get(prefectureSlug, catValue, prefectureSlug, catValue, prefectureSlug, catValue) as { shopCount: number; girlCount: number; reviewCount: number };
  }
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM shops s JOIN areas a ON s.area_id = a.id WHERE s.is_active = 1 AND a.prefecture = ?) as shopCount,
      (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE g.is_active = 1 AND a.prefecture = ?) as girlCount,
      (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE a.prefecture = ?) as reviewCount
  `).get(prefectureSlug, prefectureSlug, prefectureSlug) as { shopCount: number; girlCount: number; reviewCount: number };
}

// Sitemap helpers
export function getAllShopIds(): { id: number }[] {
  return db.prepare('SELECT id FROM shops WHERE is_active = 1 ORDER BY id').all() as { id: number }[];
}

export function getGirlIdsPaginated(offset: number, limit: number): { id: number }[] {
  return db.prepare('SELECT id FROM girls WHERE is_active = 1 ORDER BY id LIMIT ? OFFSET ?').all(limit, offset) as { id: number }[];
}

export function getActiveGirlCount(): number {
  return (db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get() as { c: number }).c;
}

export function getPrefectureSlugs(): string[] {
  return Object.keys(PREFECTURE_MAP);
}

// Ranking queries

// Top girls by real_pct (panel match rate) - requires minimum reviews
export function getTopRealGirls(prefectureSlug: string, limit: number = 20, catSlug?: string): Girl[] {
  const catValue = categoryToDbValue(catSlug);
  const catFilter = catValue ? ' AND s.category = ?' : '';
  const params = catValue ? [prefectureSlug, catValue, limit] : [prefectureSlug, limit];
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    ${GIRL_STATS_JOIN}
    WHERE g.is_active = 1 AND a.prefecture = ?${catFilter} AND COALESCE(rs.review_count, 0) >= 3
    ORDER BY real_pct DESC, rs.review_count DESC
    LIMIT ?
  `).all(...params) as Girl[];
}

// Worst girls by real_pct (panel fraud rate) - requires minimum reviews
export function getWorstRealGirls(prefectureSlug: string, limit: number = 20, catSlug?: string): Girl[] {
  const catValue = categoryToDbValue(catSlug);
  const catFilter = catValue ? ' AND s.category = ?' : '';
  const params = catValue ? [prefectureSlug, catValue, limit] : [prefectureSlug, limit];
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    ${GIRL_STATS_JOIN}
    WHERE g.is_active = 1 AND a.prefecture = ?${catFilter} AND COALESCE(rs.review_count, 0) >= 3
    ORDER BY real_pct ASC, rs.review_count DESC
    LIMIT ?
  `).all(...params) as Girl[];
}

// Top shops by real_pct - requires minimum reviews
export function getTopRealShops(prefectureSlug: string, limit: number = 20): Shop[] {
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.is_active = 1 AND a.prefecture = ? AND COALESCE(rc.review_count, 0) >= 5
    ORDER BY real_pct DESC, rc.review_count DESC
    LIMIT ?
  `).all(prefectureSlug, limit) as Shop[];
}

// Shops with many girls but few reviews (review-seeking shops)
export function getShopsSeekingReviews(prefectureSlug: string, limit: number = 10): Shop[] {
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.is_active = 1 AND a.prefecture = ? AND COALESCE(gc.girl_count, 0) >= 5 AND COALESCE(rc.review_count, 0) < 5
    ORDER BY gc.girl_count DESC
    LIMIT ?
  `).all(prefectureSlug, limit) as Shop[];
}

// Check if a prefecture slug is valid
export function isValidPrefecture(slug: string): boolean {
  return slug in PREFECTURE_MAP;
}

// Get popular girls in the same area (by review count), for girl detail page
export function getPopularGirlsInArea(areaId: number, excludeGirlId: number, limit: number = 4): Girl[] {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    ${GIRL_STATS_JOIN}
    WHERE s.area_id = ? AND g.id != ? AND g.is_active = 1 AND COALESCE(rs.review_count, 0) > 0
    ORDER BY rs.review_count DESC, real_pct DESC
    LIMIT ?
  `).all(areaId, excludeGirlId, limit) as Girl[];
}

// Get other girls in same shop for girl detail page (more results, review-few-first)
export function getOtherGirlsInShopExpanded(shopId: number, excludeGirlId: number, limit: number = 6): Girl[] {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    ${GIRL_STATS_JOIN}
    WHERE g.shop_id = ? AND g.id != ? AND g.is_active = 1
    ORDER BY COALESCE(rs.review_count, 0) ASC, g.name
    LIMIT ?
  `).all(shopId, excludeGirlId, limit) as Girl[];
}

// Get area_id for a shop
export function getShopAreaId(shopId: number): number | undefined {
  const row = db.prepare('SELECT area_id FROM shops WHERE id = ?').get(shopId) as { area_id: number } | undefined;
  return row?.area_id;
}

// --- Shop Comments (BBS) ---

export function getShopComments(shopId: number, limit: number = 20): ShopComment[] {
  return db.prepare(`
    SELECT * FROM shop_comments
    WHERE shop_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(shopId, limit) as ShopComment[];
}

export function addShopComment(shopId: number, comment: string, browserId: string | null): ShopComment {
  const result = db.prepare(
    'INSERT INTO shop_comments (shop_id, comment, browser_id) VALUES (?, ?, ?)'
  ).run(shopId, comment, browserId);
  return db.prepare('SELECT * FROM shop_comments WHERE id = ?').get(result.lastInsertRowid) as ShopComment;
}

export function getShopCommentCount(shopId: number): number {
  return (db.prepare('SELECT COUNT(*) as c FROM shop_comments WHERE shop_id = ?').get(shopId) as { c: number }).c;
}

export function getLastShopCommentTime(shopId: number, browserId: string): string | null {
  const row = db.prepare(
    'SELECT created_at FROM shop_comments WHERE shop_id = ? AND browser_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(shopId, browserId) as { created_at: string } | undefined;
  return row?.created_at || null;
}

// --- Shop Article Queries ---

// Top shops for article generation (by review_count + girl_count)
export function getTopShopsForArticles(limit: number = 200): Shop[] {
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, a.prefecture, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.is_active = 1
    ORDER BY (COALESCE(rc.review_count, 0) * 2 + COALESCE(gc.girl_count, 0)) DESC
    LIMIT ?
  `).all(limit) as Shop[];
}

// Full article data for a single shop
export type ShopArticleData = {
  shop: Shop & { prefecture: string };
  reviewDistribution: { panel_match: number; panel_diff: number; jirai: number; total: number };
  latestReviewsWithComment: Review[];
  topRealGirls: Girl[];
  girlsWithNoReviews: Girl[];
  relatedShops: Shop[];
};

export function getShopArticleData(shopId: number): ShopArticleData | null {
  // Shop with area and prefecture
  const shop = db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, a.prefecture, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.id = ?
  `).get(shopId) as (Shop & { prefecture: string }) | undefined;

  if (!shop) return null;

  const reviewDistribution = {
    panel_match: shop.panel_match_count || 0,
    panel_diff: shop.panel_diff_count || 0,
    jirai: shop.jirai_count || 0,
    total: shop.review_count || 0,
  };

  // Latest reviews with comments (top 5)
  const latestReviewsWithComment = db.prepare(`
    SELECT r.*, g.name as girl_name, s.name as shop_name
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    WHERE g.shop_id = ? AND r.comment IS NOT NULL AND r.comment != ''
    ORDER BY r.created_at DESC
    LIMIT 5
  `).all(shopId) as Review[];

  // Top real girls (by panel match rate, min 1 review)
  const topRealGirls = db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    ${GIRL_STATS_JOIN}
    WHERE g.shop_id = ? AND g.is_active = 1 AND COALESCE(rs.review_count, 0) >= 1
    ORDER BY real_pct DESC, rs.review_count DESC
    LIMIT 5
  `).all(shopId) as Girl[];

  // Girls with no reviews (for "review wanted" section)
  const girlsWithNoReviews = db.prepare(`
    SELECT g.*, s.name as shop_name
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    LEFT JOIN reviews r ON r.girl_id = g.id
    WHERE g.shop_id = ? AND g.is_active = 1 AND r.id IS NULL
    ORDER BY g.name
    LIMIT 10
  `).all(shopId) as Girl[];

  // Related shops (same area, excluding current)
  const relatedShops = db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.area_id = ? AND s.id != ? AND s.is_active = 1
    ORDER BY COALESCE(rc.review_count, 0) DESC
    LIMIT 5
  `).all(shop.area_id, shopId) as Shop[];

  return {
    shop,
    reviewDistribution,
    latestReviewsWithComment,
    topRealGirls,
    girlsWithNoReviews,
    relatedShops,
  };
}
