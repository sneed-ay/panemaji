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
  // FAQ Q&A は schema + 視覚 UI で 共用
  const faqItems: Array<{ q: string; a: string }> = [
    {
      q: `${prefName}でパネマジを 見破る方法は？`,
      a: `パネマジ掲示板では ${prefName}内の各風俗店・嬢ごとの「パネル写真と実物の一致度 (パネマジ度)」をユーザー口コミから集計しています。 リアル度の高い店舗 / 嬢を 選ぶことで パネマジ被害を 大幅に減らせます。`,
    },
    {
      q: `${prefName}には どんなエリアがある？`,
      a: areas.length > 0
        ? `${prefName}には現在 ${areas.length} エリアの店舗情報を 掲載しています。 ${areas.slice(0, 5).map(a => a.name).join('、')}など 主要エリアを 中心に カバーしています。`
        : `${prefName}は 現在エリア情報を 整備中です。`,
    },
    {
      q: `${prefName}の掲載店舗数・口コミ数は？`,
      a: `${prefName}には現在 ${stats.shopCount.toLocaleString()} 店舗、 ${stats.girlCount.toLocaleString()} 人の在籍嬢、 ${stats.reviewCount.toLocaleString()} 件のユーザー口コミを 掲載しています (パネマジ掲示板 調べ)。`,
    },
    {
      q: `${prefName}の店舗カテゴリは？`,
      a: `${prefName}では デリヘル、 ソープ、 ヘルス、 ホテヘル、 メンエス、 エステ・アロマの 6 カテゴリの店舗を 掲載しています。 各カテゴリで パネマジ度ランキング・口コミ・在籍嬢情報を ご覧いただけます。`,
    },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <HomeContent prefSlug={params.prefecture} catSlug={catSlug} />
      {/* よくある質問 (SEO: FAQ schema と一致する visible 表示) */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-5 mt-5">
        <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">{prefName}に関する よくある質問</h2>
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
    </>
  );
}
