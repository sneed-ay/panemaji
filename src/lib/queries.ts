import db, { Area, Shop, Girl, Review, ShopComment } from './db';
import { seedIfEmpty } from './seed';

// Skip seed during build phase
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  try { seedIfEmpty(); } catch { /* DB not available during build */ }
}

// 軽量 TTL メモ (本番 Render は永続 Node プロセスなので request 跨ぎで有効)。
// ホームページ等は searchParams 依存で「動的レンダリング = 毎 request SSR」のため、
// 重い集計クエリ(SHOP_STATS_JOIN 系)を TTL 間キャッシュして per-request の DB コストを削減する。
// データ更新は daily-maintenance / 明示同期 経由で稀 + デプロイで自然にクリアされるため stale は許容。
const _qCache = new Map<string, { at: number; val: unknown }>();
function qmemo<T>(key: string, ttlMs: number, fn: () => T): T {
  const hit = _qCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.val as T;
  const val = fn();
  _qCache.set(key, { at: now, val });
  return val;
}
const Q_TTL = 300_000; // 5分

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

/**
 * 同じ都道府県内の他エリアを「アクティブ店舗数の多い順」で返す。
 * SEO の internal linking 強化 (近隣エリア widget) 用。
 *
 * @param prefectureSlug 都道府県 slug (例: tokyo)
 * @param excludeAreaId  除外する現在のエリア ID
 * @param limit          最大件数 (default 8)
 */
export function getRelatedAreas(
  prefectureSlug: string,
  excludeAreaId: number,
  limit = 8,
): (Area & { shop_count: number })[] {
  // 2026-06-12 SEO監査: shop_count DESC だけだと大エリアばかりがリンクを受け、店舗はあるのに
  // 順位の低い小エリアに内部リンクが回らない。上位(店舗多い)を limit-2 件、残り2枠は
  // 「店舗はあるが低カバレッジ」エリアを混ぜ、薄いエリアにもリンクジュースを流して底上げする。
  const stat = `LEFT JOIN (SELECT area_id, COUNT(*) as shop_count FROM shops WHERE is_active = 1 GROUP BY area_id) sc ON sc.area_id = a.id`;
  const topN = Math.max(1, limit - 2);
  const top = db.prepare(`
    SELECT a.*, COALESCE(sc.shop_count, 0) as shop_count
    FROM areas a ${stat}
    WHERE a.prefecture = ? AND a.id != ?
    ORDER BY shop_count DESC, a.display_order, a.id
    LIMIT ?
  `).all(prefectureSlug, excludeAreaId, topN) as (Area & { shop_count: number })[];
  const topIds = new Set(top.map((a) => a.id));
  const low = db.prepare(`
    SELECT a.*, COALESCE(sc.shop_count, 0) as shop_count
    FROM areas a ${stat}
    WHERE a.prefecture = ? AND a.id != ? AND COALESCE(sc.shop_count, 0) > 0
    ORDER BY sc.shop_count ASC, a.display_order, a.id
    LIMIT ?
  `).all(prefectureSlug, excludeAreaId, limit) as (Area & { shop_count: number })[];
  const fill = low.filter((a) => !topIds.has(a.id)).slice(0, Math.max(0, limit - top.length));
  return [...top, ...fill];
}

