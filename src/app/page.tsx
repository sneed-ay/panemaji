import { getAllAreas, getStats, getLatestReviews } from '@/lib/queries';
import PanelRatingBadge from '@/components/PanelRatingBadge';

export const dynamic = 'force-dynamic';

export default function Home() {
  const areas = getAllAreas();
  const stats = getStats();
  const latestReviews = getLatestReviews(10);

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.shopCount}</p>
          <p className="text-gray-500 text-sm mt-1">店舗</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.girlCount}</p>
          <p className="text-gray-500 text-sm mt-1">女性</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.reviewCount}</p>
          <p className="text-gray-500 text-sm mt-1">口コミ</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <form action="/search" method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="店舗名で検索..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            検索
          </button>
        </form>
      </div>

      {/* Areas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          エリアから探す（東京）
        </h2>
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
      </div>

      {/* Latest Reviews */}
      {latestReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            最新の口コミ
          </h2>
          <div className="space-y-3">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <PanelRatingBadge rating={review.panel_rating} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <a href={`/girl/${review.girl_id}`} className="font-medium">
                      {review.girl_name}
                    </a>
                    <span className="text-gray-400 mx-1">@</span>
                    <span className="text-gray-500">{review.shop_name}</span>
                  </p>
                  {review.comment && (
                    <p className="text-gray-600 text-sm mt-1 truncate">
                      {review.comment}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
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
