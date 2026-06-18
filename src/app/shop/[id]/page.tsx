import { getShopById, getGirlsByShop, getDepartedGirlsByShop, getReviewsByShop, getNearbyShops, getRelatedAreas, prefectureSlugToName, CATEGORY_COLORS, getShopComments, getShopGenuineReviewStats, getBakusaiCommentCount } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import RealScore from '@/components/RealScore';
import GirlSortFilter from '@/components/GirlSortFilter';
import GirlImage from '@/components/GirlImage';
import FeedbackButton from '@/components/FeedbackButton';
import AdBanner from '@/components/AdBanner';
import RelatedGuides from '@/components/RelatedGuides';
import RelatedAreas from '@/components/RelatedAreas';
import { generateAlternateNames } from '@/lib/altNames';
import type { Metadata } from 'next';

export const revalidate = 7200; // 2026-05-17: 30min → 2h (ISR rebuild storm 防止 / Render Starter 0.5CPU 救済)

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const shop = getShopById(parseInt(params.id));
  if (!shop) return {};
  const reviewCount = shop.review_count || 0;
  const girlCount = shop.girl_count || 0;
  const girlCountLabel = girlCount === 100 ? '100+' : String(girlCount);
  const realPct = shop.real_pct != null && shop.real_pct >= 0 ? shop.real_pct : null;
  // Google SERP は 30字前後で title をカット。layout.tsx の `%s｜パネマジ掲示板` (8字) と
  // 合わせ、page 側 title は 22-24 字目安。
  // 🎯 2026-06-03 GSC: 「{店名}掲示板」が最大流入クエリ(1,014クエリ/27,818imp/CTR4.49%/中央7位=既に1ページ目)。
  //    旧 title は先頭が「口コミ・パネマジ度」で "掲示板" はサフィックス末尾(SERPで切れる位置)にしか無く、
  //    検索語が非露出でCTRを取りこぼしていた → 店名直後に「掲示板・口コミ」を前方寄せする
  //    (パネマジ度は description / OG / サフィックス「パネマジ掲示板」で担保)。
  const areaName = shop.area_name || '';
  const shopLen = shop.name.length;
  let title: string;
  if (shopLen <= 14 && areaName) {
    title = `${shop.name}の掲示板・口コミ【${areaName}】`;
  } else if (shopLen <= 22) {
    title = `${shop.name}の掲示板・口コミ`;
  } else {
    title = `${shop.name} 掲示板`;
  }
  const bkCount = getBakusaiCommentCount(shop.id);
  const description = `${shop.name}${areaName ? `(${areaName})` : ''}の口コミ掲示板。パネル写真と実物の一致度をチェック。${realPct !== null ? `パネル通り率${realPct}%。` : ''}在籍${girlCountLabel}人${reviewCount > 0 ? `・口コミ${reviewCount}件` : ''}${bkCount > 0 ? `・掲示板の声${bkCount}件` : ''}。`;
  const ogParams = new URLSearchParams({
    name: shop.name,
    shop: shop.area_name || '',
    ...(realPct !== null ? { score: String(realPct) } : {}),
    category: shop.category || '',
  });
  const ogImage = `https://panemaji.com/api/og?${ogParams.toString()}`;
  // thin content shop は noindex (GSC indexing 改善):
  //   - girls < 3 AND reviews = 0 → 8,335 件 (44%) を de-prioritize
  //   - sitemap からも除外済 (queries.ts SHOP_QUALITY_FILTER)
  // 効果: Google が低品質 URL を「クロール済み・未インデックス」 化、 全体 index 率向上
  const isThinContent = girlCount < 3 && reviewCount === 0;

  return {
    title,
    description,
    alternates: {
      canonical: `https://panemaji.com/shop/${params.id}`,
    },
    robots: isThinContent ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: `https://panemaji.com/shop/${params.id}`,
      siteName: 'パネマジ掲示板',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function ShopPage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const shopId = parseInt(params.id);
  if (isNaN(shopId)) notFound();

  const shop = getShopById(shopId);
  if (!shop) notFound();

  const query = searchParams.q || '';
  const girls = getGirlsByShop(shopId, query || undefined);
  const departedGirls = getDepartedGirlsByShop(shopId);
  const latestReviews = getReviewsByShop(shopId, 5);
  // 外部掲示板(爆サイ)の声: 先頭5件SSR公開 + 残りは会員ゲート。新しい順に並べる
  const bakusaiComments = getShopComments(shopId, 50)
    .filter((c) => String(c.browser_id || '').startsWith('ext-bakusai'))
    .reverse();
  // 構造化データ専用: 会員生口コミのみ集計(外部転載 ext-* を schema.org に出さない)
  const genuineStats = getShopGenuineReviewStats(shopId);
  const nearbyShops = getNearbyShops(shop.area_id, shopId, shop.category, 5);
  // SEO: 同 prefecture の他エリア (現在の area を除外) — internal linking 強化
  const relatedAreas = shop.area_prefecture
    ? getRelatedAreas(shop.area_prefecture, shop.area_id, 8)
    : [];
  const prefName = shop.area_prefecture ? prefectureSlugToName(shop.area_prefecture) : '';

  const matchCount = shop.panel_match_count || 0;
  const diffCount = shop.panel_diff_count || 0;
  const jiraiCount = shop.jirai_count || 0;
  const totalReviews = shop.review_count || 0;
  const girlCount = shop.girl_count || 0;
  const girlCountLabel = girlCount === 100 ? '100+' : String(girlCount);

  // Serialize girls for client component
  const girlsData = girls.map((g) => ({
    id: g.id,
    name: g.name,
    age: g.age,
    height: g.height,
    bust: g.bust,
    waist: g.waist,
    hip: g.hip,
    cup: g.cup,
    image_url: g.image_url,
    review_count: g.review_count || 0,
    panel_match_count: g.panel_match_count || 0,
    panel_diff_count: g.panel_diff_count || 0,
    jirai_count: g.jirai_count || 0,
    real_pct: g.real_pct ?? -1,
  }));

  // JSON-LD LocalBusiness structured data
  const alternateNames = generateAlternateNames(shop.name);
  // 最新口コミを Review schema に 流用 (rich result 用)。会員生口コミのみ(外部転載 ext-*/ch-*/x-import-* を除外)
  const ratingMap: Record<string, number> = { panel_match: 5, panel_diff: 3, jirai: 1 };
  const genuineLatest = latestReviews.filter((r) => {
    const b = (r as { browser_id?: string | null }).browser_id;
    return !b || (!b.startsWith('ext-') && !b.startsWith('ch-') && !b.startsWith('x-import-'));
  });
  const shopReviewsJsonLd = genuineLatest.slice(0, 5).map(r => ({
    '@type': 'Review' as const,
    author: { '@type': 'Person' as const, name: '匿名ユーザー' },
    datePublished: r.created_at?.substring(0, 10),
    reviewRating: {
      '@type': 'Rating' as const,
      ratingValue: ratingMap[r.panel_rating] || 3,
      bestRating: 5,
      worstRating: 1,
    },
    ...(r.comment ? { reviewBody: r.comment.slice(0, 200) } : {}),
  }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    ...(alternateNames.length > 0 ? { alternateName: alternateNames } : {}),
    url: `https://panemaji.com/shop/${shop.id}`,
    description: shop.description || `${shop.area_name}エリアの風俗店「${shop.name}」`,
    ...(shop.area_name ? { areaServed: shop.area_name } : {}),
    // EEAT: 鮮度シグナル — last_seen_at から dateModified
    ...(shop.last_seen_at ? { dateModified: shop.last_seen_at } : {}),
    // 構造化データは会員生口コミのみ(外部転載 ext-* を除外 = レビュースパムポリシー対策)
    ...(genuineStats.reviewCount > 0 && genuineStats.realPct >= 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.round(genuineStats.realPct / 20 * 10) / 10,
        bestRating: 5,
        worstRating: 1,
        reviewCount: genuineStats.reviewCount,
      },
    } : {}),
    // 最新口コミを 5 件まで Review schema として 添える
    ...(shopReviewsJsonLd.length > 0 ? { review: shopReviewsJsonLd } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: 'https://panemaji.com' },
      { '@type': 'ListItem', position: 2, name: shop.area_name || 'エリア', item: `https://panemaji.com/area/${shop.area_slug}` },
      { '@type': 'ListItem', position: 3, name: shop.name, item: `https://panemaji.com/shop/${shop.id}` },
    ],
  };

  // FAQ structured data (リッチスニペット用)
  const faqQuestions: Array<{ q: string; a: string }> = [];
  faqQuestions.push({
    q: `${shop.name}の在籍嬢は何人ですか？`,
    a: `${shop.name}には現在${girlCountLabel}人の女性が在籍しています。${totalReviews > 0 ? `口コミは${totalReviews}件あります。` : ''}最新の在籍情報は当ページの一覧でご確認ください。`,
  });
  if (shop.area_name) {
    faqQuestions.push({
      q: `${shop.name}はどこにありますか？`,
      a: `${shop.name}は${shop.area_name}エリアの${shop.category || '風俗店'}です。`,
    });
  }
  if (typeof shop.real_pct === 'number' && shop.real_pct >= 0) {
    faqQuestions.push({
      q: `${shop.name}のパネル通り率は？`,
      a: `${shop.name}のパネル通り率(パネマジ度)は${shop.real_pct}%です。${totalReviews}件の口コミから集計しています。`,
    });
  }
  faqQuestions.push({
    q: `${shop.name}の口コミはどこで見られますか？`,
    a: `${shop.name}の最新口コミは当ページ「${shop.name}の口コミ掲示板・パネマジ度」で確認できます。実物との一致度を投稿いただけます。`,
  });
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqQuestions.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="text-xs sm:text-sm text-gray-500 break-words">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/area/${shop.area_slug}`} className="hover:text-blue-600">{shop.area_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800 break-words">{shop.name}</span>
      </nav>

      {/* Shop Header - Enhanced */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{shop.name}<span className="sr-only">の口コミ掲示板・パネマジ度</span></h1>
            <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
              <span className={`inline-block text-xs px-2 py-0.5 rounded shrink-0 ${CATEGORY_COLORS[shop.category] || 'bg-gray-100 text-gray-700'}`}>
                {shop.category}
              </span>
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {shop.area_name}
              </span>
            </div>
            {shop.description && (
              <p className="text-gray-600 mt-2 text-sm break-words">{shop.description}</p>
            )}
            {/* 最終更新日 (EEAT: 鮮度シグナル) */}
            {shop.last_seen_at && (
              <p className="text-[10px] sm:text-xs text-gray-400 mt-2">
                最終更新: <time dateTime={shop.last_seen_at}>{new Date(shop.last_seen_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</time>
              </p>
            )}
            {/* External Link */}
            {shop.source_url && (
              <a
                href={shop.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition-colors no-underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                予約サイトを見る
              </a>
            )}
            <FeedbackButton targetType="shop" targetId={shop.id} />
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <RealScore pct={shop.real_pct ?? -1} reviewCount={shop.review_count || 0} size="lg" />
            <div className="text-right">
              <p className="text-xs sm:text-sm text-gray-500">
                在籍 <span className="text-2xl sm:text-3xl text-blue-600 font-bold">{shop.girl_count === 100 ? '100+' : shop.girl_count}</span> 人
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                口コミ <span className="text-lg sm:text-xl text-blue-600 font-bold">{shop.review_count}</span> 件
              </p>
              {bakusaiComments.length > 0 && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  掲示板 <span className="text-lg sm:text-xl text-pink-600 font-bold">{bakusaiComments.length}</span> 件
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panel Rating Distribution */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">パネマジ度分布</h3>
        {totalReviews === 0 ? (
          <p className="text-gray-400 text-sm">まだ口コミがありません</p>
        ) : (
          <div className="space-y-3">
            <DistributionRow label="パネル通り" count={matchCount} total={totalReviews} color="bg-green-500" />
            <DistributionRow label="許せる" count={diffCount} total={totalReviews} color="bg-yellow-400" />
            <DistributionRow label="盛りすぎ" count={jiraiCount} total={totalReviews} color="bg-red-500" />
            <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
              全{totalReviews}件の口コミ → 総合パネマジ度 <span className="font-bold text-blue-600">{shop.real_pct != null && shop.real_pct >= 0 ? `${shop.real_pct}%` : '-'}</span>
            </p>
          </div>
        )}
      </div>

      {/* 外部掲示板(爆サイ等)の声 — 先頭5件SSR公開 + 残りは会員ゲート */}
      {bakusaiComments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-1">{shop.name}の掲示板の声</h2>
          <p className="text-xs text-gray-400 mb-4">外部掲示板で見つかった「パネマジ」(パネル写真と実物の違い)に関する声を引用しています。</p>
          <div className="space-y-3">
            {bakusaiComments.slice(0, 5).map((c) => (
              <div key={c.id} className="p-3 bg-gray-50 rounded-lg border-l-2 border-pink-200">
                <p className="text-gray-700 text-xs sm:text-sm break-words whitespace-pre-wrap">{c.comment}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">外部掲示板より{c.created_at ? ` · ${c.created_at.substring(0, 10)}` : ''}</p>
              </div>
            ))}
          </div>
          {bakusaiComments.length > 5 && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-center">
              <a href={`/signup?next=/shop/${shopId}`} className="inline-block text-sm text-pink-600 font-medium hover:underline">
                残り{bakusaiComments.length - 5}件の掲示板の声を見る（無料会員登録）→
              </a>
            </div>
          )}
        </div>
      )}

      {/* Latest Reviews */}
      {latestReviews.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">{shop.name}の掲示板</h3>
          <div className="space-y-3">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg"
              >
                <PanelRatingBadge rating={review.panel_rating} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm break-words">
                    <a href={`/girl/${review.girl_id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {review.girl_name}
                    </a>
                    {String((review as { browser_id?: string | null }).browser_id || '').startsWith('ext-bakusai') && (
                      <span className="ml-1.5 text-[10px] text-gray-400 font-normal">外部掲示板より</span>
                    )}
                  </p>
                  {review.comment && (
                    <p className="text-gray-600 text-xs sm:text-sm mt-1 break-words line-clamp-2">
                      {review.comment}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {review.created_at?.substring(0, 10) || review.created_at}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Girl Search */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <form action={`/shop/${shopId}`} method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="女の子の名前で検索..."
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

      <AdBanner size="rectangle" context={{ area: shop.area_name || undefined, category: shop.category || undefined }} />

      {/* Girls List with Sort/Filter */}
      <GirlSortFilter girls={girlsData} query={query} />

      {/* 退店した可能性のある女性 (最下部・「退店」タグ付き) */}
      {departedGirls.length > 0 && (
        <details className="bg-gray-50 rounded-lg p-4">
          <summary className="cursor-pointer text-sm font-bold text-gray-600 flex items-center gap-2">
            <span className="inline-block bg-gray-300 text-gray-700 text-xs px-2 py-0.5 rounded">退店</span>
            退店した可能性のある女性 ({departedGirls.length})
          </summary>
          <p className="text-xs text-gray-500 mt-2">自動巡回で在籍が確認できなくなった女性です（過去の口コミは参考用に残しています）。</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {departedGirls.map((g) => (
              <a key={g.id} href={`/girl/${g.id}`} className="block bg-white rounded-lg border border-gray-200 p-2 opacity-75 hover:opacity-100 no-underline">
                <div className="relative inline-block">
                  <GirlImage src={g.image_url} alt={g.name} size={120} />
                  <span className="absolute top-1 left-1 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded">退店</span>
                </div>
                <p className="text-sm font-bold text-gray-700 truncate mt-1">{g.name}</p>
                <p className="text-[10px] text-gray-400">口コミ {g.review_count ?? 0}件</p>
              </a>
            ))}
          </div>
        </details>
      )}

      {/* Nearby Shops */}
      {nearbyShops.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            近くの店舗
          </h3>
          <div className="space-y-2">
            {nearbyShops.map((ns) => {
              const nsPct = ns.real_pct ?? -1;
              return (
                <a
                  key={ns.id}
                  href={`/shop/${ns.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{ns.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[ns.category] || 'bg-gray-100 text-gray-700'}`}>
                        {ns.category}
                      </span>
                      <span className="text-xs text-gray-500">{ns.girl_count ?? 0}人在籍</span>
                      <span className="text-xs text-gray-400">{ns.review_count ?? 0}件口コミ</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {nsPct >= 0 ? (
                      <span className={`text-sm font-bold ${nsPct >= 70 ? 'text-green-600' : nsPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {nsPct}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">---</span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <RelatedGuides areaSlug={shop.area_slug} />

      {/* よくある質問 (SEO: FAQ schema と一致する visible 表示) */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-5">
        <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">{shop.name}に関する よくある質問</h2>
        <div className="space-y-2">
          {faqQuestions.map((f, i) => (
            <details key={i} className="group border-b border-gray-100 last:border-b-0 pb-2 last:pb-0">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors py-1.5 list-none flex items-start gap-1.5">
                <span className="text-blue-500 text-xs mt-0.5 group-open:rotate-90 transition-transform inline-block">▶</span>
                <span className="flex-1">{f.q}</span>
              </summary>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mt-2 ml-4 pl-2 border-l-2 border-gray-100">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* 同 prefecture の他エリア (内部リンク + 回遊・SEO) */}
      {relatedAreas.length > 0 && prefName && (
        <RelatedAreas areas={relatedAreas} prefectureName={prefName} />
      )}
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
