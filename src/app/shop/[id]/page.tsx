import { getShopById, getGirlsByShop } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBar from '@/components/PanelRatingBar';
import PanemajiScore from '@/components/PanemajiScore';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shop = getShopById(parseInt(params.id));
  if (!shop) return {};
  return {
    title: `${shop.name} パネマジ口コミ・評価`,
    description: `${shop.name}の女性一覧とパネマジ度チェック。パネル写真と実物が一致しているか口コミで確認。${shop.area_name || '東京'}のデリヘル。`,
  };
}

export default function ShopPage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const shopId = parseInt(params.id);
  if (isNaN(shopId)) notFound();

  const shop = getShopById(shopId);
  if (!shop) notFound();

  const query = searchParams.q || '';
  const girls = getGirlsByShop(shopId, query || undefined);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs sm:text-sm text-gray-500 break-words">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-500">{shop.area_name}</span>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800 break-words">{shop.name}</span>
      </nav>

      {/* Shop Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{shop.name}</h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-2">
              <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded shrink-0">
                {shop.category}
              </span>
              <span className="text-gray-500 text-xs sm:text-sm">{shop.area_name}</span>
            </div>
            {shop.description && (
              <p className="text-gray-600 mt-2 text-sm break-words">{shop.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <PanemajiScore pct={shop.panemaji_pct ?? -1} reviewCount={shop.review_count || 0} size="lg" />
            <div className="text-right">
              <p className="text-xs sm:text-sm text-gray-500">
                在籍 <span className="text-lg sm:text-xl text-blue-600 font-bold">{shop.girl_count}</span> 人
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                口コミ <span className="text-lg sm:text-xl text-blue-600 font-bold">{shop.review_count}</span> 件
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Girl Search */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <form action={`/shop/${shopId}`} method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="女の子の名前で検索..."
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

      {/* Girls List */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-xl font-bold text-gray-800 min-w-0">
          在籍一覧
          {query && <span className="text-sm sm:text-base text-gray-500 ml-2 break-words">「{query}」の検索結果</span>}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 shrink-0">{girls.length}人 / パネマジ度順</p>
      </div>

      {girls.length === 0 ? (
        <p className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          {query ? '該当する女性が見つかりませんでした' : '女性データはまだありません'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {girls.map((girl) => (
            <a
              key={girl.id}
              href={`/girl/${girl.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden no-underline"
            >
              <div className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-base sm:text-lg font-bold text-gray-800 break-words">{girl.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                      {girl.age}歳
                      {girl.height && ` T${girl.height}`}
                      {girl.bust && girl.cup && ` B${girl.bust}(${girl.cup})`}
                      {girl.waist && ` W${girl.waist}`}
                      {girl.hip && ` H${girl.hip}`}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <PanemajiScore pct={girl.panemaji_pct ?? -1} reviewCount={girl.review_count || 0} />
                  </div>
                </div>
                <div className="mt-3">
                  <PanelRatingBar
                    matchCount={girl.panel_match_count || 0}
                    diffCount={girl.panel_diff_count || 0}
                    jiraiCount={girl.jirai_count || 0}
                  />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