// Shop stats via LEFT JOIN aggregation (replaces multiple correlated subqueries)
// 2026-05-13: girl_count は 「画像 ありの girls」 のみで 算定。
//   これにより 「在籍 N 人」 表示と shop 一覧表示が UI 上で 画像配置率 100% を 担保。
//   画像 ない girls は ユーザーに 見せず, shop 統計にも 含めない。
const SHOP_STATS_JOIN = `
  LEFT JOIN (
    SELECT shop_id, COUNT(*) as girl_count
    FROM girls WHERE is_active = 1 AND image_url IS NOT NULL AND image_url <> ''
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

// ── 相関サブクエリ版の stats (候補行が少ないクエリ専用) ────────────────────
// SHOP_STATS_JOIN / GIRL_STATS_JOIN の derived table は SQLite が毎回 MATERIALIZE するため、
// 「1店舗を引くだけ」でも girls 62万行と reviews 4.4万行を丸ごと GROUP BY していた。
// 実測 (master DB): getShopById 45.7ms → 0.01ms / getGirlWithReviewStats 6.8ms → 0.01ms。
// better-sqlite3 は同期実行なので、この 1本が Render Starter (0.5CPU) の event loop を
// 数秒ブロックし、無関係なリクエストまで巻き添えで遅くなっていた (/api/health が 2.1秒)。
// 候補行が少ないクエリでは index seek になる相関サブクエリの方が速く、結果は完全に同一
// (25件 x 8クエリで全件一致を検証済)。
// ⚠ 都道府県横断・全件走査のクエリ (getTopRealGirls / searchShops 等) は候補行が多く、
//    derived table を1回作る方が速いので JOIN 版のまま据え置くこと。
const SHOP_GIRL_COUNT = `(SELECT COUNT(*) FROM girls gsub WHERE gsub.shop_id = s.id AND gsub.is_active = 1 AND gsub.image_url IS NOT NULL AND gsub.image_url <> '')`;
const shopReviews = (rating?: string) =>
  `(SELECT COUNT(*) FROM reviews rsub JOIN girls gsub2 ON rsub.girl_id = gsub2.id WHERE gsub2.shop_id = s.id${rating ? ` AND rsub.panel_rating = '${rating}'` : ''})`;
const SHOP_REVIEW_COUNT = shopReviews();
const SHOP_STATS_COLS_SUB = `
  ${SHOP_GIRL_COUNT} as girl_count,
  ${SHOP_REVIEW_COUNT} as review_count,
  ${shopReviews('panel_match')} as panel_match_count,
  ${shopReviews('panel_diff')} as panel_diff_count,
  ${shopReviews('jirai')} as jirai_count,
  CASE
    WHEN ${SHOP_REVIEW_COUNT} = 0 THEN -1
    ELSE ROUND((${shopReviews('panel_match')} * 100.0 + ${shopReviews('panel_diff')} * 50.0) / ${SHOP_REVIEW_COUNT})
  END as real_pct
`;

// Shops (only active shops with at least 1 girl)
// 嬢0の店は一覧から除外 (個別shopページは引き続き表示可能)
export function getShopsByArea(areaId: number, catSlug?: string): Shop[] {
  const catValue = categoryToDbValue(catSlug);
  const catFilter = catValue ? ' AND s.category = ?' : '';
  const params = catValue ? [areaId, catValue] : [areaId];
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS_SUB}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.area_id = ? AND s.is_active = 1 AND ${SHOP_GIRL_COUNT} >= 1${catFilter}
    ORDER BY real_pct DESC, review_count DESC, s.name
  `).all(...params) as Shop[];
}

/**
 * エリアの「閉店した可能性が高い店舗」を 取得。
 * 判定: is_active=0 (maintenance Phase 2-6 で 30 日以上ゼロ人なら deactivate される)
 *      または 在籍 0 で last_seen_at が 7 日以上前。
 * 直近 6 か月以内に 観測された店舗のみ (それ以前は サイト初期からの残存と思われ 表示しない)
 *
 * Note: 評価データがある shop は 閉店していても 価値が残るので 上位に出す。
 */
/**
 * エリアの metadata 用の軽量集計。
 * 以前は generateMetadata から getShopsByArea() を呼んでいたが、ページ本体でも同じ呼び出しがあり
 * 全行(最大370件)を2回取得していた。description に必要なのは3つの数だけなので集計で済ませる。
 * catSlug も受けてページ本体と同じ母集団にする (?cat= 付きURLで数字が食い違うのを防ぐ)。
 */
export function getAreaMetaStats(areaId: number, catSlug?: string): { shopCount: number; girlTotal: number; reviewTotal: number } {
  const catValue = categoryToDbValue(catSlug);
  const catFilter = catValue ? ' AND s.category = ?' : '';
  const params = catValue ? [areaId, catValue] : [areaId];
  const row = db.prepare(`
    SELECT COUNT(*) AS shopCount,
           COALESCE(SUM(${SHOP_GIRL_COUNT}), 0) AS girlTotal,
           COALESCE(SUM(${SHOP_REVIEW_COUNT}), 0) AS reviewTotal
    FROM shops s
    WHERE s.area_id = ? AND s.is_active = 1 AND ${SHOP_GIRL_COUNT} >= 1${catFilter}
  `).get(...params) as { shopCount: number; girlTotal: number; reviewTotal: number };
  return row;
}

