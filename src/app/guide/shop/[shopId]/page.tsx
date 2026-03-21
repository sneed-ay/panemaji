import { getShopArticleData, getTopShopsForArticles, prefectureSlugToName } from '@/lib/queries';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 86400; // ISR: 24 hours

export function generateStaticParams(): { shopId: string }[] {
  try {
    const shops = getTopShopsForArticles(200);
    // Deduplicate (top by review_count*2 + girl_count already handles both criteria)
    const seen = new Set<number>();
    const params: { shopId: string }[] = [];
    for (const shop of shops) {
      if (!seen.has(shop.id) && params.length < 200) {
        seen.add(shop.id);
        params.push({ shopId: String(shop.id) });
      }
    }
    return params;
  } catch {
    return [];
  }
}

export function generateMetadata({ params }: { params: { shopId: string } }): Metadata {
  try {
    const data = getShopArticleData(parseInt(params.shopId));
    if (!data) return {};
    const { shop } = data;
    const areaName = shop.area_name || '東京';
    const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
    const title = `${shop.name}のパネマジ度・口コミまとめ | ${areaName} | パネマジ掲示板`;
    const description = `${shop.name}の在籍嬢のパネマジ度を口コミで徹底解説。${realPct !== null ? `パネル通り率${realPct}%、` : ''}在籍${shop.girl_count || 0}人。${areaName}のデリヘル口コミ。`;
    return {
      title,
      description,
      alternates: { canonical: `https://panemaji.com/guide/shop/${params.shopId}` },
      openGraph: {
        title,
        description,
        type: 'article',
        locale: 'ja_JP',
        siteName: 'パネマジ掲示板',
        url: `https://panemaji.com/guide/shop/${params.shopId}`,
      },
    };
  } catch {
    return {};
  }
}

