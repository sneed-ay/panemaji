import { getAreasByPrefecture, getStatsByPrefecture, getLatestReviews, getPrefectures, getRegionOrder, prefectureSlugToName } from '@/lib/queries';
import type { Prefecture } from '@/lib/queries';
import PanelRatingBadge from '@/components/PanelRatingBadge';

export const dynamic = 'force-dynamic';

export default function Home({ searchParams }: { searchParams: { pref?: string } }) {
  const prefSlug = searchParams.pref || 'tokyo';
  const prefName = prefectureSlugToName(prefSlug);
  const prefectures = getPrefectures();
  const regionOrder = getRegionOrder();
  const areas = getAreasByPrefecture(prefSlug);
  const stats = getStatsByPrefecture(prefSlug);
  const latestReviews = getLatestReviews(10);

  // Group prefectures by region
  const prefsByRegion: Record<string, Prefecture[]> = {};
  for (const region of regionOrder) {
    prefsByRegion[region] = prefectures.filter(p => p.region === region);
  }

  return (
    <div className="space-y-8">
      {/* Prefecture Tabs grouped by region */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="space-y-3">
          {regionOrder.map((region) => (
            <div key={region}>
              <h3 className="text-xs sm:text-sm font-bold text-gray-500 mb-1.5 pl-1">{region}</h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {prefsByRegion[region].map((pref) => {
                  const isActive = pref.slug === prefSlug;
                  return (
                    <a
                      key={pref.slug}
                      href={`/?pref=${pref.slug}`}
                      className={`
                        inline-block px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors no-underline
                        ${isActive
                          ? 'bg-gradient-to-r from-pink-600 to-purple-700 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                        }
                      `}
                    >
                      {pref.name}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-6 text-center">
          <p className="text-xl sm:text-3xl font-bold text-blue-600">{stats.shopCount}</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">店舗</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-6 text-center">
          <p className="text-xl sm:text-3xl font-bold text-blue-600">{stats.girlCount}</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">女性</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <form action="/search" method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="店舗名で検索..."
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

      {/* Areas */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          {prefName}デリヘル パネマジチェック - エリアから探す
        </h2>
        {areas.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {areas.map((area) => (
              <a
                key={area.id}
                href={`/area/${area.slug}`}
                className="block bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 text-center transition-colors no-underline"
              >
                <span className="text-gray-800 font-medium text-sm">{area.name}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">この都道府県にはまだエリアが登録されていません。</p>
        )}
      </div>

      {/* Latest Reviews */}
      {latestReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            最新の口コミ
          </h2>
          <div className="space-y-3">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg"
              >
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
    </div>
  );
}
