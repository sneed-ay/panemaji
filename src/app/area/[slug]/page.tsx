import { getAreaBySlug, getShopsByArea, getAreaMetaStats, prefectureSlugToName, isValidCategory, CATEGORY_COLORS, getPopularGirlsInAreaTop, getAreasByPrefecture, getRelatedAreas, getRecentlyClosedShopsByArea, getShopGenuineReviewStats, getShopsByBakusaiComments } from '@/lib/queries';
import { getAreaDescription } from '@/lib/area-descriptions';
import { notFound } from 'next/navigation';
import RealScore from '@/components/RealScore';
import CategoryTabs from '@/components/CategoryTabs';
import GirlImage from '@/components/GirlImage';
import RelatedGuides from '@/components/RelatedGuides';
import RelatedAreas from '@/components/RelatedAreas';
import type { Metadata } from 'next';

export const revalidate = 7200; // 2026-05-17: 30min → 2h (ISR rebuild storm 防止 / Render Starter 0.5CPU 救済)

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const area = getAreaBySlug(params.slug);
  if (!area) return {};
  const prefDisplayName = prefectureSlugToName(area.prefecture);
  // area.name は「銀座・新橋・有楽町・八重洲・日本橋」のように 15字超もある。
  // layout.tsx で `%s｜パネマジ掲示板` (8字) 後付。 page 側 title は 22-24 字目標。
  const areaLen = area.name.length;
  const title = areaLen <= 14
    ? `${area.name} 風俗 口コミ・パネマジ度`           // 例: "新宿・歌舞伎町 風俗 口コミ・パネマジ度" (19字)
    : `${area.name} 口コミ・パネマジ度`;                // 長エリア用に短縮
  // 全325エリアがほぼ同一文面で数値ゼロだったため CTR 3.8% (店舗ページ10.1%の1/3) に留まっていた。
  // 店舗数・在籍数・口コミ数を入れて他エリアと区別できるようにする (2026-08-26)。
  // ⚠️ 「掲示板」は最大流入クエリ語なので必ず前方に置く。
  //    数値を前に出した版では 91字目まで後退していた (2026-08-27 修正)。
  const { shopCount, girlTotal, reviewTotal } = getAreaMetaStats(area.id);
  const scale = [
    shopCount > 0 ? `${shopCount.toLocaleString()}店` : null,
    girlTotal > 0 ? `在籍${girlTotal.toLocaleString()}人` : null,
    reviewTotal > 0 ? `口コミ${reviewTotal.toLocaleString()}件` : null,
  ].filter(Boolean).join('・');
  return {
    title,
    description: `${prefDisplayName}・${area.name}の風俗店 口コミ掲示板。${scale ? `${scale}。` : ''}パネル写真と実物の一致度（パネマジ度）をチェック。デリヘル・ソープ・メンエスのリアル評判。`,
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
  // 閉店候補店舗 (is_active=0 / または 7日以上嬢ゼロ) を 別 リスト で 下に 表示
  const closedShops = getRecentlyClosedShopsByArea(area.id, catSlug, 30);
  const popularGirls = getPopularGirlsInAreaTop(area.id, 10);
  const prefSlug = area.prefecture;
  const prefName = prefectureSlugToName(prefSlug);
  // SEO: 同 pref 内の他エリア (アクティブ店舗数の多い順 8件) — 内部リンク強化
  const relatedAreas = getRelatedAreas(prefSlug, area.id, 8);
  // 掲示板の声(ext-bakusai)が多い店 — パネマジ言及の多い店を回遊導線に(表示のみ・schema非掲載)
  const bbsShops = getShopsByBakusaiComments({ areaId: area.id }, 8);

  // 独自エリア解説 (area-descriptions.ts) を CollectionPage.description に 流用
  const areaDesc = getAreaDescription(params.slug);
  const areaSchemaDescription = areaDesc
    ? `${areaDesc.overview} ${areaDesc.access}`.slice(0, 500)
    : `${prefName} ${area.name}エリアの風俗店の口コミ・パネマジ度を 一覧でチェック。 在籍嬢のリアル度ランキングと 利用者の評価を 掲載しています。`;

  // CollectionPage + ItemList JSON-LD (rich result 対応・副作用ゼロ・追加のみ)
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${area.name}の風俗店 口コミ・掲示板・パネマジ度`,
    description: areaSchemaDescription,
    url: `https://panemaji.com/area/${params.slug}`,
    inLanguage: 'ja-JP',
    isPartOf: { '@type': 'WebSite', name: 'パネマジ掲示板', url: 'https://panemaji.com' },
    about: { '@type': 'Place', name: area.name, containedInPlace: { '@type': 'Place', name: prefName } },
    ...(shops.length > 0 ? {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: shops.length,
        itemListElement: shops.slice(0, 10).map((shop, i) => {
          // 構造化データは会員生口コミのみ(外部転載 ext-* を除外 = レビュースパムポリシー対策)
          const gen = getShopGenuineReviewStats(shop.id);
          const hasRating = gen.reviewCount > 0 && gen.realPct >= 0;
          const item: Record<string, unknown> = {
            '@type': 'LocalBusiness',
            '@id': `https://panemaji.com/shop/${shop.id}#shop`,
            name: shop.name,
            url: `https://panemaji.com/shop/${shop.id}`,
            address: { '@type': 'PostalAddress', addressLocality: area.name, addressRegion: prefName, addressCountry: 'JP' },
          };
          if (hasRating) {
            item.aggregateRating = {
              '@type': 'AggregateRating',
              ratingValue: Math.round(gen.realPct / 20 * 10) / 10,
              bestRating: 5,
              worstRating: 0,
              reviewCount: gen.reviewCount,
            };
          }
          return {
            '@type': 'ListItem',
            position: i + 1,
            item,
          };
        }),
      },
    } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: 'https://panemaji.com' },
      { '@type': 'ListItem', position: 2, name: prefName, item: `https://panemaji.com/${prefSlug}` },
      { '@type': 'ListItem', position: 3, name: area.name, item: `https://panemaji.com/area/${params.slug}` },
    ],
  };

  // FAQ Q&A は schema + 表示UI で 共用 (一貫性: Google が schema と 視覚を 突き合わせる)
  const faqItems: Array<{ q: string; a: string }> = [
    {
      q: `${area.name}でパネマジ (パネルマジック) を見破る方法は？`,
      a: `パネマジ掲示板では ${area.name}エリアの 各店舗・嬢ごとに 実際の利用者の「パネル写真と実物の一致度 (パネマジ度)」を集計しています。 店舗ページでパネマジ度 (リアル度) を確認してから 予約することで パネマジ被害を回避できます。`,
    },
    {
      q: `${area.name}の風俗店の口コミはどこで見られる？`,
      a: `${area.name}の デリヘル・ソープ・メンエス・ヘルス各店舗の 口コミは パネマジ掲示板の各店舗ページで 閲覧できます。 ユーザー投稿のみで構成され、 パネル写真と実物の 一致度、 接客評価、 リピートしたいかなど 実利用者目線の 評価が 集まっています。`,
    },
    {
      q: `${area.name}で 在籍数が多い店舗は？`,
      a: shops.length > 0
        ? `${area.name}には現在 ${shops.length} 店舗を 掲載しています。 在籍嬢数が 多い順・パネマジ度 (リアル度) 高い順に 並び替えてご確認いただけます。`
        : `${area.name}は 現在掲載店舗がありません。 ${prefName}内の 他エリアから 探してみてください。`,
    },
  ];

  // FAQ JSON-LD — 検索結果の rich snippet 用 (副作用ゼロ、 schema のみ追加)
  // shops が空でも "近隣エリア" 系の質問は意味があるので 表示する
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  // Place schema — エリアそのものの 地理情報
  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: area.name,
    address: { '@type': 'PostalAddress', addressRegion: prefName, addressCountry: 'JP' },
    containedInPlace: { '@type': 'Place', name: prefName },
    url: `https://panemaji.com/area/${params.slug}`,
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
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

      {/* エリア概要 (SEO 上長文コンテンツ + ユーザー UX 両対応 — 該当エリアのみ) */}
      {areaDesc && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 space-y-2 text-sm text-gray-700">
          <h2 className="text-sm sm:text-base font-bold text-gray-800">{area.name}エリア概要</h2>
          <p className="leading-relaxed">{areaDesc.overview}</p>
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer hover:text-blue-600 transition-colors">アクセス・利用のコツ を見る</summary>
            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-100">
              <p><span className="font-bold text-gray-700">アクセス:</span> {areaDesc.access}</p>
              <p><span className="font-bold text-gray-700">利用のコツ:</span> {areaDesc.tips}</p>
            </div>
          </details>
        </div>
      )}

      {/* Popular Girls TOP10 */}
      {popularGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            {area.name} 人気の嬢 TOP10
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

      {/* 掲示板で話題の店(ext-bakusai言及が多い順) — 回遊・内部リンク強化(schema非掲載) */}
      {bbsShops.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">{area.name} 掲示板で話題の店</h2>
          <div className="space-y-2">
            {bbsShops.map((shop) => (
              <a key={shop.id} href={`/shop/${shop.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-pink-50 transition-colors no-underline">
                <span className="inline-flex items-center justify-center shrink-0 bg-pink-100 text-pink-700 text-[10px] font-bold rounded-full px-2 h-6">掲示板{shop.bakusai_count}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{shop.name}</span>
                {(shop.real_pct ?? -1) >= 0 && (
                  <span className={`text-xs shrink-0 font-bold ${(shop.real_pct ?? 0) >= 70 ? 'text-green-600' : (shop.real_pct ?? 0) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{shop.real_pct}%</span>
                )}
              </a>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">外部掲示板でパネマジ(パネル写真と実物)について言及が多い店です。</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-800 break-words min-w-0">
          {area.name}の風俗店<span className="sr-only">の口コミ掲示板・パネマジ度</span>一覧
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 shrink-0">リアル度順</p>
      </div>

      {shops.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center">
          <p className="text-gray-700 mb-4">
            {catSlug
              ? `${area.name}にはこの条件に該当する店舗はありません。`
              : `${area.name}の店舗データは現在掲載されていません。`}
          </p>
          <p className="text-sm text-gray-500 mb-5">
            {prefName}内の他のエリアからお探しいただけます。
          </p>
          {/* 同 prefecture の他エリアへの誘導 (CTR改善・thin content解消) */}
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {getAreasByPrefecture(prefSlug)
              .filter((a) => a.slug !== params.slug)
              .slice(0, 12)
              .map((a) => (
                <a
                  key={a.slug}
                  href={`/area/${a.slug}`}
                  className="bg-gray-100 hover:bg-pink-50 hover:text-pink-700 text-gray-700 px-3 py-1.5 rounded text-sm no-underline transition-colors"
                >
                  {a.name}
                </a>
              ))}
          </div>
          <a
            href={`/${prefSlug}`}
            className="inline-block bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-5 rounded-lg no-underline transition-colors"
          >
            {prefName}トップへ
          </a>
        </div>
      ) : (
        <>
          {/* TOP 50 ハイランク店: フルカード (HTML 軽量化のため 残りは コンパクト表示) */}
          <div className="space-y-3">
            {shops.slice(0, 50).map((shop) => {
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
          {/* 51件以降: コンパクト1行表示 (SEO 内部リンク 維持・ HTML サイズ 1/5 に削減) */}
          {shops.length > 50 && (
            <div className="mt-4 bg-white rounded-lg shadow p-3 sm:p-4">
              <h2 className="text-xs sm:text-sm font-bold text-gray-700 mb-2">
                {area.name}の その他の店舗 ({shops.length - 50}件)
              </h2>
              <ul className="divide-y divide-gray-100">
                {shops.slice(50).map((shop) => {
                  const catColor = CATEGORY_COLORS[shop.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <li key={shop.id} className="py-1.5">
                      <a
                        href={`/shop/${shop.id}`}
                        className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 no-underline"
                      >
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor}`}>{shop.category}</span>
                        <span className="flex-1 truncate">{shop.name}</span>
                        {(shop.review_count ?? 0) > 0 && (shop.real_pct ?? -1) >= 0 && (
                          <span className={`text-xs shrink-0 ${(shop.real_pct ?? 0) >= 70 ? 'text-green-600' : (shop.real_pct ?? 0) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {shop.real_pct}%
                          </span>
                        )}
                        <span className="text-xs text-gray-400 shrink-0">{shop.girl_count}人</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {/* 閉店した可能性が高い店舗 (折りたたみ + 閉店バッジ付き) */}
      {closedShops.length > 0 && (
        <details className="bg-gray-50 rounded-lg p-4 sm:p-5">
          <summary className="cursor-pointer text-sm sm:text-base font-bold text-gray-600 hover:text-gray-800 transition-colors list-none flex items-center gap-2">
            <span className="inline-block bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded">閉店</span>
            <span>閉店した可能性のある店舗 ({closedShops.length})</span>
            <span className="text-xs text-gray-400 ml-auto">クリックで展開</span>
          </summary>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-2 mb-3">
            30 日以上 在籍嬢が確認できない or 自動巡回で 検知できなくなった店舗です。 過去の口コミ・パネマジ度の 参考にどうぞ。
          </p>
          <div className="space-y-2 mt-3">
            {closedShops.map((shop) => {
              const catColor = CATEGORY_COLORS[shop.category] || 'bg-gray-100 text-gray-700';
              return (
                <a
                  key={shop.id}
                  href={`/shop/${shop.id}`}
                  className="block bg-white rounded shadow-sm hover:shadow transition-shadow p-2 sm:p-3 no-underline opacity-75 hover:opacity-100"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block bg-gray-300 text-gray-700 text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium">閉店</span>
                        <h3 className="text-sm font-bold text-gray-700 break-words">{shop.name}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor} opacity-70`}>{shop.category}</span>
                        {(shop.review_count ?? 0) > 0 && (
                          <span className="text-xs text-gray-500">口コミ {shop.review_count}件 (過去)</span>
                        )}
                        {shop.last_seen_at && (
                          <span className="text-[10px] text-gray-400">最終確認: {new Date(shop.last_seen_at).toLocaleDateString('ja-JP')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </details>
      )}

      <RelatedGuides areaSlug={params.slug} prefSlug={prefSlug} />

      {/* よくある質問 (SEO: FAQ schema と一致する visible 表示 — Google の rich snippet 採用率 up) */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-5">
        <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">{area.name}に関する よくある質問</h2>
        <div className="space-y-2">
          {faqItems.map(({ q, a }, i) => (
            <details key={i} className="group border-b border-gray-100 last:border-b-0 pb-2 last:pb-0">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors py-1.5 list-none flex items-start gap-1.5">
                <span className="text-blue-500 text-xs mt-0.5 group-open:rotate-90 transition-transform inline-block">▶</span>
                <span className="flex-1">{q}</span>
              </summary>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mt-2 ml-4 pl-2 border-l-2 border-gray-100">{a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* 近隣エリア: 内部リンク + 回遊 (SEO) */}
      <RelatedAreas areas={relatedAreas} prefectureName={prefName} currentCat={catSlug} />
    </div>
  );
}
