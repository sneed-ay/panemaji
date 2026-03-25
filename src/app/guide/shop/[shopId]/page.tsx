import { getShopArticleData, getTopShopsForArticles, prefectureSlugToName, CATEGORY_MAP } from '@/lib/queries';
import { getAreaDescription, getDefaultAreaDescription } from '@/lib/area-descriptions';
import { getCategoryDescription, getDefaultCategoryDescription } from '@/lib/category-descriptions';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 86400; // ISR: 24 hours

// 上位50店舗のみ静的生成（量より質）
export function generateStaticParams(): { shopId: string }[] {
  try {
    const shops = getTopShopsForArticles(50);
    const seen = new Set<number>();
    const params: { shopId: string }[] = [];
    for (const shop of shops) {
      if (!seen.has(shop.id) && params.length < 50) {
        seen.add(shop.id);
        params.push({ shopId: String(shop.id) });
      }
    }
    return params;
  } catch {
    return [];
  }
}

// カテゴリ名からスラッグへの逆引き
function categoryToSlug(category: string): string | null {
  for (const [slug, name] of Object.entries(CATEGORY_MAP)) {
    if (name === category) return slug;
  }
  return null;
}

export function generateMetadata({ params }: { params: { shopId: string } }): Metadata {
  try {
    const data = getShopArticleData(parseInt(params.shopId));
    if (!data) return {};
    const { shop } = data;
    const areaName = shop.area_name || '東京';
    const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
    const title = `【${areaName}】${shop.name}完全ガイド｜パネマジ傾向・口コミ分析・エリア情報 | パネマジ掲示板`;
    const description = `${areaName}エリアの${shop.category}「${shop.name}」を徹底解説。${realPct !== null ? `パネル通り率${realPct}%。` : ''}${areaName}エリアの特徴、${shop.category}の選び方、口コミ傾向分析まで、利用前に知っておきたい情報をまとめました。`;
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

  const { shop, reviewDistribution, latestReviewsWithComment, topRealGirls, relatedShops } = data;
  const areaName = shop.area_name || '東京';
  const prefName = prefectureSlugToName(shop.prefecture || 'tokyo');
  const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
  const totalReviews = reviewDistribution.total;

  // エリア解説・業態解説を取得
  const areaSlug = shop.area_slug || '';
  const areaDesc = getAreaDescription(areaSlug) || getDefaultAreaDescription(areaName);
  const catDesc = getCategoryDescription(shop.category) || getDefaultCategoryDescription(shop.category);
  const catSlug = categoryToSlug(shop.category);

  // パネマジ傾向分析テキストを生成
  const panemajiAnalysis = generatePanemajiAnalysis(shop.name, realPct, totalReviews, reviewDistribution);

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${shop.name}完全ガイド｜${areaName}の${shop.category}を徹底解説`,
    description: `${areaName}の${shop.category}「${shop.name}」のパネマジ傾向、口コミ分析、エリア情報をまとめた完全ガイド。`,
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
          【{areaName}】{shop.name} 完全ガイド
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          {areaName}エリア | {shop.category} | 在籍{shop.girl_count || 0}人 | 口コミ{totalReviews}件
        </p>

        {/* 目次 */}
        <nav className="bg-gray-50 rounded-lg p-4 mb-8">
          <p className="text-sm font-bold text-gray-700 mb-2">この記事の内容</p>
          <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
            <li><a href="#area" className="hover:text-blue-800 hover:underline">{areaName}エリアの特徴</a></li>
            <li><a href="#category" className="hover:text-blue-800 hover:underline">{shop.category}の基本情報</a></li>
            <li><a href="#panemaji" className="hover:text-blue-800 hover:underline">{shop.name}のパネマジ傾向分析</a></li>
            <li><a href="#reviews" className="hover:text-blue-800 hover:underline">口コミ・評判まとめ</a></li>
            <li><a href="#usage" className="hover:text-blue-800 hover:underline">利用ガイド・注意点</a></li>
            <li><a href="#shopdata" className="hover:text-blue-800 hover:underline">店舗データ</a></li>
            <li><a href="#related" className="hover:text-blue-800 hover:underline">関連記事・近隣店舗</a></li>
          </ol>
        </nav>

        <div className="space-y-10 text-gray-700 text-sm sm:text-base leading-relaxed">

          {/* === 1. エリア解説 === */}
          <section id="area">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              {areaName}エリアの特徴
            </h2>
            <div className="space-y-4">
              <p>{areaDesc.overview}</p>
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-blue-800 mb-2">アクセス情報</h3>
                <p className="text-sm text-blue-700">{areaDesc.access}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-amber-800 mb-2">エリアのポイント</h3>
                <p className="text-sm text-amber-700">{areaDesc.tips}</p>
              </div>
            </div>
          </section>

          {/* === 2. 業態解説 === */}
          <section id="category">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              {shop.category}の基本情報
            </h2>
            <div className="space-y-4">
              <p>
                <span className="font-medium text-gray-800">{shop.name}</span>は
                <span className="font-medium text-pink-600">{shop.category}</span>に分類される店舗です。
              </p>
              <p>{catDesc.overview}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">サービスの特徴</h3>
                  <p className="text-sm text-gray-600">{catDesc.serviceInfo}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">料金相場</h3>
                  <p className="text-sm text-gray-600">{catDesc.priceRange}</p>
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-purple-800 mb-2">{shop.category}のパネマジ傾向</h3>
                <p className="text-sm text-purple-700">{catDesc.panemajiTrend}</p>
              </div>
            </div>
          </section>

          {/* === 3. パネマジ傾向分析 === */}
          <section id="panemaji">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              {shop.name}のパネマジ傾向分析
            </h2>
            <div className="space-y-4">
              {/* 分布グラフ */}
              {totalReviews > 0 ? (
                <>
                  <div className="space-y-3">
                    <DistributionRow label="パネル通り" count={reviewDistribution.panel_match} total={totalReviews} color="bg-green-500" />
                    <DistributionRow label="許せる" count={reviewDistribution.panel_diff} total={totalReviews} color="bg-yellow-400" />
                    <DistributionRow label="パネル詐欺" count={reviewDistribution.jirai} total={totalReviews} color="bg-red-500" />
                  </div>
                  {realPct !== null && (
                    <div className="text-center py-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">総合パネル通り率</span>
                      <span className={`text-3xl font-bold ml-2 ${realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {realPct}%
                      </span>
                      <span className="text-sm text-gray-500 ml-1">（{totalReviews}件の口コミに基づく）</span>
                    </div>
                  )}
                  {/* 分析テキスト */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <h3 className="text-sm font-bold text-gray-800">分析コメント</h3>
                    {panemajiAnalysis.map((text, i) => (
                      <p key={i} className="text-sm text-gray-700">{text}</p>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <p className="text-gray-500 mb-2">まだ口コミがありません</p>
                  <p className="text-sm text-gray-400">
                    {shop.name}を利用したことがある方は、ぜひ口コミを投稿してください。あなたの口コミが他のユーザーの参考になります。
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* === 4. 口コミ・評判まとめ === */}
          <section id="reviews">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              口コミ・評判まとめ
            </h2>
            {latestReviewsWithComment.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {shop.name}に寄せられた最新の口コミを紹介します。実際に利用したユーザーのリアルな声です。
                </p>
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
                <p className="text-sm text-gray-500">
                  <a href={`/shop/${shopId}`} className="text-pink-600 hover:text-pink-800 hover:underline">
                    全ての口コミ・在籍一覧を見る →
                  </a>
                </p>

                {/* パネル通り率が高い女性 */}
                {topRealGirls.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-base font-bold text-gray-800 mb-3">
                      パネル通り率が高いキャストTOP{topRealGirls.length}
                    </h3>
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
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">まだ口コミがありません。あなたの口コミをお待ちしています。</p>
            )}
          </section>

          {/* === 5. 利用ガイド === */}
          <section id="usage">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              利用ガイド・注意点
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-green-800 mb-3">パネマジを回避するためのチェックリスト</h3>
                <ul className="text-sm text-green-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">1.</span>
                    <span>口コミ件数を確認 — 口コミが多い（10件以上）キャストはパネル通り率の信頼度が高い</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">2.</span>
                    <span>パネル通り率をチェック — 70%以上ならパネルに近い可能性が高い</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">3.</span>
                    <span>口コミのコメントを読む — 数値だけでなく具体的な感想も参考になる</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">4.</span>
                    <span>店舗全体のパネル通り率も参考に — 店舗の方針でパネルの加工度が異なる</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">5.</span>
                    <span>新人は要注意 — 口コミがないキャストはパネル通り率が不明。冒険か安定かで選ぶ</span>
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-red-800 mb-3">利用時の注意点</h3>
                <ul className="text-sm text-red-700 space-y-1.5 list-disc list-inside">
                  <li>派遣型の場合、利用するホテルがNGでないか事前確認を</li>
                  <li>料金はコース料金以外にオプション・交通費等がかかる場合がある</li>
                  <li>キャンセル料の発生タイミングは店舗ごとに異なる</li>
                  <li>酔いすぎた状態での利用はトラブルの原因に</li>
                  <li>口コミ投稿は事実に基づいた内容を心がけましょう</li>
                </ul>
              </div>
            </div>
          </section>

          {/* === 6. 店舗データ === */}
          <section id="shopdata">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              店舗データ
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
            <div className="mt-4 text-center">
              <a
                href={`/shop/${shopId}`}
                className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
              >
                {shop.name}の在籍一覧・口コミを見る →
              </a>
            </div>
          </section>

          {/* === 7. 関連記事・近隣店舗 === */}
          <section id="related">
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              関連記事・近隣店舗
            </h2>
            <div className="space-y-6">
              {/* 関連ガイド記事 */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-3">関連ガイド記事</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {areaSlug && (
                    <a
                      href={`/area/${areaSlug}`}
                      className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm text-blue-700 font-medium"
                    >
                      <span>→</span>
                      <span>{areaName}エリアの全店舗一覧</span>
                    </a>
                  )}
                  {catSlug && (
                    <a
                      href={`/guide`}
                      className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-sm text-purple-700 font-medium"
                    >
                      <span>→</span>
                      <span>{shop.category}の選び方ガイド</span>
                    </a>
                  )}
                  <a
                    href="/guide/panemaji-taisaku"
                    className="flex items-center gap-2 p-3 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors text-sm text-pink-700 font-medium"
                  >
                    <span>→</span>
                    <span>パネマジ対策ガイド</span>
                  </a>
                  <a
                    href="/guide/kuchikomi-katsuyou"
                    className="flex items-center gap-2 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-sm text-green-700 font-medium"
                  >
                    <span>→</span>
                    <span>口コミ活用術</span>
                  </a>
                </div>
              </div>

              {/* 同エリアの他の店舗 */}
              {relatedShops.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base font-bold text-gray-800 mb-3">
                    {areaName}エリアの他の店舗
                  </h3>
                  <div className="space-y-2">
                    {relatedShops.map((rs) => {
                      const rsRealPct = rs.real_pct != null && rs.real_pct >= 0 ? rs.real_pct : null;
                      return (
                        <a
                          key={rs.id}
                          href={`/guide/shop/${rs.id}`}
                          className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors group"
                        >
                          <div className="min-w-0">
                            <span className="text-pink-600 group-hover:text-pink-800 text-sm font-medium truncate block">
                              {rs.name}
                            </span>
                            <span className="text-xs text-gray-400">{rs.category}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            {rsRealPct !== null && (
                              <span className={`text-xs font-bold ${rsRealPct >= 70 ? 'text-green-600' : rsRealPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {rsRealPct}%
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-1">
                              口コミ{rs.review_count || 0}件
                            </span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    <a href={`/area/${shop.area_slug}`} className="text-pink-600 hover:text-pink-800 hover:underline">
                      {areaName}エリアの全店舗を見る →
                    </a>
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}

/**
 * パネマジ傾向分析テキストを生成
 */
function generatePanemajiAnalysis(
  shopName: string,
  realPct: number | null,
  totalReviews: number,
  distribution: { panel_match: number; panel_diff: number; jirai: number; total: number },
): string[] {
  const analysis: string[] = [];

  if (totalReviews === 0) {
    return [`${shopName}にはまだ口コミが投稿されていないため、パネマジ傾向の分析ができません。利用経験がある方は、ぜひ口コミを投稿してください。`];
  }

  // 口コミ件数に応じた信頼度
  if (totalReviews >= 20) {
    analysis.push(`${shopName}には${totalReviews}件の口コミが集まっており、パネマジ傾向の信頼度は高いと判断できます。多くのユーザーの評価に基づいた分析です。`);
  } else if (totalReviews >= 10) {
    analysis.push(`${shopName}には${totalReviews}件の口コミがあり、ある程度の傾向を把握できる状態です。今後さらに口コミが増えることで、より正確な分析が可能になります。`);
  } else if (totalReviews >= 3) {
    analysis.push(`${shopName}の口コミは現在${totalReviews}件です。傾向をつかむには十分ですが、口コミ数がまだ少ないため、今後の評価で変動する可能性があります。`);
  } else {
    analysis.push(`${shopName}の口コミは${totalReviews}件とまだ少なく、傾向分析の信頼度は限定的です。参考程度にご覧ください。`);
  }

  // パネル通り率に基づく分析
  if (realPct !== null) {
    if (realPct >= 80) {
      analysis.push(`パネル通り率は${realPct}%と非常に高く、パネル写真と実物の差が小さい店舗といえます。パネル写真を参考にした指名がしやすい優良店です。`);
    } else if (realPct >= 60) {
      analysis.push(`パネル通り率は${realPct}%で、全体的にパネル写真に近い接客が期待できます。一部キャストでは差がある場合もありますが、概ね安心できるレベルです。`);
    } else if (realPct >= 40) {
      analysis.push(`パネル通り率は${realPct}%で、パネルと実物に差があるキャストも一定数いる状態です。指名時は個別のキャストの口コミを確認することをおすすめします。`);
    } else {
      analysis.push(`パネル通り率は${realPct}%とやや低めで、パネル写真と実物に差を感じるケースが多い傾向です。口コミでの情報収集を特に入念に行うことをおすすめします。`);
    }
  }

  // 分布傾向
  const matchPct = totalReviews > 0 ? Math.round((distribution.panel_match / totalReviews) * 100) : 0;
  const jiraiPct = totalReviews > 0 ? Math.round((distribution.jirai / totalReviews) * 100) : 0;

  if (jiraiPct >= 30) {
    analysis.push(`「パネル詐欺」評価が${jiraiPct}%とやや多い点は注意が必要です。パネル通り率が高いキャストを個別に選んで指名するのが賢い利用法です。`);
  } else if (matchPct >= 60) {
    analysis.push(`「パネル通り」評価が${matchPct}%を占めており、全体的にパネル写真の信頼度が高い店舗です。フリー（指名なし）でも比較的安心して利用できるでしょう。`);
  }

  return analysis;
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