export function getRecentlyClosedShopsByArea(areaId: number, catSlug?: string, limit: number = 30): Shop[] {
  const catValue = categoryToDbValue(catSlug);
  const catFilter = catValue ? ' AND s.category = ?' : '';
  const baseParams: (number | string)[] = [areaId];
  if (catValue) baseParams.push(catValue);
  baseParams.push(limit);
  // 2026-05-13: girl_count は 「画像あり girls」 のみで 算定する。
  //   結果 girl_count=0 の shop は ① 本物の 0 girl shop or ② 全 girls 画像なし の どちらか。
  //   どちらも area の メインリストには 不適切 (前者=閉店, 後者=データ未整備)。
  //   ここでは 7日 縛り を 緩めて active=1 で gc=0 の shop も 「閉店候補」 として 拾う。
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS_SUB}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.area_id = ?${catFilter}
      AND (
        (s.is_active = 0 AND s.last_seen_at >= date('now', '-180 days'))
        OR (s.is_active = 1 AND ${SHOP_GIRL_COUNT} = 0)
      )
    ORDER BY ${SHOP_REVIEW_COUNT} DESC, s.last_seen_at DESC, s.name
    LIMIT ?
  `).all(...baseParams) as Shop[];
}

export function getShopById(id: number): Shop | undefined {
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, a.prefecture as area_prefecture, ${SHOP_STATS_COLS_SUB}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
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
    WHERE s.name LIKE ? AND s.is_active = 1 AND COALESCE(gc.girl_count, 0) >= 1
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

const girlReviews = (rating?: string) =>
  `(SELECT COUNT(*) FROM reviews rgsub WHERE rgsub.girl_id = g.id${rating ? ` AND rgsub.panel_rating = '${rating}'` : ''})`;
const GIRL_REVIEW_COUNT = girlReviews();
const GIRL_STATS_COLS_SUB = `
  ${GIRL_REVIEW_COUNT} as review_count,
  ${girlReviews('panel_match')} as panel_match_count,
  ${girlReviews('panel_diff')} as panel_diff_count,
  ${girlReviews('jirai')} as jirai_count,
  CASE
    WHEN ${GIRL_REVIEW_COUNT} = 0 THEN -1
    ELSE ROUND((${girlReviews('panel_match')} * 100.0 + ${girlReviews('panel_diff')} * 50.0) / ${GIRL_REVIEW_COUNT})
  END as real_pct
`;

// Girls (only active by default)
// 並び順: 画像あり優先 → real_pct → review_count → name
//   (UX 改善: 画像なし girl が混在で見栄え悪い問題への対応)
export function getGirlsByShop(shopId: number, search?: string): Girl[] {
  // 2026-05-13: 画像なし girls は 表示しない (placeholder 撲滅・「公開画像配置率 100%」 担保)
  const where = search
    ? 'WHERE g.shop_id = ? AND g.is_active = 1 AND g.image_url IS NOT NULL AND g.image_url <> \'\' AND g.name LIKE ?'
    : 'WHERE g.shop_id = ? AND g.is_active = 1 AND g.image_url IS NOT NULL AND g.image_url <> \'\'';
  const params = search ? [shopId, `%${search}%`] : [shopId];
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS_SUB}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    ${where}
    ORDER BY real_pct DESC, review_count DESC, g.name
  `).all(...params) as Girl[];
}

// 退店した可能性のある嬢 (is_active=0・直近180日内に確認・画像あり)。
// 一覧の最下部に「退店」タグ付きで表示する用。
export function getDepartedGirlsByShop(shopId: number): Girl[] {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS_SUB}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE g.shop_id = ? AND g.is_active = 0
      AND g.image_url IS NOT NULL AND g.image_url <> ''
      AND g.last_seen_at >= date('now', '-180 days')
    ORDER BY review_count DESC, g.last_seen_at DESC, g.name
    LIMIT 60
  `).all(shopId) as Girl[];
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
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS_SUB}
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

// 画像あり girl の review を優先 (UX: TOP / 都道府県ページ の 最新口コミ枠で
// placeholder 連発を回避)。 過去 14 日以内の画像なし review は補助で混ぜて
// freshness は維持。
export function getLatestReviews(limit: number = 20, prefectureSlug?: string): Review[] {
  if (prefectureSlug) {
    return qmemo(`latestRev:${prefectureSlug}:${limit}`, Q_TTL, () => db.prepare(`
      SELECT r.*, g.name as girl_name, s.name as shop_name
      FROM reviews r
      JOIN girls g ON r.girl_id = g.id
      JOIN shops s ON g.shop_id = s.id
      JOIN areas a ON s.area_id = a.id
      WHERE a.prefecture = ?
      AND g.image_url IS NOT NULL AND g.image_url <> ''
      ORDER BY r.created_at DESC
      LIMIT ?
    `).all(prefectureSlug, limit) as Review[]);
  }
  return qmemo(`latestRev::${limit}`, Q_TTL, () => db.prepare(`
    SELECT r.*, g.name as girl_name, s.name as shop_name
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    WHERE g.image_url IS NOT NULL AND g.image_url <> ''
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit) as Review[]);
}

