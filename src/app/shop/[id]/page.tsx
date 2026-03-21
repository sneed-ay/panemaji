import { getShopById, getGirlsByShop, getReviewsByShop } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBar from '@/components/PanelRatingBar';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import RealScore from '@/components/RealScore';
import GirlImage from '@/components/GirlImage';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shop = getShopById(parseInt(params.id));
  if (!shop) return {};
  const reviewCount = shop.review_count || 0;
  const girlCount = shop.girl_count || 0;
  const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
  const title = `${shop.name}のパネマジ度・口コミ一覧 | ${shop.area_name || '東京'}`;
  const description = `${shop.name}の在籍嬢のパネマジ度を口コミでチェック。${realPct !== null ? `パネル通り率${realPct}%。` : ''}在籍${girlCount}人。${reviewCount > 0 ? `口コミ${reviewCount}件。` : ''}${shop.area_name || '東京'}のデリヘル口コミ。`;
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
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
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

  const matchCount = shop.panel_match_count || 0;
  const diffCount = shop.panel_diff_count || 0;
  const jiraiCount = shop.jirai_count || 0;
  const totalReviews = shop.review_count || 0;

  // JSON-LD LocalBusiness structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    url: `https://panemaji.com/shop/${shop.id}`,
    description: shop.description || `${shop.area_name}エリアのデリヘル「${shop.name}」`,
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

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="text-xs sm:text-sm text-gray-500 break-words">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/area/${shop.area_slug}`} className="hover:text-blue-600">{shop.area_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800 break-words">{shop.name}</span>
      </nav>

      {/* Shop Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{shop.name}</h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-2">
              <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded shrink-0">
                {shop.category}
              </span>
              <span className="text-gray-500 text-xs sm:text-sm">{shop.area_name}</span>
            </div>
            {shop.description && (
              <p className="text-gray-600 mt-2 text-sm break-words">{shop.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <RealScore pct={shop.real_pct ?? -1} reviewCount={shop.review_count || 0} size="lg" />
            <div className="text-right">
              <p className="text-xs sm:text-sm text-gray-500">
                在籍 <span className="text-lg sm:text-xl text-blue-600 font-bold">{shop.girl_count}</span> 人
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
            <DistributionRow label="パネル詐欺" count={jiraiCount} total={totalReviews} color="bg-red-500" />
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
                  {review.created_at?.split(' ')[0] || review.created_at}
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

      {/* Girls List */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-xl font-bold text-gray-800 min-w-0">
          在籍一覧
          {query && <span className="text-sm sm:text-base text-gray-500 ml-2 break-words">「{query}」の検索結果</span>}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 shrink-0">{girls.length}人 / リアル度順</p>
      </div>

      {girls.length === 0 ? (
        <p className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          {query ? '該当する女性が見つかりませんでした' : '女性データはまだありません'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {girls.map((girl) => (
            <a
              key={girl.id}
              href={`/girl/${girl.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden no-underline"
            >
              <div className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <GirlImage src={girl.image_url} alt={girl.name} size={80} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-base sm:text-lg font-bold text-gray-800 break-words">{girl.name}</h4>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                          {girl.age}歳
                          {girl.height && ` T${girl.height}`}
                          {girl.bust && girl.cup && ` B${girl.bust}(${girl.cup})`}
                          {girl.waist && ` W${girl.waist}`}
                          {girl.hip && ` H${girl.hip}`}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <RealScore pct={girl.real_pct ?? -1} reviewCount={girl.review_count || 0} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-400">口コミ {girl.review_count || 0}件</span>
                      {(girl.review_count || 0) === 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">口コミ募集中</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <PanelRatingBar
                        matchCount={girl.panel_match_count || 0}
                        diffCount={girl.panel_diff_count || 0}
                        jiraiCount={girl.jirai_count || 0}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
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
