import { getAreasByPrefecture, getLatestReviews, getPrefectures, getRegionOrder, getTopRealShops } from '@/lib/queries';
import type { Prefecture } from '@/lib/queries';
import type { Shop } from '@/lib/db';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import PrefectureSelector from '@/components/PrefectureSelector';
import CategoryTabs from '@/components/CategoryTabs';
import GirlImage from '@/components/GirlImage';


type Props = {
  prefSlug: string;
  catSlug?: string;
};

function CompactShopRankingCard({ shop, rank }: { shop: Shop; rank: number }) {
  const realPct = shop.real_pct ?? 0;
  const rankColors = rank === 0 ? 'bg-yellow-500' : rank === 1 ? 'bg-gray-400' : rank === 2 ? 'bg-orange-400' : 'bg-blue-400';
  return (
    <a
      href={`/shop/${shop.id}`}
      className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
    >
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${rankColors}`}>
        {rank + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{shop.name}</p>
        <p className="text-xs text-gray-500 truncate">{shop.area_name} · {shop.girl_count ?? 0}人在籍 · {shop.review_count ?? 0}件口コミ</p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-sm font-bold ${realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          {realPct}%
        </span>
      </div>
    </a>
  );
}

export default function HomeContent({ prefSlug, catSlug }: Props) {
  const prefectures = getPrefectures();
  const regionOrder = getRegionOrder();
  const areas = getAreasByPrefecture(prefSlug, catSlug);
  const latestReviews = getLatestReviews(5);
  const topShops = getTopRealShops(prefSlug, 5);

  // Group prefectures by region
  const prefsByRegion: Record<string, Prefecture[]> = {};
  for (const region of regionOrder) {
    prefsByRegion[region] = prefectures.filter(p => p.region === region);
  }

  return (
    <div className="space-y-5">
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

      {/* 4. Panel Match TOP5 - compact list */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold text-gray-800">
            パネル通り率 TOP5
          </h2>
          <a
            href={`/ranking?pref=${prefSlug}${catSlug ? `&cat=${catSlug}` : ''}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            もっと見る
          </a>
        </div>
        {topShops.length > 0 ? (
          <div className="space-y-2">
            {topShops.map((shop, i) => (
              <CompactShopRankingCard key={shop.id} shop={shop} rank={i} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">口コミが増えたら表示されます</p>
        )}
      </div>

      {/* 5. Latest Reviews - with images, max 5 */}
      {latestReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            最新の口コミ
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