export function addReview(girlId: number, panelRating: string, comment: string | null, browserId: string, userId: number | null = null) {
  // 会員投稿の場合: user_id + girl_id でユニーク (1人1嬢1口コミ)
  if (userId) {
    const existingByUser = db.prepare('SELECT id FROM reviews WHERE girl_id = ? AND user_id = ?').get(girlId, userId);
    if (existingByUser) throw new Error('ALREADY_REVIEWED');
  } else {
    const existing = db.prepare('SELECT id FROM reviews WHERE girl_id = ? AND browser_id = ?').get(girlId, browserId);
    if (existing) throw new Error('ALREADY_REVIEWED');
  }
  const now = new Date().toISOString().split('T')[0];
  return db.prepare(
    'INSERT INTO reviews (girl_id, visit_date, panel_rating, comment, browser_id, user_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(girlId, now, panelRating, comment, browserId, userId);
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
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS_SUB}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE g.shop_id = ? AND g.id != ? AND g.is_active = 1
    ORDER BY ${GIRL_REVIEW_COUNT} ASC, g.name
    LIMIT ?
  `).all(shopId, excludeGirlId, limit) as Girl[];
}

// Update girl's twitter URL (only if not already set, or allow override)
export function updateGirlTwitter(girlId: number, twitterUrl: string) {
  // Always update with latest submission (newest wins)
  db.prepare('UPDATE girls SET twitter_url = ? WHERE id = ?').run(twitterUrl, girlId);
}

// Stats (only active) - single query instead of 3
// プロセス起動時 1 回だけ計算して memo (DB 内容は deploy 単位で 固定なので 安全)
let _statsMemo: { shopCount: number; girlCount: number; reviewCount: number } | null = null;
export function getStats() {
  if (_statsMemo !== null) return _statsMemo;
  _statsMemo = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM shops WHERE is_active = 1) as shopCount,
      (SELECT COUNT(*) FROM girls WHERE is_active = 1) as girlCount,
      (SELECT COUNT(*) FROM reviews) as reviewCount
  `).get() as { shopCount: number; girlCount: number; reviewCount: number };
  return _statsMemo;
}

// 47 prefecture x stats を 1 度の集計クエリで 全部取り、 Map に memo。
// 各 prefecture ページの 個別 COUNT (83ms × 多数) を 一括化 + キャッシュ。
type StatsRow = { shopCount: number; girlCount: number; reviewCount: number };
let _statsByPrefMemo: Map<string, StatsRow> | null = null;
const EMPTY_STATS: StatsRow = { shopCount: 0, girlCount: 0, reviewCount: 0 };

function populateStatsByPref(): Map<string, StatsRow> {
  const m = new Map<string, StatsRow>();
  const rows = db.prepare(`
    SELECT a.prefecture,
      COUNT(DISTINCT CASE WHEN s.is_active=1 THEN s.id END) as shopCount,
      COUNT(DISTINCT CASE WHEN g.is_active=1 THEN g.id END) as girlCount,
      COUNT(DISTINCT r.id) as reviewCount
    FROM areas a
    LEFT JOIN shops s ON s.area_id = a.id
    LEFT JOIN girls g ON g.shop_id = s.id
    LEFT JOIN reviews r ON r.girl_id = g.id
    GROUP BY a.prefecture
  `).all() as Array<{ prefecture: string } & StatsRow>;
  for (const r of rows) {
    m.set(r.prefecture, { shopCount: r.shopCount, girlCount: r.girlCount, reviewCount: r.reviewCount });
  }
  return m;
}

