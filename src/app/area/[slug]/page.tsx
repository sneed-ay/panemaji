import { getAreaBySlug, getShopsByArea } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanemajiScore from '@/components/PanemajiScore';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const area = getAreaBySlug(params.slug);
  if (!area) return {};
  return {
    title: `${area.name}のデリヘル パネマジ口コミ一覧`,
    description: `${area.name}エリアのデリヘル店舗のパネマジ度・口コミをチェック。パネル写真と実物の一致度がわかる。`,
  };
}

export default function AreaPage({ params }: { params: { slug: string } }) {
  const area = getAreaBySlug(params.slug);
  if (!area) notFound();

  const shops = getShopsByArea(area.id);

  return (
    <div className="space-y-6">
      <nav className="text-xs sm:text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800">{area.name}</span>
      </nav>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-800 break-words min-w-0">
          {area.name}の風俗店一覧
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 shrink-0">パネマジ度順</p>
      </div>

      {shops.length === 0 ? (
        <p className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          この地域の店舗データはまだありません
        </p>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => (
            <a
              key={shop.id}
              href={`/shop/${shop.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-3 sm:p-4 no-underline"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">{shop.name}</h3>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded shrink-0">
                      {shop.category}
                    </span>
                    <span className="text-gray-500 text-xs sm:text-sm">{area.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <PanemajiScore pct={shop.panemaji_pct ?? -1} reviewCount={shop.review_count || 0} />
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
          ))}
        </div>
      )}
    </div>
  );
}
