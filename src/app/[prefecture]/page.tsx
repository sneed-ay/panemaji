import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, isValidCategory, prefectureSlugToName, getAreasByPrefecture, getStatsByPrefecture } from '@/lib/queries';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 1800; // 5min → 30min (memory-aware ISR / Render Starter 512MB)

export function generateMetadata({ params }: { params: { prefecture: string } }): Metadata {
  if (!isValidPrefecture(params.prefecture)) return {};
  const prefName = prefectureSlugToName(params.prefecture);
  return {
    title: `${prefName}の風俗・ソープ・メンエス 口コミ掲示板・パネマジ度`,
    description: `${prefName}の風俗店舗の口コミ掲示板。パネル写真と実物の一致度（パネマジ度）をチェック。${prefName}のデリヘル・ソープ・メンエス・ヘルス店のリアルな評判・在籍嬢一覧・ランキングがわかる。`,
    alternates: { canonical: `https://panemaji.com/${params.prefecture}` },
  };
}

export default function PrefecturePage({ params, searchParams }: { params: { prefecture: string }; searchParams: { cat?: string } }) {
  // Only handle valid prefecture slugs; let other routes pass through
  if (!isValidPrefecture(params.prefecture)) {
    notFound();
  }

  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;
  const prefName = prefectureSlugToName(params.prefecture);
  const areas = getAreasByPrefecture(params.prefecture);
  const stats = getStatsByPrefecture(params.prefecture);
  const url = `https://panemaji.com/${params.prefecture}`;

  // CollectionPage + ItemList (areas) — 副作用ゼロ、 構造化データ追加のみ
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${prefName}の風俗 口コミ・掲示板・パネマジ度`,
    url,
    isPartOf: { '@type': 'WebSite', name: 'パネマジ掲示板', url: 'https://panemaji.com' },
    about: { '@type': 'Place', name: prefName, address: { '@type': 'PostalAddress', addressRegion: prefName, addressCountry: 'JP' } },
    ...(areas.length > 0 ? {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: areas.length,
        itemListElement: areas.slice(0, 30).map((a, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://panemaji.com/area/${a.slug}`,
          name: a.name,
        })),
      },
    } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: 'https://panemaji.com' },
      { '@type': 'ListItem', position: 2, name: prefName, item: url },
    ],
  };

  // FAQ schema — rich result 候補 (副作用ゼロ)
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `${prefName}でパネマジを 見破る方法は？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `パネマジ掲示板では ${prefName}内の各風俗店・嬢ごとの「パネル写真と実物の一致度 (パネマジ度)」をユーザー口コミから集計しています。 リアル度の高い店舗 / 嬢を 選ぶことで パネマジ被害を 大幅に減らせます。`,
        },
      },
      {
        '@type': 'Question',
        name: `${prefName}には どんなエリアがある？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: areas.length > 0
            ? `${prefName}には現在 ${areas.length} エリアの店舗情報を 掲載しています。 ${areas.slice(0, 5).map(a => a.name).join('、')}など 主要エリアを 中心に カバーしています。`
            : `${prefName}は 現在エリア情報を 整備中です。`,
        },
      },
      {
        '@type': 'Question',
        name: `${prefName}の掲載店舗数・口コミ数は？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${prefName}には現在 ${stats.shopCount.toLocaleString()} 店舗、 ${stats.girlCount.toLocaleString()} 人の在籍嬢、 ${stats.reviewCount.toLocaleString()} 件のユーザー口コミを 掲載しています (パネマジ掲示板 調べ)。`,
        },
      },
      {
        '@type': 'Question',
        name: `${prefName}の店舗カテゴリは？`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `${prefName}では デリヘル、 ソープ、 ヘルス、 ホテヘル、 メンエス、 エステ・アロマの 6 カテゴリの店舗を 掲載しています。 各カテゴリで パネマジ度ランキング・口コミ・在籍嬢情報を ご覧いただけます。`,
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <HomeContent prefSlug={params.prefecture} catSlug={catSlug} />
    </>
  );
}
