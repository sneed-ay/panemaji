import HomeContent from '@/components/HomeContent';
import RelatedGuides from '@/components/RelatedGuides';
import { isValidPrefecture, isValidCategory, prefectureSlugToName, getAreasByPrefecture, getStatsByPrefecture, getShopsByBakusaiComments } from '@/lib/queries';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 7200; // 2026-05-17: 30min → 2h (ISR rebuild storm 防止 / Render Starter 0.5CPU 救済)

export function generateMetadata({ params }: { params: { prefecture: string } }): Metadata {
  if (!isValidPrefecture(params.prefecture)) return {};
  const prefName = prefectureSlugToName(params.prefecture);
  // 2026-06-03 GSC: 都道府県descに掲載数(数字)を入れCTR訴求 (FAQで既に同クエリ使用済=追加コスト軽微)
  const stats = getStatsByPrefecture(params.prefecture);
  // 口コミ数は閾値以上のみ表示 (鳥取/島根等の小規模県で「口コミ0件」がSERPで薄く見える逆効果を防ぐ)
  const reviewPart = stats.reviewCount >= 30 ? `・口コミ${stats.reviewCount.toLocaleString()}件` : '';
  return {
    title: `${prefName}の風俗・ソープ・メンエス 口コミ掲示板・パネマジ度`,
    description: `${prefName}の風俗${stats.shopCount.toLocaleString()}店舗${reviewPart}の掲示板。パネル写真と実物の一致度(パネマジ度)をチェック。${prefName}のデリヘル・ソープ・メンエス・ヘルスのリアル評判・在籍嬢一覧・ランキング。`,
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
  // 掲示板の声(ext-bakusai)が多い店 — 県全体でパネマジ言及の多い店を回遊導線に(表示のみ・schema非掲載)
  const bbsShops = getShopsByBakusaiComments({ prefectureSlug: params.prefecture }, 10);

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
      {/* {県} 掲示板で話題の店(ext-bakusai言及が多い順) — 回遊・内部リンク強化(schema非掲載) */}
      {bbsShops.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 mt-5">
          <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">{prefName} 掲示板で話題の店</h2>
          <div className="space-y-2">
            {bbsShops.map((shop) => (
              <a key={shop.id} href={`/shop/${shop.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-pink-50 transition-colors no-underline">
                <span className="inline-flex items-center justify-center shrink-0 bg-pink-100 text-pink-700 text-[10px] font-bold rounded-full px-2 h-6">掲示板{shop.bakusai_count}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{shop.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0 hidden sm:inline">{shop.area_name}</span>
                {(shop.real_pct ?? -1) >= 0 && (
                  <span className={`text-xs shrink-0 font-bold ${(shop.real_pct ?? 0) >= 70 ? 'text-green-600' : (shop.real_pct ?? 0) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{shop.real_pct}%</span>
                )}
              </a>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">外部掲示板でパネマジ(パネル写真と実物)について言及が多い店です。</p>
        </div>
      )}
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
      {/* 関連ガイド記事 — 都道府県ページ(高権威)から地域ガイドへ内部リンク (2026-06-03 SEO監査: pref↔guide 双方向化) */}
      <div className="mt-5">
        <RelatedGuides prefSlug={params.prefecture} max={4} />
      </div>
    </>
  );
}
