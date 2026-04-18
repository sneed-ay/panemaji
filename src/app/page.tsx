import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, isValidCategory, getRecentlyReviewedGirls, prefectureSlugToName } from '@/lib/queries';
import GirlImage from '@/components/GirlImage';
import PanelRatingBadge from '@/components/PanelRatingBadge';

export const dynamic = 'force-dynamic';

export default function Home({ searchParams }: { searchParams: { pref?: string; cat?: string } }) {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;
  const recentGirls = getRecentlyReviewedGirls(8, prefSlug);
  const prefName = prefectureSlugToName(prefSlug);

  return (
    <>
      <HomeContent prefSlug={prefSlug} catSlug={catSlug} />

      {/* Recently Reviewed Girls - server rendered */}
      {recentGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 mt-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            {prefName}で最近評価された嬢
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentGirls.map((girl) => {
              const realPct = girl.real_pct ?? -1;
              const hasReviews = (girl.review_count ?? 0) > 0 && realPct >= 0;
              const pctColor = realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600';
              return (
                <a
                  key={girl.id}
                  href={`/girl/${girl.id}`}
                  className="block bg-gray-50 hover:bg-blue-50 rounded-lg p-2 sm:p-3 transition-colors no-underline"
                >
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <GirlImage src={girl.image_url} alt={girl.name} size={64} />
                    <div className="min-w-0 w-full">
                      <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{girl.name}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">{girl.shop_name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{girl.area_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <PanelRatingBadge rating={girl.panel_rating} size="sm" />
                      {hasReviews && (
                        <span className={`text-xs font-bold ${pctColor}`}>{realPct}%</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{girl.review_count ?? 0}件の口コミ</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