export function getStatsByPrefecture(prefectureSlug: string, catSlug?: string): StatsRow {
  // cat 指定なしの場合は memo を使う (47 prefecture × ~ Q&A 表示で 毎ページ呼ばれる)
  if (!catSlug) {
    if (_statsByPrefMemo === null) {
      _statsByPrefMemo = populateStatsByPref();
    }
    return _statsByPrefMemo.get(prefectureSlug) ?? EMPTY_STATS;
  }
  // cat 指定ありは レア (カテゴリ別 prefecture) なので 都度 query
  const catValue = categoryToDbValue(catSlug);
  if (!catValue) {
    if (_statsByPrefMemo === null) {
      _statsByPrefMemo = populateStatsByPref();
    }
    return _statsByPrefMemo.get(prefectureSlug) ?? EMPTY_STATS;
  }
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM shops s JOIN areas a ON s.area_id = a.id WHERE s.is_active = 1 AND a.prefecture = ? AND s.category = ?) as shopCount,
      (SELECT COUNT(*) FROM girls g JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE g.is_active = 1 AND a.prefecture = ? AND s.category = ?) as girlCount,
      (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id = g.id JOIN shops s ON g.shop_id = s.id JOIN areas a ON s.area_id = a.id WHERE a.prefecture = ? AND s.category = ?) as reviewCount
  `).get(prefectureSlug, catValue, prefectureSlug, catValue, prefectureSlug, catValue) as StatsRow;
}

// Sitemap helpers
// GSC indexing 改善のため、 sitemap に含めるのは「質の高い URL のみ」 に絞る:
//
// shop:
//   girls >= 3 OR 1件以上 review あり
//   → 8,335 件 (44%) の thin shop を除外、 残り 10,503 件
//
// girl:
//   image_url あり OR 1件以上 review あり
//   → 107,213 件 (26%) の thin girl を除外、 残り 310,606 件
//
// 効果:
//   - Google "サイト全体に低品質シグナル" 判定が消える
//   - crawl budget が 高品質 URL に集中
//   - "クロール済み・インデックス未登録" カテゴリ削減期待
//
// 注: thin URL 自体は 200 で生きる (直リンク・内部リンクで到達可能)。
//     sitemap で priority signal を下げるだけ。
const SHOP_QUALITY_FILTER = `
  AND (
    (SELECT COUNT(*) FROM girls g WHERE g.shop_id=shops.id AND g.is_active=1) >= 3
    OR EXISTS (SELECT 1 FROM reviews r JOIN girls g ON g.id=r.girl_id WHERE g.shop_id=shops.id)
  )`;

const GIRL_QUALITY_FILTER = `
  AND (
    (image_url IS NOT NULL AND image_url != '')
    OR EXISTS (SELECT 1 FROM reviews r WHERE r.girl_id=girls.id)
  )`;

export function getAllShopIds(): { id: number; last_seen_at: string | null }[] {
  return db.prepare(`SELECT id, last_seen_at FROM shops WHERE is_active = 1 ${SHOP_QUALITY_FILTER} ORDER BY id`).all() as { id: number; last_seen_at: string | null }[];
}

export function getGirlIdsPaginated(offset: number, limit: number): { id: number; last_seen_at: string | null }[] {
  return db.prepare(`SELECT id, last_seen_at FROM girls WHERE is_active = 1 ${GIRL_QUALITY_FILTER} ORDER BY id LIMIT ? OFFSET ?`).all(limit, offset) as { id: number; last_seen_at: string | null }[];
}

// メモリ効率版: 50k 行を全部 array で持たずに iterator で逐次返す
// (Render Starter 512MB sitemap 用 + GSC 質シグナル向上)
export function iterateAllShopIds(): IterableIterator<{ id: number; last_seen_at: string | null }> {
  return db.prepare(`SELECT id, last_seen_at FROM shops WHERE is_active = 1 ${SHOP_QUALITY_FILTER} ORDER BY id`).iterate() as IterableIterator<{ id: number; last_seen_at: string | null }>;
}

export function iterateGirlIdsPaginated(offset: number, limit: number): IterableIterator<{ id: number; last_seen_at: string | null }> {
  return db.prepare(`SELECT id, last_seen_at FROM girls WHERE is_active = 1 ${GIRL_QUALITY_FILTER} ORDER BY id LIMIT ? OFFSET ?`).iterate(limit, offset) as IterableIterator<{ id: number; last_seen_at: string | null }>;
}

// 動的に girl 数を返す (sitemap shard 計算用) — 質フィルタ込み
export function getActiveGirlCountForSitemap(): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM girls WHERE is_active=1 ${GIRL_QUALITY_FILTER}`).get() as { c: number }).c;
}

