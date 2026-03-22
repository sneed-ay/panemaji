import { getAreasByPrefecture, getStatsByPrefecture, getLatestReviews, getPrefectures, getRegionOrder, prefectureSlugToName, getTopRealGirls, getWorstRealGirls } from '@/lib/queries';
import type { Prefecture } from '@/lib/queries';
import type { Girl } from '@/lib/db';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import PrefectureSelector from '@/components/PrefectureSelector';
import CategoryTabs from '@/components/CategoryTabs';
import GirlImage from '@/components/GirlImage';


type Props = {
  prefSlug: string;
  catSlug?: string;
};

const MEDAL_COLORS: Record<number, { bg: string; border: string; text: string; label: string }> = {
  0: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-600', label: '1' },
  1: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-500', label: '2' },
  2: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-600', label: '3' },
};

function RankingCard({ girl, rank }: { girl: Girl; rank: number }) {
  const medal = MEDAL_COLORS[rank];
  const realPct = girl.real_pct ?? 0;

  return (
    <a
      href={`/girl/${girl.id}`}
      className={`block rounded-lg border-2 ${medal ? medal.border : 'border-gray-200'} ${medal ? medal.bg : 'bg-white'} p-2 hover:shadow-md transition-shadow no-underline`}
    >
      <div className="relative">
        {/* Rank badge */}
        <div className={`absolute -top-1 -left-1 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${rank === 0 ? 'bg-yellow-500' : rank === 1 ? 'bg-gray-400' : rank === 2 ? 'bg-orange-400' : 'bg-blue-400'}`}>
          {rank + 1}
        </div>
        <GirlImage src={girl.image_url} alt={girl.name} size={120} className="w-full !rounded-md" />
      </div>
      <div className="mt-2 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{girl.name}</p>
        <p className="text-xs text-gray-500 truncate">{girl.shop_name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-sm font-bold ${realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
            {realPct}%
          </span>
          <span className="text-xs text-gray-400">{girl.review_count}件</span>
        </div>
      </div>
    </a>
  );
}

export default function HomeContent({ prefSlug, catSlug }: Props) {
  const prefName = prefectureSlugToName(prefSlug);
  const prefectures = getPrefectures();
  const regionOrder = getRegionOrder();
  const areas = getAreasByPrefecture(prefSlug, catSlug);
  const stats = getStatsByPrefecture(prefSlug, catSlug);
  const latestReviews = getLatestReviews(10);
  const topGirls = getTopRealGirls(prefSlug, 5, catSlug);
  const worstGirls = getWorstRealGirls(prefSlug, 5, catSlug);

  // Group prefectures by region
  const prefsByRegion: Record<string, Prefecture[]> = {};
  for (const region of regionOrder) {
    prefsByRegion[region] = prefectures.filter(p => p.region === region);
  }

  return (
    <div className="space-y-8">
      {/* Prefecture Tabs grouped by region */}
      <PrefectureSelector
        prefSlug={prefSlug}
        prefsByRegion={prefsByRegion}
        regionOrder={regionOrder}
      />

      {/* Category Tabs */}
      <CategoryTabs
        currentCat={catSlug || ''}
        basePath={`/${prefSlug}`}
      />

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

      {/* Quick Links */}
      <div className="flex gap-2 sm:gap-3">
        <a
          href={`/ranking?pref=${prefSlug}${catSlug ? `&cat=${catSlug}` : ''}`}
          className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg shadow p-3 sm:p-4 text-center no-underline hover:shadow-md transition-shadow"
        >
          <p className="text-lg sm:text-xl">&#x1F3C6;</p>
          <p className="text-xs sm:text-sm font-bold mt-1">ランキング</p>
        </a>
        <a
          href="/search"
          className="flex-1 bg-white rounded-lg shadow p-3 sm:p-4 text-center no-underline hover:shadow-md transition-shadow"
        >
          <p className="text-lg sm:text-xl">&#x1F50D;</p>
          <p className="text-xs sm:text-sm font-bold text-gray-700 mt-1">店舗検索</p>
        </a>
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

      {/* Panel Match Rate TOP 5 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          &#x1F3C6; パネル通り率 TOP5
        </h2>
        {topGirls.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {topGirls.map((girl, i) => (
                <RankingCard key={girl.id} girl={girl} rank={i} />
              ))}
            </div>
            <div className="mt-4 text-center">
              <a
                href={`/ranking?pref=${prefSlug}${catSlug ? `&cat=${catSlug}` : ''}`}
                className="inline-block text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ランキングをもっと見る &rarr;
              </a>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm">口コミが増えたら表示されます</p>
        )}
      </div>

      {/* Panel Fraud Rate TOP 5 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          &#x26A0;&#xFE0F; 注意！パネル詐欺率 TOP5
        </h2>
        {worstGirls.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {worstGirls.map((girl, i) => (
                <RankingCard key={girl.id} girl={girl} rank={i} />
              ))}
            </div>
            <div className="mt-4 text-center">
              <a
                href={`/ranking?pref=${prefSlug}&tab=worst${catSlug ? `&cat=${catSlug}` : ''}`}
                className="inline-block text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ランキングをもっと見る &rarr;
              </a>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm">口コミが増えたら表示されます</p>
        )}
      </div>

      {/* Areas */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          {prefName}風俗 パネマジチェック - エリアから探す
        </h2>
        {areas.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {areas.map((area) => (
              <a
                key={area.id}
                href={`/area/${area.slug}${catSlug ? `?cat=${catSlug}` : ''}`}
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
                <a href={`/girl/${review.girl_id}`} className="shrink-0">
                  <GirlImage src={review.girl_image_url ?? null} alt={review.girl_name || ''} size={48} />
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
