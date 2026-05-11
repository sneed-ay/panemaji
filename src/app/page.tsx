import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, isValidCategory, getRecentlyReviewedGirls, prefectureSlugToName, getStats, getPrefectures } from '@/lib/queries';
import GirlImage from '@/components/GirlImage';
import PanelRatingBadge from '@/components/PanelRatingBadge';

export const revalidate = 1800; // 5min → 30min (memory-aware ISR / Render Starter 512MB)

export default function Home({ searchParams }: { searchParams: { pref?: string; cat?: string } }) {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;
  const recentGirls = getRecentlyReviewedGirls(8, prefSlug);
  const prefName = prefectureSlugToName(prefSlug);

  // home page の CollectionPage + FAQ schema (副作用ゼロ・追加のみ)
  const stats = getStats();
  const prefectures = getPrefectures();
  const homeCollectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'パネマジ掲示板 — 全国の風俗 口コミ・パネマジ度 比較',
    url: 'https://panemaji.com',
    description: '全国47都道府県の風俗店の パネル写真と実物の一致度 (パネマジ度) を ユーザー口コミで チェック。 デリヘル・ソープ・メンエス・ヘルスのリアル度を比較。',
    isPartOf: { '@type': 'WebSite', name: 'パネマジ掲示板', url: 'https://panemaji.com' },
    inLanguage: 'ja-JP',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: prefectures.length,
      itemListElement: prefectures.slice(0, 47).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://panemaji.com/${p.slug}`,
        name: p.name,
      })),
    },
  };

  const homeFaqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'パネマジ掲示板とは？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `風俗のパネル写真と実物の一致度 (パネマジ度) を ユーザー口コミで チェックできる比較サイトです。 全国47都道府県の デリヘル・ソープ・メンエス・ヘルス店、 ${stats.shopCount.toLocaleString()}店舗・${stats.girlCount.toLocaleString()}人の在籍嬢・${stats.reviewCount.toLocaleString()}件の口コミを 掲載しています。`,
        },
      },
      {
        '@type': 'Question',
        name: 'パネマジ度はどうやって決まる？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'ユーザーが投稿する 3 段階の口コミ評価「パネル通り / 多少違う / 詐欺レベル (盛りすぎ)」を 集計し、 各嬢・各店舗のパネル通り率を 算出しています。 評価数が 多いほど信頼性が高くなります。',
        },
      },
      {
        '@type': 'Question',
        name: '対応エリア / カテゴリは？',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '全国47都道府県を MECE な 325エリアに 分けて 網羅。 デリヘル / ソープ / ヘルス / ホテヘル / メンエス / エステ・アロマ の 6 カテゴリを カバーしています。',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeCollectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }} />
      <HomeContent prefSlug={prefSlug} catSlug={catSlug} />

      {/* Recently Reviewed Girls - server rendered */}
      {recentGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 mt-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
            {prefName}で最近評価された嬢
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentGirls.map((girl) => {
              const realPct = girl.real_pct ?? -1;
              const hasReviews = (girl.review_count ?? 0) > 0 && realPct >= 0;
              const pctColor = realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600';
              return (
                <a
                  key={girl.id}
                  href={`/girl/${girl.id}`}
                  className="block bg-gray-50 hover:bg-blue-50 rounded-lg p-2 sm:p-3 transition-colors no-underline"
                >
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <GirlImage src={girl.image_url} alt={girl.name} size={64} />
                    <div className="min-w-0 w-full">
                      <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{girl.name}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">{girl.shop_name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{girl.area_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <PanelRatingBadge rating={girl.panel_rating} size="sm" />
                      {hasReviews && (
                        <span className={`text-xs font-bold ${pctColor}`}>{realPct}%</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{girl.review_count ?? 0}件の口コミ</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