// sitemap index の lastmod 用: 全体の最新 last_seen_at。
// today 固定だと Google が全 shard を毎日再クロールしてバジェット浪費 (CLAUDE.md: lastmod は last_seen_at ベース)。
export function getGlobalMaxLastSeen(): string | null {
  const r = db.prepare(`SELECT MAX(last_seen_at) AS m FROM shops WHERE is_active = 1`).get() as { m: string | null };
  return r?.m ?? null;
}

// 画像 sitemap 用: 50k 行を iterator で逐次返す
export function iterateShopsWithImages(limit: number): IterableIterator<{ id: number; name: string; last_seen_at: string | null; img_url: string }> {
  return db.prepare(`
    SELECT s.id, s.name, s.last_seen_at,
      (SELECT g.image_url FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND g.image_url IS NOT NULL AND g.image_url != '' LIMIT 1) AS img_url
    FROM shops s
    WHERE s.is_active=1 AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1 AND g.image_url IS NOT NULL AND g.image_url != '')
    LIMIT ?
  `).iterate(limit) as IterableIterator<{ id: number; name: string; last_seen_at: string | null; img_url: string }>;
}

// Returns MAX(shops.last_seen_at) per area for sitemap lastmod
export function getAreaLastModMap(): Map<number, string | null> {
  const rows = db.prepare(`
    SELECT area_id, MAX(last_seen_at) AS m FROM shops WHERE is_active = 1 GROUP BY area_id
  `).all() as { area_id: number; m: string | null }[];
  const map = new Map<number, string | null>();
  for (const r of rows) map.set(r.area_id, r.m);
  return map;
}

// Returns MAX(shops.last_seen_at) per prefecture (via areas.prefecture) for sitemap lastmod
export function getPrefectureLastModMap(): Map<string, string | null> {
  const rows = db.prepare(`
    SELECT a.prefecture AS p, MAX(s.last_seen_at) AS m
    FROM shops s JOIN areas a ON s.area_id = a.id
    WHERE s.is_active = 1
    GROUP BY a.prefecture
  `).all() as { p: string; m: string | null }[];
  const map = new Map<string, string | null>();
  for (const r of rows) map.set(r.p, r.m);
  return map;
}

export function getActiveGirlCount(): number {
  return (db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get() as { c: number }).c;
}

export function getPrefectureSlugs(): string[] {
  return Object.keys(PREFECTURE_MAP);
}

// Ranking queries

// Top girls by real_pct (panel match rate) - requires minimum reviews
// 画像あり優先 (UX: ranking ページの見栄え向上)
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
    ORDER BY (g.image_url IS NOT NULL AND g.image_url != '') DESC, real_pct DESC, rs.review_count DESC
    LIMIT ?
  `).all(...params) as Girl[];
}

// Worst girls by real_pct (panel fraud rate) - requires minimum reviews
// 画像あり優先 (UX: ranking ページの見栄え向上)
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
    ORDER BY (g.image_url IS NOT NULL AND g.image_url != '') DESC, real_pct ASC, rs.review_count DESC
    LIMIT ?
  `).all(...params) as Girl[];
}

// Top shops by real_pct - requires minimum reviews
export function getTopRealShops(prefectureSlug: string, limit: number = 20): Shop[] {
  return qmemo(`topReal:${prefectureSlug}:${limit}`, Q_TTL, () => db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.is_active = 1 AND a.prefecture = ? AND COALESCE(rc.review_count, 0) >= 5
    ORDER BY real_pct DESC, rc.review_count DESC
    LIMIT ?
  `).all(prefectureSlug, limit) as Shop[]);
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
// 2026-05-13: 画像あり優先 — girl 詳細ページの 「近隣 popular 嬢」widget で placeholder 撲滅
export function getPopularGirlsInArea(areaId: number, excludeGirlId: number, limit: number = 4): Girl[] {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS_SUB}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    WHERE s.area_id = ? AND g.id != ? AND g.is_active = 1 AND ${GIRL_REVIEW_COUNT} > 0
      AND g.image_url IS NOT NULL AND g.image_url <> ''
    ORDER BY ${GIRL_REVIEW_COUNT} DESC, real_pct DESC
    LIMIT ?
  `).all(areaId, excludeGirlId, limit) as Girl[];
}

