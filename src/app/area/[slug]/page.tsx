import { getAreaBySlug, getShopsByArea, prefectureSlugToName, isValidCategory, CATEGORY_COLORS, getPopularGirlsInAreaTop, getAreasByPrefecture, getRelatedAreas } from '@/lib/queries';
import { notFound } from 'next/navigation';
import RealScore from '@/components/RealScore';
import CategoryTabs from '@/components/CategoryTabs';
import GirlImage from '@/components/GirlImage';
import RelatedGuides from '@/components/RelatedGuides';
import RelatedAreas from '@/components/RelatedAreas';
import type { Metadata } from 'next';

export const revalidate = 1800; // 5min → 30min (memory-aware ISR / Render Starter 512MB)

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
  return {
    title,
    description: `${prefDisplayName} ${area.name}エリアの風俗店の口コミ掲示板。パネル写真と実物の一致度（パネマジ度）をチェック。${area.name}のデリヘル・ソープ・メンエス・ヘルスのリアル評判・在籍嬢ランキング。`,
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
  // SEO: 同 pref 内の他エリア (アクティブ店舗数の多い順 8件) — 内部リンク強化
  const relatedAreas = getRelatedAreas(prefSlug, area.id, 8);

  // CollectionPage + ItemList JSON-LD (rich result 対応・副作用ゼロ・追加のみ)
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${area.name}の風俗店 口コミ・掲示板・パネマジ度`,
    url: `https://panemaji.com/area/${params.slug}`,
    isPartOf: { '@type': 'WebSite', name: 'パネマジ掲示板', url: 'https://panemaji.com' },
    about: { '@type': 'Place', name: area.name, containedInPlace: { '@type': 'Place', name: prefName } },
    ...(shops.length > 0 ? {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: shops.length,
        itemListElement: shops.slice(0, 10).map((shop, i) => {
          const hasRating = (shop.review_count ?? 0) > 0 && (shop.real_pct ?? -1) >= 0;
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
              ratingValue: Math.round((shop.real_pct as number) / 20 * 10) / 10,
              bestRating: 5,
              worstRating: 0,
              reviewCount: shop.review_count,
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

  // FAQ JSON-LD — 検索結果の rich snippet 用 (副作用ゼロ、 schema のみ追加)
  // shops が空でも "近隣エリア" 系の質問は意味があるので 表示する
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `${area.name}でパネマジ (パネルマジック) を見破る方法は？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `パネマジ掲示板では ${area.name}エリアの 各店舗・嬢ごとに 実際の利用者の「パネル写真と実物の一致度 (パネマジ度)」を集計しています。 店舗ページでパネマジ度 (リアル度) を確認してから 予約することで パネマジ被害を回避できます。`,
        },
      },
      {
        '@type': 'Question',
        name: `${area.name}の風俗店の口コミはどこで見られる？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${area.name}の デリヘル・ソープ・メンエス・ヘルス各店舗の 口コミは パネマジ掲示板の各店舗ページで 閲覧できます。 ユーザー投稿のみで構成され、 パネル写真と実物の 一致度、 接客評価、 リピートしたいかなど 実利用者目線の 評価が 集まっています。`,
        },
      },
      {
        '@type': 'Question',
        name: `${area.name}で 在籍数が多い店舗は？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: shops.length > 0
            ? `${area.name}には現在 ${shops.length} 店舗を 掲載しています。 在籍嬢数が 多い順・パネマジ度 (リアル度) 高い順に 並び替えてご確認いただけます。`
            : `${area.name}は 現在掲載店舗がありません。 ${prefName}内の 他エリアから 探してみてください。`,
        },
      },
    ],
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

      {/* 近隣エリア: 内部リンク + 回遊 (SEO) */}
      <RelatedAreas areas={relatedAreas} prefectureName={prefName} currentCat={catSlug} />
    </div>
  );
}
