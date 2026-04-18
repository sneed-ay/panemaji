import { getAreasByPrefecture, getLatestReviews, getPrefectures, getRegionOrder, getTopRealShops, getRecentlyAddedShops, prefectureSlugToName, CATEGORY_COLORS } from '@/lib/queries';
import type { Prefecture } from '@/lib/queries';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import PrefectureSelector from '@/components/PrefectureSelector';
import CategoryTabs from '@/components/CategoryTabs';
import GirlImage from '@/components/GirlImage';
import PrefectureTop5 from '@/components/PrefectureTop5';


type Props = {
  prefSlug: string;
  catSlug?: string;
};

export default function HomeContent({ prefSlug, catSlug }: Props) {
  const prefectures = getPrefectures();
  const regionOrder = getRegionOrder();
  const areas = getAreasByPrefecture(prefSlug, catSlug);
  const latestReviews = getLatestReviews(5, prefSlug);
  const topShops = getTopRealShops(prefSlug, 5);
  const recentShops = getRecentlyAddedShops(6, prefSlug);
  const currentPrefName = prefectureSlugToName(prefSlug);

  // Group prefectures by region
  const prefsByRegion: Record<string, Prefecture[]> = {};
  for (const region of regionOrder) {
    prefsByRegion[region] = prefectures.filter(p => p.region === region);
  }

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{currentPrefName}の風俗 口コミ掲示板・パネマジ度チェック | パネル写真と実物の一致度</h1>
      {/* 1. Search Bar - prominent at top */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <form action="/search" method="GET" className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              name="q"
              placeholder="店舗名・女の子の名前で検索..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shrink-0"
          >
            検索
          </button>
        </form>
      </div>

      {/* 2. Category Tabs */}
      <CategoryTabs
        currentCat={catSlug || ''}
        basePath={`/${prefSlug}`}
      />

      {/* Prefecture Selector */}
      <PrefectureSelector
        prefSlug={prefSlug}
        prefsByRegion={prefsByRegion}
        regionOrder={regionOrder}
      />

      {/* 3. Area Grid - compact */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-5">
        <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
          エリアから探す
        </h2>
        {areas.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {areas.map((area) => (
              <a
                key={area.id}
                href={`/area/${area.slug}${catSlug ? `?cat=${catSlug}` : ''}`}
                className="block bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-2 text-center transition-colors no-underline"
              >
                <span className="text-gray-800 font-medium text-xs sm:text-sm">{area.name}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">この都道府県にはまだエリアが登録されていません。</p>
        )}
      </div>

      {/* 4. Panel Match TOP5 - prefecture switchable */}
      <PrefectureTop5
        initialShops={topShops.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          area_name: s.area_name || '',
          girl_count: s.girl_count ?? 0,
          review_count: s.review_count ?? 0,
          real_pct: s.real_pct ?? -1,
        }))}
        initialPrefecture={currentPrefName}
      />

      {/* 5. Latest Reviews - with images, max 5 */}
      {latestReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            {currentPrefName}の最新の口コミ
          </h2>
          <div className="space-y-2">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-2 sm:gap-3 p-2 bg-gray-50 rounded-lg"
              >
                <a href={`/girl/${review.girl_id}`} className="shrink-0">
                  <GirlImage src={review.girl_image_url ?? null} alt={review.girl_name || ''} size={40} />
                </a>
                <PanelRatingBadge rating={review.panel_rating} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm break-words">
                    <a href={`/girl/${review.girl_id}`} className="font-medium">
                      {review.girl_name}
                    </a>
                    <span className="text-gray-400 mx-1">@</span>
                    <span className="text-gray-500 break-all">{review.shop_name}</span>
                  </p>
                  {review.comment && (
                    <p className="text-gray-600 text-xs mt-0.5 break-words line-clamp-2">
                      {review.comment}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                  {review.created_at?.substring(0, 10) || review.created_at}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Recently Added Shops */}
      {recentShops.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            {currentPrefName}の新着店舗
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentShops.map((shop) => (
              <a
                key={shop.id}
                href={`/shop/${shop.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{shop.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[shop.category] || 'bg-gray-100 text-gray-700'}`}>
                      {shop.category}
                    </span>
                    <span className="text-xs text-gray-500">{shop.area_name}</span>
                    <span className="text-xs text-gray-400">{shop.girl_count ?? 0}人在籍</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