// Get other girls in same shop for girl detail page (more results, review-few-first)
// 2026-05-13: 画像必須 (公開画像配置率 100% 担保 / placeholder 撲滅)
export function getOtherGirlsInShopExpanded(shopId: number, excludeGirlId: number, limit: number = 6): Girl[] {
  return db.prepare(`
    SELECT g.*, s.name as shop_name, ${GIRL_STATS_COLS_SUB}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    WHERE g.shop_id = ? AND g.id != ? AND g.is_active = 1
      AND g.image_url IS NOT NULL AND g.image_url <> ''
    ORDER BY ${GIRL_REVIEW_COUNT} ASC, g.name
    LIMIT ?
  `).all(shopId, excludeGirlId, limit) as Girl[];
}

// Get area_id for a shop
export function getShopAreaId(shopId: number): number | undefined {
  const row = db.prepare('SELECT area_id FROM shops WHERE id = ?').get(shopId) as { area_id: number } | undefined;
  return row?.area_id;
}

// Recently reviewed girls (for top page)
// 画像あり girl のみ表示 (UX: TOP ページの最近の口コミ枠の見栄え向上 / placeholder 撲滅)
export function getRecentlyReviewedGirls(limit = 8, prefectureSlug?: string) {
  const prefClause = prefectureSlug ? 'AND a.prefecture = ?' : '';
  const args: (string | number)[] = prefectureSlug ? [prefectureSlug, limit] : [limit];
  return db.prepare(`
    SELECT
      g.id, g.name, g.image_url,
      s.name as shop_name,
      a.name as area_name,
      r.panel_rating,
      r.created_at as review_date,
      ${GIRL_STATS_COLS}
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    ${GIRL_STATS_JOIN}
    WHERE g.is_active = 1 AND s.is_active = 1
      AND g.image_url IS NOT NULL AND g.image_url != ''
      ${prefClause}
    GROUP BY g.id
    ORDER BY MAX(r.created_at) DESC
    LIMIT ?
  `).all(...args) as (Girl & { shop_name: string; area_name: string; panel_rating: string; review_date: string })[];
}

// Popular girls in area for area page (no exclusion)
// 2026-05-12: TOP5 → TOP10 + ソート変更:
//   「評価が高い且つ口コミが多い」 を満たすよう 複合スコア (review_count × real_pct) で 並び替え
//   画像有無は ソートから外す (画像なしでも 評価高い嬢は 上位に出す)
export function getPopularGirlsInAreaTop(areaId: number, limit: number = 10): Girl[] {
  // 2026-05-13: 画像あり優先 — TOP10 popular girls カルーセルで placeholder が 出ないよう
  //   image_url IS NOT NULL を 条件に。 視覚的に 100% 画像配置で 表示できる。
  return db.prepare(`
    SELECT g.*, s.name as shop_name, a.name as area_name, a.slug as area_slug, ${GIRL_STATS_COLS_SUB}
    FROM girls g
    JOIN shops s ON g.shop_id = s.id
    JOIN areas a ON s.area_id = a.id
    WHERE s.area_id = ? AND g.is_active = 1 AND ${GIRL_REVIEW_COUNT} >= 1
      AND g.image_url IS NOT NULL AND g.image_url <> ''
    ORDER BY
      -- 複合スコア (高評価×多口コミ) → 同点は 口コミ多い順 → 次に 評価高い順
      (${GIRL_REVIEW_COUNT} * COALESCE(real_pct, 0)) DESC,
      ${GIRL_REVIEW_COUNT} DESC,
      real_pct DESC
    LIMIT ?
  `).all(areaId, limit) as Girl[];
}

