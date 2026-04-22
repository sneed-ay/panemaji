import { getGirlWithReviewStats, getReviewsByGirl, getOtherGirlsInShopExpanded, getPopularGirlsInArea, getShopAreaId, getShopById } from '@/lib/queries';
import { notFound } from 'next/navigation';
import RealScore from '@/components/RealScore';
import GirlImage from '@/components/GirlImage';
import ShareButtons from '@/components/ShareButtons';
import GirlPageClient from './GirlPageClient';
import AdBanner from '@/components/AdBanner';
import { generateGirlAlternateNames } from '@/lib/altNames';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const girl = getGirlWithReviewStats(parseInt(params.id));
  if (!girl) return {};
  const shop = getShopById(girl.shop_id);
  const title = `${girl.name}（${girl.shop_name}）のパネマジ度・口コミ`;
  const description = `${girl.name}さんはパネル通り？パネマジ度の口コミ・評価をチェック。${girl.age ? girl.age + '歳' : ''}${girl.bust ? ' ' + girl.bust + '(' + (girl.cup || '') + ')' : ''}`;
  const realPct = girl.real_pct != null && girl.real_pct >= 0 ? girl.real_pct : null;
  const ogParams = new URLSearchParams({
    name: girl.name,
    shop: girl.shop_name || '',
    ...(realPct !== null ? { score: String(realPct) } : {}),
    category: shop?.category || '',
  });
  const ogImage = `https://panemaji.com/api/og?${ogParams.toString()}`;
  return {
    title,
    description,
    alternates: {
      canonical: `https://panemaji.com/girl/${params.id}`,
    },
    openGraph: {
      title,
      description,
      url: `https://panemaji.com/girl/${params.id}`,
      siteName: 'パネマジ掲示板',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function GirlPage({ params }: { params: { id: string } }) {
  const girlId = parseInt(params.id);
  if (isNaN(girlId)) notFound();

  const girl = getGirlWithReviewStats(girlId);
  if (!girl) notFound();

  const reviews = getReviewsByGirl(girlId);
  const otherGirls = getOtherGirlsInShopExpanded(girl.shop_id, girlId, 6);
  const areaId = getShopAreaId(girl.shop_id);
  const popularGirls = areaId ? getPopularGirlsInArea(areaId, girlId, 4) : [];

  // Vote breakdown
  const matchCount = girl.panel_match_count || 0;
  const diffCount = girl.panel_diff_count || 0;
  const jiraiCount = girl.jirai_count || 0;
  const totalVotes = matchCount + diffCount + jiraiCount;

  // JSON-LD structured data for reviews
  const ratingMap: Record<string, number> = { panel_match: 5, panel_diff: 3, jirai: 1 };
  const jsonLdReviews = reviews.map((r) => ({
    '@type': 'Review' as const,
    author: { '@type': 'Person' as const, name: '匿名ユーザー' },
    datePublished: r.created_at?.substring(0, 10) || r.visit_date,
    reviewRating: {
      '@type': 'Rating' as const,
      ratingValue: ratingMap[r.panel_rating] || 3,
      bestRating: 5,
      worstRating: 1,
    },
    ...(r.comment ? { reviewBody: r.comment.slice(0, 200) } : {}),
  }));

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (ratingMap[r.panel_rating] || 3), 0) / reviews.length
    : undefined;

  const alternateNames = generateGirlAlternateNames(girl.name, girl.shop_name);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: girl.name,
    ...(alternateNames.length > 0 ? { alternateName: alternateNames } : {}),
    url: `https://panemaji.com/girl/${girl.id}`,
    ...(girl.image_url ? { image: girl.image_url } : {}),
    ...(reviews.length > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.round(avgRating! * 10) / 10,
        bestRating: 5,
        worstRating: 1,
        reviewCount: reviews.length,
      },
      review: jsonLdReviews.slice(0, 10),
    } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'トップ', item: 'https://panemaji.com' },
      { '@type': 'ListItem', position: 2, name: girl.area_name || 'エリア', item: `https://panemaji.com/area/${girl.area_slug}` },
      { '@type': 'ListItem', position: 3, name: girl.shop_name, item: `https://panemaji.com/shop/${girl.shop_id}` },
      { '@type': 'ListItem', position: 4, name: girl.name, item: `https://panemaji.com/girl/${girl.id}` },
    ],
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
      <nav className="text-xs sm:text-sm text-gray-500 break-words">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/area/${girl.area_slug}`} className="hover:text-blue-600">{girl.area_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/shop/${girl.shop_id}`} className="hover:text-blue-600 break-words">{girl.shop_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800 break-words">{girl.name}</span>
      </nav>

      <div className="flex items-center justify-between gap-2">
        <div />
        <ShareButtons
          url={`/girl/${girl.id}`}
          text={`${girl.name}（${girl.shop_name}）のリアル度をチェック！ #パネマジ掲示板`}
          variant="compact"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-4">
              <GirlImage src={girl.image_url} alt={girl.name} size={200} className="hidden sm:flex" />
              <GirlImage src={girl.image_url} alt={girl.name} size={120} className="flex sm:hidden" />
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{girl.name}</h2>
                {/* Shop link - prominent */}
                <a
                  href={`/shop/${girl.shop_id}`}
                  className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs sm:text-sm font-medium hover:bg-blue-100 transition-colors no-underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {girl.shop_name} に在籍
                </a>
                <p className="text-gray-500 mt-1 text-xs">
                  {girl.area_name}
                </p>
              {girl.twitter_url && (
                <a
                  href={girl.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-black text-white rounded-full text-xs hover:bg-gray-800 transition-colors no-underline"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  <span>{girl.twitter_url.replace('https://x.com/', '@')}</span>
                </a>
              )}
              </div>
            </div>
            <div className="shrink-0">
              <RealScore pct={girl.real_pct ?? -1} reviewCount={girl.review_count || 0} size="lg" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {girl.age && (
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-gray-400">年齢</span>
                <span className="ml-2 font-medium text-gray-800">{girl.age}歳</span>
              </div>
            )}
            {girl.height && (
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-gray-400">身長</span>
                <span className="ml-2 font-medium text-gray-800">{girl.height}cm</span>
              </div>
            )}
            {girl.bust && girl.cup && (
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-gray-400">バスト</span>
                <span className="ml-2 font-medium text-gray-800">{girl.bust}({girl.cup}カップ)</span>
              </div>
            )}
            {girl.waist && (
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-gray-400">ウエスト</span>
                <span className="ml-2 font-medium text-gray-800">{girl.waist}cm</span>
              </div>
            )}
            {girl.hip && (
              <div className="bg-gray-50 rounded-lg p-2">
                <span className="text-gray-400">ヒップ</span>
                <span className="ml-2 font-medium text-gray-800">{girl.hip}cm</span>
              </div>
            )}
          </div>

          {/* Vote Breakdown with Progress Bars */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">評価内訳</h3>
            {totalVotes === 0 ? (
              <p className="text-gray-400 text-sm">まだ投票がありません</p>
            ) : (
              <div className="space-y-2.5">
                <VoteBreakdownRow
                  label="パネル通り"
                  count={matchCount}
                  total={totalVotes}
                  color="bg-green-500"
                  textColor="text-green-700"
                />
                <VoteBreakdownRow
                  label="許せる"
                  count={diffCount}
                  total={totalVotes}
                  color="bg-yellow-400"
                  textColor="text-yellow-700"
                />
                <VoteBreakdownRow
                  label="盛りすぎ"
                  count={jiraiCount}
                  total={totalVotes}
                  color="bg-red-500"
                  textColor="text-red-700"
                />
                <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                  全{totalVotes}件の投票
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <GirlPageClient
        girlId={girl.id}
        girlName={girl.name}
        shopName={girl.shop_name || ''}
        initialReviews={reviews}
        otherGirls={otherGirls.slice(0, 3).map(g => ({
          id: g.id,
          name: g.name,
          image_url: g.image_url,
          review_count: g.review_count || 0,
        }))}
      />

      <AdBanner size="rectangle" context={{ area: girl.area_name || undefined }} />

      {/* Other Girls in Same Shop */}
      {otherGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            {girl.shop_name} の他の女性
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {otherGirls.map((g) => (
              <a
                key={g.id}
                href={`/girl/${g.id}`}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
              >
                <GirlImage src={g.image_url} alt={g.name} size={72} />
                <span className="text-sm font-medium text-gray-800 text-center break-words line-clamp-1">{g.name}</span>
                <span className="text-xs text-gray-400">
                  {(g.review_count || 0) === 0 ? '口コミ募集中' : `口コミ ${g.review_count}件`}
                </span>
              </a>
            ))}
          </div>
          <a
            href={`/shop/${girl.shop_id}`}
            className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {girl.shop_name} の在籍一覧を見る →
          </a>
        </div>
      )}

      {/* Popular Girls in Same Area */}
      {popularGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            {girl.area_name} で人気の女性
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {popularGirls.map((g) => (
              <a
                key={g.id}
                href={`/girl/${g.id}`}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
              >
                <GirlImage src={g.image_url} alt={g.name} size={72} />
                <span className="text-sm font-medium text-gray-800 text-center break-words line-clamp-1">{g.name}</span>
                <span className="text-xs text-gray-500 text-center line-clamp-1">{g.shop_name}</span>
                <span className="text-xs text-gray-400">口コミ {g.review_count}件</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VoteBreakdownRow({ label, count, total, color, textColor }: {
  label: string;
  count: number;
  total: number;
  color: string;
  textColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm w-24 shrink-0 font-medium ${textColor}`}>{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
        {pct > 0 && (
          <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
        )}
      </div>
      <span className="text-sm text-gray-600 w-24 shrink-0 text-right">{count}件 ({pct}%)</span>
    </div>
  );
}