export default function ShopArticlePage({ params }: { params: { shopId: string } }) {
  const shopId = parseInt(params.shopId);
  if (isNaN(shopId)) notFound();

  const data = getShopArticleData(shopId);
  if (!data) notFound();

  const { shop, reviewDistribution, latestReviewsWithComment, topRealGirls, girlsWithNoReviews, relatedShops } = data;
  const areaName = shop.area_name || '東京';
  const prefName = prefectureSlugToName(shop.prefecture || 'tokyo');
  const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
  const totalReviews = reviewDistribution.total;

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${shop.name}のパネマジ度を徹底解説`,
    description: `${shop.name}の在籍嬢のパネマジ度を口コミで徹底解説。`,
    publisher: { '@type': 'Organization', name: 'パネマジ掲示板', url: 'https://panemaji.com' },
    mainEntityOfPage: `https://panemaji.com/guide/shop/${shopId}`,
  };

  return (
    <div className="max-w-3xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <a href="/guide" className="hover:text-pink-600">ガイド</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{shop.name}</span>
      </nav>

      <article className="bg-white rounded-lg shadow p-6 sm:p-8">
        {/* H1 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          {shop.name}のパネマジ度を徹底解説
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {areaName}エリア | 在籍{shop.girl_count || 0}人 | 口コミ{totalReviews}件
        </p>

        <div className="space-y-10 text-gray-700 text-sm sm:text-base leading-relaxed">

          {/* 店舗基本情報 */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              店舗基本情報
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <InfoRow label="店名" value={shop.name} />
              <InfoRow label="エリア" value={`${prefName} / ${areaName}`} />
              <InfoRow label="カテゴリ" value={shop.category} />
              <InfoRow label="在籍数" value={`${shop.girl_count || 0}人`} />
              <InfoRow label="口コミ数" value={`${totalReviews}件`} />
              {realPct !== null && (
                <InfoRow label="パネル通り率" value={`${realPct}%`} />
              )}
            </div>
          </section>

          {/* パネマジ度分布 */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              パネマジ度分布
            </h2>
            {totalReviews === 0 ? (
              <p className="text-gray-400">まだ口コミがありません。あなたの口コミをお待ちしています。</p>
            ) : (
              <div className="space-y-3">
                <DistributionRow label="パネル通り" count={reviewDistribution.panel_match} total={totalReviews} color="bg-green-500" />
                <DistributionRow label="許せる" count={reviewDistribution.panel_diff} total={totalReviews} color="bg-yellow-400" />
                <DistributionRow label="パネル詐欺" count={reviewDistribution.jirai} total={totalReviews} color="bg-red-500" />
                <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
                  全{totalReviews}件の口コミに基づく評価です。
                  {realPct !== null && (
                    <> 総合パネマジ度 <span className="font-bold text-blue-600">{realPct}%</span></>
                  )}
                </p>
              </div>
            )}
          </section>

          {/* 最新の口コミ紹介 */}
          {latestReviewsWithComment.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
                最新の口コミ紹介
              </h2>
              <div className="space-y-3">
                {latestReviewsWithComment.map((review) => (
                  <div key={review.id} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <RatingLabel rating={review.panel_rating} />
                      <a href={`/girl/${review.girl_id}`} className="font-medium text-blue-600 hover:text-blue-800 text-sm">
                        {review.girl_name}
                      </a>
                      <span className="text-xs text-gray-400 ml-auto">
                        {review.created_at?.split(' ')[0] || review.created_at}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{review.comment}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                <a href={`/shop/${shopId}`} className="text-pink-600 hover:text-pink-800 hover:underline">
                  全ての口コミを見る →
                </a>
              </p>
            </section>
          )}

          {/* パネル通り率が高い女性TOP5 */}
          {topRealGirls.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
                パネル通り率が高い女性TOP{topRealGirls.length}
              </h2>
              <div className="space-y-2">
                {topRealGirls.map((girl, i) => {
                  const girlRealPct = girl.real_pct != null && girl.real_pct >= 0 ? girl.real_pct : null;
                  return (
                    <a
                      key={girl.id}
                      href={`/girl/${girl.id}`}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <span className="text-lg font-bold text-pink-500 w-8 text-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800 group-hover:text-pink-600 text-sm">
                          {girl.name}
                        </span>
                        {girl.age && <span className="text-gray-400 text-xs ml-1">({girl.age}歳)</span>}
                      </div>
                      <div className="text-right shrink-0">
                        {girlRealPct !== null && (
                          <span className="text-sm font-bold text-green-600">{girlRealPct}%</span>
                        )}
                        <span className="text-xs text-gray-400 ml-1">({girl.review_count}件)</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* 口コミ募集中の女性一覧 */}
          {girlsWithNoReviews.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
                口コミ募集中の女性一覧
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                以下の女性はまだ口コミがありません。利用経験がある方はぜひ口コミを投稿してください。
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {girlsWithNoReviews.map((girl) => (
                  <a
                    key={girl.id}
                    href={`/girl/${girl.id}`}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                  >
                    <span className="text-gray-800 truncate">{girl.name}</span>
                    {girl.age && <span className="text-gray-400 text-xs shrink-0">({girl.age})</span>}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="text-center bg-pink-50 rounded-lg p-6">
            <p className="text-gray-700 mb-3 font-medium">
              {shop.name}の在籍嬢をもっと詳しくチェック！
            </p>
            <a
              href={`/shop/${shopId}`}
              className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
            >
              {shop.name}の店舗ページを見る →
            </a>
          </section>

          {/* 関連店舗 */}
          {relatedShops.length > 0 && (
            <section className="bg-gray-50 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                {areaName}エリアの他の店舗
              </h2>
              <div className="space-y-2">
                {relatedShops.map((rs) => (
                  <a
                    key={rs.id}
                    href={`/guide/shop/${rs.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors group"
                  >
                    <span className="text-pink-600 group-hover:text-pink-800 text-sm font-medium truncate">
                      → {rs.name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      口コミ{rs.review_count || 0}件
                    </span>
                  </a>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                <a href={`/area/${shop.area_slug}`} className="text-pink-600 hover:text-pink-800 hover:underline">
                  {areaName}エリアの全店舗を見る →
                </a>
              </p>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-sm w-24 shrink-0">{label}</span>
      <span className="text-gray-800 text-sm font-medium">{value}</span>
    </div>
  );
}

function DistributionRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
        {pct > 0 && (
          <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className="text-sm text-gray-600 w-20 shrink-0 text-right">{count}件 ({pct}%)</span>
    </div>
  );
}

function RatingLabel({ rating }: { rating: string }) {
  const labels: Record<string, { text: string; cls: string }> = {
    panel_match: { text: 'パネル通り', cls: 'bg-green-100 text-green-700' },
    panel_diff: { text: '許せる', cls: 'bg-yellow-100 text-yellow-700' },
    jirai: { text: 'パネル詐欺', cls: 'bg-red-100 text-red-700' },
  };
  const info = labels[rating] || labels.panel_diff;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${info.cls}`}>
      {info.text}
    </span>
  );
}
