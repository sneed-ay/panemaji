import { getAreaBySlug, getShopsByArea, prefectureSlugToName, isValidCategory, CATEGORY_COLORS } from '@/lib/queries';
import { notFound } from 'next/navigation';
import RealScore from '@/components/RealScore';
import CategoryTabs from '@/components/CategoryTabs';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const area = getAreaBySlug(params.slug);
  if (!area) return {};
  const prefDisplayName = prefectureSlugToName(area.prefecture);
  return {
    title: `${area.name}の風俗 パネマジ度・口コミ`,
    description: `${prefDisplayName} ${area.name}エリアの風俗店舗のパネマジ度・口コミをチェック。パネル写真と実物の一致度がわかる。`,
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

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-800 break-words min-w-0">
          {area.name}の風俗店一覧
        </h2>
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
    </div>
  );
}
