import { getAreaBySlug, getShopsByArea, prefectureSlugToName, isValidCategory, CATEGORY_COLORS, getPopularGirlsInAreaTop } from '@/lib/queries';
import { notFound } from 'next/navigation';
import RealScore from '@/components/RealScore';
import CategoryTabs from '@/components/CategoryTabs';
import GirlImage from '@/components/GirlImage';
import RelatedGuides from '@/components/RelatedGuides';
import type { Metadata } from 'next';

export const revalidate = 300;

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const area = getAreaBySlug(params.slug);
  if (!area) return {};
  const prefDisplayName = prefectureSlugToName(area.prefecture);
  return {
    title: `${area.name}の風俗店 口コミ・掲示板・パネマジ度`,
    description: `${prefDisplayName} ${area.name}エリアの風俗店の口コミ掲示板。パネル写真と実物の一致度（パネマジ度）を口コミでチェック。${area.name}のデリヘル・メンエス・ヘルス店舗のリアルな評判がわかる。`,
    alternates: {
      canonical: `https://panemaji.com/area/${params.slug}`,
    },
  };
}

export default function AreaPage({ params, searchParams }: { params: { slug: string }; searchParams: { cat?: string } }) {
  const area = getAreaBySlug(params.slug);
  if (!area) notFound();

  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;
  const shops = getShopsByArea(area.id, catSlug);
  const popularGirls = getPopularGirlsInAreaTop(area.id, 5);
  const prefSlug = area.prefecture;
  const prefName = prefectureSlugToName(prefSlug);

  return (
    <div className="space-y-6">
      <nav className="text-xs sm:text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/${prefSlug}`} className="hover:text-blue-600">{prefName}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800">{area.name}</span>
      </nav>

      {/* Category Tabs */}
      <CategoryTabs
        currentCat={catSlug || ''}
        basePath={`/area/${params.slug}`}
      />

      {/* Popular Girls TOP5 */}
      {popularGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            {area.name} 人気の嬢 TOP5
          </h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {popularGirls.map((girl, i) => {
              const realPct = girl.real_pct ?? -1;
              const hasReviews = (girl.review_count ?? 0) > 0 && realPct >= 0;
              const pctColor = realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600';
              const rankColors = i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-blue-400';
              return (
                <a
                  key={girl.id}
                  href={`/girl/${girl.id}`}
                  className="flex-shrink-0 w-28 sm:w-32 bg-gray-50 hover:bg-blue-50 rounded-lg p-2 sm:p-3 transition-colors no-underline relative"
                >
                  <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${rankColors} z-10 shadow`}>
                    {i + 1}
                  </div>
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <GirlImage src={girl.image_url} alt={girl.name} size={64} />
                    <div className="min-w-0 w-full">
                      <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{girl.name}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">{girl.shop_name}</p>
                    </div>
                    {hasReviews && (
                      <span className={`text-xs font-bold ${pctColor}`}>{realPct}%</span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-800 break-words min-w-0">
          {area.name}の風俗店<span className="sr-only">の口コミ掲示板・パネマジ度</span>一覧
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 shrink-0">リアル度順</p>
      </div>

      {shops.length === 0 ? (
        <p className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          {catSlug ? 'この条件に該当する店舗はありません' : 'この地域の店舗データはまだありません'}
        </p>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => {
            const catColor = CATEGORY_COLORS[shop.category] || 'bg-gray-100 text-gray-700';
            return (
              <a
                key={shop.id}
                href={`/shop/${shop.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-3 sm:p-4 no-underline"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">{shop.name}</h3>
                    <div className="flex items-center gap-2 sm:gap-3 mt-1">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded shrink-0 ${catColor}`}>
                        {shop.category}
                      </span>
                      <span className="text-gray-500 text-xs sm:text-sm">{area.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <RealScore pct={shop.real_pct ?? -1} reviewCount={shop.review_count || 0} />
                    <div className="text-right">
                      <p className="text-xs sm:text-sm text-gray-500">
                        在籍 <span className="text-blue-600 font-bold">{shop.girl_count}</span> 人
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        口コミ <span className="text-blue-600 font-bold">{shop.review_count}</span> 件
                      </p>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <RelatedGuides areaSlug={params.slug} prefSlug={prefSlug} />
    </div>
  );
}
