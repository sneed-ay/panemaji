import { getAreasByPrefecture, getStatsByPrefecture, getLatestReviews, getPrefectures, getRegionOrder, prefectureSlugToName, getShopsSeekingReviews } from '@/lib/queries';
import type { Prefecture } from '@/lib/queries';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import PrefectureSelector from '@/components/PrefectureSelector';


type Props = {
  prefSlug: string;
};

export default function HomeContent({ prefSlug }: Props) {
  const prefName = prefectureSlugToName(prefSlug);
  const prefectures = getPrefectures();
  const regionOrder = getRegionOrder();
  const areas = getAreasByPrefecture(prefSlug);
  const stats = getStatsByPrefecture(prefSlug);
  const latestReviews = getLatestReviews(10);
  const shopsSeekingReviews = getShopsSeekingReviews(prefSlug, 8);

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
          href={`/ranking?pref=${prefSlug}`}
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

      {/* Shops Seeking Reviews */}
      {shopsSeekingReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            &#x1F4DD; 口コミ募集中の人気店舗
          </h2>
          <p className="text-xs text-gray-400 mb-4">在籍数が多いのに口コミが少ない店舗です。あなたの口コミを待っています！</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shopsSeekingReviews.map((shop) => (
              <a
                key={shop.id}
                href={`/shop/${shop.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors no-underline"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{shop.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{shop.area_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">在籍 <span className="text-blue-600 font-bold">{shop.girl_count}</span>人</p>
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                    口コミ{shop.review_count || 0}件
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Popular Search Keywords */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          人気の検索ワード
        </h2>
        <div className="flex flex-wrap gap-2">
          {getPopularKeywords(prefName).map((kw) => (
            <a
              key={kw}
              href={`/search?q=${encodeURIComponent(kw)}`}
              className="inline-block px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 transition-colors no-underline"
            >
              {kw}
            </a>
          ))}
        </div>
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

function getPopularKeywords(prefName: string): string[] {
  const baseKeywords = [
    `${prefName} パネマジ`,
    `${prefName} 風俗 口コミ`,
    `${prefName} パネル通り`,
  ];
  const areaKeywords: Record<string, string[]> = {
    '東京': ['新宿 パネマジ', '池袋 風俗 口コミ', '五反田 パネル通り', '渋谷 風俗', '錦糸町 パネマジ', '新橋 口コミ'],
    '神奈川': ['横浜 パネマジ', '川崎 風俗 口コミ', '関内 パネル通り'],
    '大阪': ['梅田 パネマジ', '難波 風俗 口コミ', '日本橋 パネル通り'],
    '愛知': ['名古屋 パネマジ', '栄 風俗 口コミ', '名駅 パネル通り'],
    '福岡': ['博多 パネマジ', '中洲 風俗 口コミ', '天神 パネル通り'],
    '北海道': ['札幌 パネマジ', 'すすきの 風俗 口コミ'],
    '宮城': ['仙台 パネマジ', '仙台 風俗 口コミ'],
    '埼玉': ['大宮 パネマジ', '大宮 風俗 口コミ'],
    '千葉': ['千葉 パネマジ', '船橋 風俗 口コミ'],
    '京都': ['京都 パネマジ', '祇園 風俗 口コミ'],
    '兵庫': ['神戸 パネマジ', '三宮 風俗 口コミ'],
    '広島': ['広島 パネマジ', '広島 風俗 口コミ'],
  };
  const extra = areaKeywords[prefName] || [];
  return [...baseKeywords, ...extra];
}
