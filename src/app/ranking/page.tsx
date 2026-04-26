import { getTopRealGirls, getWorstRealGirls, getTopRealShops, getPrefectures, getRegionOrder, prefectureSlugToName, isValidPrefecture } from '@/lib/queries';
import type { Prefecture } from '@/lib/queries';
import RealScore from '@/components/RealScore';
import GirlImage from '@/components/GirlImage';
import type { Metadata } from 'next';

export const revalidate = 300;

export function generateMetadata({ searchParams }: { searchParams: { pref?: string } }): Metadata {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  const prefName = prefectureSlugToName(prefSlug);
  return {
    title: `${prefName}のパネマジランキング`,
    description: `${prefName}の風俗 パネル通り率ランキング・盛りすぎ率ランキング。口コミに基づくリアル度で女性・店舗をランキング。`,
  };
}

export default function RankingPage({ searchParams }: { searchParams: { pref?: string } }) {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  const prefName = prefectureSlugToName(prefSlug);
  const prefectures = getPrefectures();
  const regionOrder = getRegionOrder();

  const topGirls = getTopRealGirls(prefSlug, 20);
  const worstGirls = getWorstRealGirls(prefSlug, 20);
  const topShops = getTopRealShops(prefSlug, 20);

  const prefsByRegion: Record<string, Prefecture[]> = {};
  for (const region of regionOrder) {
    prefsByRegion[region] = prefectures.filter(p => p.region === region);
  }

  const hasAnyData = topGirls.length > 0 || worstGirls.length > 0 || topShops.length > 0;

  return (
    <div className="space-y-8">
      <nav className="text-xs sm:text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800">ランキング</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
        {prefName} パネマジランキング
      </h1>

      {/* Prefecture Selector */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <h2 className="text-sm font-bold text-gray-600 mb-2">都道府県を選択</h2>
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
                      href={`/ranking?pref=${pref.slug}`}
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

      {!hasAnyData ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-12 text-center">
          <p className="text-4xl mb-4">📊</p>
          <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">ランキング準備中</h2>
          <p className="text-gray-500 text-sm sm:text-base">
            口コミが増えたらランキングが表示されます。<br />
            パネル通り率ランキングには3件以上、店舗ランキングには5件以上の口コミが必要です。
          </p>
          <a
            href={`/${prefSlug}`}
            className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors no-underline text-sm font-medium"
          >
            口コミを投稿する
          </a>
        </div>
      ) : (
        <>
          {/* Top Real Girls */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-green-500">&#x2705;</span>
              パネル通り率 TOP{topGirls.length > 0 ? Math.min(20, topGirls.length) : 20}
            </h2>
            <p className="text-xs text-gray-400 mb-4">口コミ3件以上の女性をリアル度が高い順に表示</p>
            {topGirls.length === 0 ? (
              <p className="text-gray-400 text-center py-6 text-sm">口コミ3件以上の女性がまだいません</p>
            ) : (
              <div className="space-y-3">
                {topGirls.map((girl, i) => (
                  <a
                    key={girl.id}
                    href={`/girl/${girl.id}`}
                    className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors no-underline"
                  >
                    <span className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                      i === 0 ? 'bg-yellow-400 text-white' :
                      i === 1 ? 'bg-gray-300 text-white' :
                      i === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <GirlImage src={girl.image_url} alt={girl.name} size={48} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm sm:text-base truncate">{girl.name}</p>
                      <p className="text-xs text-gray-500 truncate">{girl.shop_name}</p>
                    </div>
                    <div className="shrink-0">
                      <RealScore pct={girl.real_pct ?? -1} reviewCount={girl.review_count || 0} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Worst Real Girls (Panel Fraud) */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-red-500">&#x1F4A3;</span>
              注意！盛りすぎ率 TOP{worstGirls.length > 0 ? Math.min(20, worstGirls.length) : 20}
            </h2>
            <p className="text-xs text-gray-400 mb-4">口コミ3件以上の女性をリアル度が低い順に表示</p>
            {worstGirls.length === 0 ? (
              <p className="text-gray-400 text-center py-6 text-sm">口コミ3件以上の女性がまだいません</p>
            ) : (
              <div className="space-y-3">
                {worstGirls.map((girl, i) => (
                  <a
                    key={girl.id}
                    href={`/girl/${girl.id}`}
                    className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors no-underline"
                  >
                    <span className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                      i === 0 ? 'bg-red-500 text-white' :
                      i === 1 ? 'bg-red-400 text-white' :
                      i === 2 ? 'bg-red-300 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <GirlImage src={girl.image_url} alt={girl.name} size={48} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm sm:text-base truncate">{girl.name}</p>
                      <p className="text-xs text-gray-500 truncate">{girl.shop_name}</p>
                    </div>
                    <div className="shrink-0">
                      <RealScore pct={girl.real_pct ?? -1} reviewCount={girl.review_count || 0} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Top Real Shops */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
              <span>&#x1F3EA;</span>
              店舗別パネル通り率ランキング
            </h2>
            <p className="text-xs text-gray-400 mb-4">口コミ5件以上の店舗をリアル度が高い順に表示</p>
            {topShops.length === 0 ? (
              <p className="text-gray-400 text-center py-6 text-sm">口コミ5件以上の店舗がまだありません</p>
            ) : (
              <div className="space-y-3">
                {topShops.map((shop, i) => (
                  <a
                    key={shop.id}
                    href={`/shop/${shop.id}`}
                    className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors no-underline"
                  >
                    <span className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                      i === 0 ? 'bg-yellow-400 text-white' :
                      i === 1 ? 'bg-gray-300 text-white' :
                      i === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm sm:text-base truncate">{shop.name}</p>
                      <p className="text-xs text-gray-500">{shop.area_name} / 在籍{shop.girl_count}人 / 口コミ{shop.review_count}件</p>
                    </div>
                    <div className="shrink-0">
                      <RealScore pct={shop.real_pct ?? -1} reviewCount={shop.review_count || 0} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