// Nearby shops in same area (same category first, then others)
export function getNearbyShops(areaId: number, shopId: number, category: string, limit = 5): Shop[] {
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS_SUB},
      CASE WHEN s.category = ? THEN 0 ELSE 1 END as cat_order
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    WHERE s.area_id = ? AND s.id != ? AND s.is_active = 1 AND ${SHOP_GIRL_COUNT} >= 1
    ORDER BY cat_order ASC, ${SHOP_REVIEW_COUNT} DESC, ${SHOP_GIRL_COUNT} DESC
    LIMIT ?
  `).all(category, areaId, shopId, limit) as Shop[];
}

// Recently added shops (for home page). Optionally scope to a prefecture.
export function getRecentlyAddedShops(limit = 6, prefectureSlug?: string): Shop[] {
  if (prefectureSlug) {
    return qmemo(`recentAdded:${prefectureSlug}:${limit}`, Q_TTL, () => db.prepare(`
      SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
      FROM shops s
      JOIN areas a ON s.area_id = a.id
      ${SHOP_STATS_JOIN}
      WHERE s.is_active = 1 AND a.prefecture = ? AND COALESCE(gc.girl_count, 0) >= 1
      ORDER BY s.created_at DESC
      LIMIT ?
    `).all(prefectureSlug, limit) as Shop[]);
  }
  return qmemo(`recentAdded::${limit}`, Q_TTL, () => db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    WHERE s.is_active = 1 AND COALESCE(gc.girl_count, 0) >= 1
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(limit) as Shop[]);
}

// Top shops by real_pct for any prefecture or nationwide
export function getTopShopsForPrefecture(prefectureSlug: string | null, limit = 5): Shop[] {
  if (!prefectureSlug) {
    // Nationwide
    return db.prepare(`
      SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS}
      FROM shops s
      JOIN areas a ON s.area_id = a.id
      ${SHOP_STATS_JOIN}
      WHERE s.is_active = 1 AND COALESCE(rc.review_count, 0) >= 5
      ORDER BY real_pct DESC, rc.review_count DESC
      LIMIT ?
    `).all(limit) as Shop[];
  }
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

// ext-bakusai 由来の掲示板コメント件数 (店舗ページの「掲示板の声」用)
export function getBakusaiCommentCount(shopId: number): number {
  return (db.prepare("SELECT COUNT(*) as c FROM shop_comments WHERE shop_id = ? AND browser_id LIKE 'ext-bakusai%'").get(shopId) as { c: number }).c;
}

// 構造化データ(schema.org)専用の集計: 会員生口コミのみ(インポート系 browser_id を除外)。
// 外部転載(ext-*/ch-*/x-import-*)を AggregateRating/Review として出すと Google レビュースパムポリシー
// 違反リスク(リッチリザルト剥奪・手動対策)があるため、JSON-LD は genuine 会員口コミだけで生成する。
// 画面表示用の real_pct(SHOP_STATS_JOIN・全件集計)とは別物。
export function getShopGenuineReviewStats(shopId: number): { reviewCount: number; realPct: number } {
  const row = db.prepare(`
    SELECT COUNT(*) as c,
      SUM(CASE WHEN r.panel_rating = 'panel_match' THEN 1 ELSE 0 END) as m,
      SUM(CASE WHEN r.panel_rating = 'panel_diff' THEN 1 ELSE 0 END) as d
    FROM reviews r
    JOIN girls g ON r.girl_id = g.id
    WHERE g.shop_id = ?
      AND (r.browser_id IS NULL
           OR (r.browser_id NOT LIKE 'ext-%' AND r.browser_id NOT LIKE 'ch-%' AND r.browser_id NOT LIKE 'x-import-%'))
  `).get(shopId) as { c: number; m: number; d: number };
  const c = row.c || 0;
  return { reviewCount: c, realPct: c === 0 ? -1 : Math.round((row.m * 100 + row.d * 50) / c) };
}

// エリア/県内で「掲示板の声(ext-bakusai)」が多い店。パネマジ言及が多い順 → SEO/回遊用。
// opts.areaId か opts.prefectureSlug のどちらかを指定。
export function getShopsByBakusaiComments(opts: { areaId?: number; prefectureSlug?: string }, limit: number = 8): (Shop & { bakusai_count: number })[] {
  const where = opts.areaId != null ? 's.area_id = ?' : 'a.prefecture = ?';
  const arg: number | string = opts.areaId != null ? opts.areaId : (opts.prefectureSlug as string);
  return db.prepare(`
    SELECT s.*, a.name as area_name, a.slug as area_slug, ${SHOP_STATS_COLS},
      bc.bakusai_count
    FROM shops s
    JOIN areas a ON s.area_id = a.id
    ${SHOP_STATS_JOIN}
    JOIN (
      SELECT shop_id, COUNT(*) as bakusai_count
      FROM shop_comments WHERE browser_id LIKE 'ext-bakusai%'
      GROUP BY shop_id
    ) bc ON bc.shop_id = s.id
    WHERE ${where} AND s.is_active = 1
    ORDER BY bc.bakusai_count DESC, real_pct DESC
    LIMIT ?
  `).all(arg, limit) as (Shop & { bakusai_count: number })[];
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
