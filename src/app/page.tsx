import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, isValidCategory, prefectureSlugToName, getStats, getPrefectures } from '@/lib/queries';

export const revalidate = 1800; // 5min → 30min (memory-aware ISR / Render Starter 512MB)

export default function Home({ searchParams }: { searchParams: { pref?: string; cat?: string } }) {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;

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
  // prefName を 使ってない警告抑制 (現状 ユーザー側だけが必要)
  void prefectureSlugToName(prefSlug);

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
      {/* 2026-05-12: 「最近評価された嬢」セクション削除 — HomeContent の「最新の口コミ」と内容重複。 home 速度改善も兼ねる。 */}
      <HomeContent prefSlug={prefSlug} catSlug={catSlug} />
    </>
  );
}
