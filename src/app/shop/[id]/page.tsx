import { getShopById, getGirlsByShop, getReviewsByShop, getNearbyShops, CATEGORY_COLORS } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import RealScore from '@/components/RealScore';
import GirlSortFilter from '@/components/GirlSortFilter';
import AdBanner from '@/components/AdBanner';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shop = getShopById(parseInt(params.id));
  if (!shop) return {};
  const reviewCount = shop.review_count || 0;
  const girlCount = shop.girl_count || 0;
  const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
  const title = `${shop.name}の口コミ掲示板・パネマジ度【${shop.area_name || '東京'}】`;
  const description = `${shop.name}(${shop.area_name || '東京'})の口コミ掲示板。在籍嬢のパネル写真と実物の一致度をチェック。${realPct !== null ? `パネル通り率${realPct}%。` : ''}在籍${girlCount}人${reviewCount > 0 ? `・口コミ${reviewCount}件` : ''}。${shop.name}の最新レビューと評判。`;
  const ogParams = new URLSearchParams({
    name: shop.name,
    shop: shop.area_name || '',
    ...(realPct !== null ? { score: String(realPct) } : {}),
    category: shop.category || '',
  });
  const ogImage = `https://panemaji.com/api/og?${ogParams.toString()}`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://panemaji.com/shop/${params.id}`,
    },
    openGraph: {
      title,
      description,
      url: `https://panemaji.com/shop/${params.id}`,
      siteName: 'パネマジ掲示板',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function ShopPage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const shopId = parseInt(params.id);
  if (isNaN(shopId)) notFound();

  const shop = getShopById(shopId);
  if (!shop) notFound();

  const query = searchParams.q || '';
  const girls = getGirlsByShop(shopId, query || undefined);
  const latestReviews = getReviewsByShop(shopId, 5);
  const nearbyShops = getNearbyShops(shop.area_id, shopId, shop.category, 5);

  const matchCount = shop.panel_match_count || 0;
  const diffCount = shop.panel_diff_count || 0;
  const jiraiCount = shop.jirai_count || 0;
  const totalReviews = shop.review_count || 0;

  // Serialize girls for client component
  const girlsData = girls.map((g) => ({
    id: g.id,
    name: g.name,
    age: g.age,
    height: g.height,
    bust: g.bust,
    waist: g.waist,
    hip: g.hip,
    cup: g.cup,
    image_url: g.image_url,
    review_count: g.review_count || 0,
    panel_match_count: g.panel_match_count || 0,
    panel_diff_count: g.panel_diff_count || 0,
    jirai_count: g.jirai_count || 0,
    real_pct: g.real_pct ?? -1,
  }));

  // JSON-LD LocalBusiness structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    url: `https://panemaji.com/shop/${shop.id}`,
    description: shop.description || `${shop.area_name}エリアの風俗店「${shop.name}」`,
    ...(shop.area_name ? { areaServed: shop.area_name } : {}),
    ...(typeof shop.review_count === 'number' && shop.review_count > 0 && typeof shop.real_pct === 'number' && shop.real_pct >= 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.round(shop.real_pct / 20 * 10) / 10,
        bestRating: 5,
        worstRating: 1,
        reviewCount: shop.review_count,
      },
    } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: 'https://panemaji.com' },
      { '@type': 'ListItem', position: 2, name: shop.area_name || 'エリア', item: `https://panemaji.com/area/${shop.area_slug}` },
      { '@type': 'ListItem', position: 3, name: shop.name, item: `https://panemaji.com/shop/${shop.id}` },
    ],
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="text-xs sm:text-sm text-gray-500 break-words">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/area/${shop.area_slug}`} className="hover:text-blue-600">{shop.area_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800 break-words">{shop.name}</span>
      </nav>

      {/* Shop Header - Enhanced */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{shop.name}<span className="sr-only">の口コミ掲示板・パネマジ度</span></h1>
            <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
              <span className={`inline-block text-xs px-2 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[shop.category] || 'bg-gray-100 text-gray-700'}`}>
                {shop.category}
              </span>
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {shop.area_name}
              </span>
            </div>
            {shop.description && (
              <p className="text-gray-600 mt-2 text-sm break-words">{shop.description}</p>
            )}
            {/* External Link */}
            {shop.source_url && (
              <a
                href={shop.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition-colors no-underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                シティヘブンで見る
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <RealScore pct={shop.real_pct ?? -1} reviewCount={shop.review_count || 0} size="lg" />
            <div className="text-right">
              <p className="text-xs sm:text-sm text-gray-500">
                在籍 <span className="text-2xl sm:text-3xl text-blue-600 font-bold">{shop.girl_count}</span> 人
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                口コミ <span className="text-lg sm:text-xl text-blue-600 font-bold">{shop.review_count}</span> 件
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Rating Distribution */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">パネマジ度分布</h3>
        {totalReviews === 0 ? (
          <p className="text-gray-400 text-sm">まだ口コミがありません</p>
        ) : (
          <div className="space-y-3">
            <DistributionRow label="パネル通り" count={matchCount} total={totalReviews} color="bg-green-500" />
            <DistributionRow label="許せる" count={diffCount} total={totalReviews} color="bg-yellow-400" />
            <DistributionRow label="盛りすぎ" count={jiraiCount} total={totalReviews} color="bg-red-500" />
            <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
              全{totalReviews}件の口コミ → 総合パネマジ度 <span className="font-bold text-blue-600">{shop.real_pct != null && shop.real_pct >= 0 ? `${shop.real_pct}%` : '-'}</span>
            </p>
          </div>
        )}
      </div>

      {/* Latest Reviews */}
      {latestReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">最新の口コミ</h3>
          <div className="space-y-3">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg"
              >
                <PanelRatingBadge rating={review.panel_rating} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm break-words">
                    <a href={`/girl/${review.girl_id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {review.girl_name}
                    </a>
                  </p>
                  {review.comment && (
                    <p className="text-gray-600 text-xs sm:text-sm mt-1 break-words line-clamp-2">
                      {review.comment}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {review.created_at?.substring(0, 10) || review.created_at}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Girl Search */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <form action={`/shop/${shopId}`} method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="女の子の名前で検索..."
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base shrink-0"
          >
            検索
          </button>
        </form>
      </div>

      <AdBanner size="rectangle" context={{ area: shop.area_name || undefined, category: shop.category || undefined }} />

      {/* Girls List with Sort/Filter */}
      <GirlSortFilter girls={girlsData} query={query} />

      {/* Nearby Shops */}
      {nearbyShops.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            近くの店舗
          </h3>
          <div className="space-y-2">
            {nearbyShops.map((ns) => {
              const nsPct = ns.real_pct ?? -1;
              return (
                <a
                  key={ns.id}
                  href={`/shop/${ns.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{ns.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[ns.category] || 'bg-gray-100 text-gray-700'}`}>
                        {ns.category}
                      </span>
                      <span className="text-xs text-gray-500">{ns.girl_count ?? 0}人在籍</span>
                      <span className="text-xs text-gray-400">{ns.review_count ?? 0}件口コミ</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {nsPct >= 0 ? (
                      <span className={`text-sm font-bold ${nsPct >= 70 ? 'text-green-600' : nsPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {nsPct}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">---</span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <RelatedGuides areaSlug={shop.area_slug} />
    </div>
  );
}

function DistributionRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
        {pct > 0 && (
          <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className="text-sm text-gray-600 w-20 shrink-0 text-right">{count}件 ({pct}%)</span>
    </div>
  );
}
