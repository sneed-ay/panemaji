import { getShopById, getGirlsByShop } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBar from '@/components/PanelRatingBar';
import PanemajiScore from '@/components/PanemajiScore';

export const dynamic = 'force-dynamic';

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
      <nav className="text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-500">{shop.area_name}</span>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-800">{shop.name}</span>
      </nav>

      {/* Shop Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{shop.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">
                {shop.category}
              </span>
              <span className="text-gray-500 text-sm">{shop.area_name}</span>
            </div>
            {shop.description && (
              <p className="text-gray-600 mt-2">{shop.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <PanemajiScore pct={shop.panemaji_pct ?? -1} reviewCount={shop.review_count || 0} size="lg" />
            <div className="text-right">
              <p className="text-sm text-gray-500">
                在籍 <span className="text-xl text-blue-600 font-bold">{shop.girl_count}</span> 人
              </p>
              <p className="text-sm text-gray-500 mt-1">
                口コミ <span className="text-xl text-blue-600 font-bold">{shop.review_count}</span> 件
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Girl Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <form action={`/shop/${shopId}`} method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="女の子の名前で検索..."
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

      {/* Girls List */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">
          在籍一覧
          {query && <span className="text-base text-gray-500 ml-2">「{query}」の検索結果</span>}
        </h3>
        <p className="text-sm text-gray-500">{girls.length}人 / パネマジ度順</p>
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
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">{girl.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {girl.age}歳
                      {girl.height && ` T${girl.height}`}
                      {girl.bust && girl.cup && ` B${girl.bust}(${girl.cup})`}
                      {girl.waist && ` W${girl.waist}`}
                      {girl.hip && ` H${girl.hip}`}
                    </p>
                  </div>
                  <PanemajiScore pct={girl.panemaji_pct ?? -1} reviewCount={girl.review_count || 0} />
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
