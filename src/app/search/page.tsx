import { searchShops } from '@/lib/queries';

export const dynamic = 'force-dynamic'; // Search must remain dynamic (user-specific query params)

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q || '';
  const shops = query ? searchShops(query) : [];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-800">検索結果</span>
      </nav>

      {/* Search form */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <form action="/search" method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
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

      {query && (
        <p className="text-sm sm:text-base text-gray-600 break-words">
          「<span className="font-medium text-gray-800 break-all">{query}</span>」の検索結果: {shops.length}件
        </p>
      )}

      {shops.length > 0 ? (
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
                    <span className="text-gray-500 text-xs sm:text-sm">{shop.area_name}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs sm:text-sm text-gray-500">
                    在籍 <span className="text-blue-600 font-bold">{shop.girl_count}</span> 人
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    口コミ <span className="text-blue-600 font-bold">{shop.review_count}</span> 件
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : query ? (
        <p className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          該当する店舗が見つかりませんでした
        </p>
      ) : null}
    </div>
  );
}
