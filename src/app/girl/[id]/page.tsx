import { getGirlWithReviewStats, getReviewsByGirl } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBar from '@/components/PanelRatingBar';
import RealScore from '@/components/RealScore';
import GirlPageClient from './GirlPageClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const girl = getGirlWithReviewStats(parseInt(params.id));
  if (!girl) return {};
  return {
    title: `${girl.name}（${girl.shop_name}）のリアル度・口コミ`,
    description: `${girl.shop_name}の${girl.name}さんはパネル通り？リアル度の口コミ・評価をチェック。${girl.age ? girl.age + '歳' : ''}${girl.bust ? ' ' + girl.bust + '(' + (girl.cup || '') + ')' : ''}`,
  };
}

export default function GirlPage({ params }: { params: { id: string } }) {
  const girlId = parseInt(params.id);
  if (isNaN(girlId)) notFound();

  const girl = getGirlWithReviewStats(girlId);
  if (!girl) notFound();

  const reviews = getReviewsByGirl(girlId);

  return (
    <div className="space-y-6">
      <nav className="text-xs sm:text-sm text-gray-500 break-words">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/area/${girl.area_slug}`} className="hover:text-blue-600">{girl.area_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <a href={`/shop/${girl.shop_id}`} className="hover:text-blue-600 break-words">{girl.shop_name}</a>
        <span className="mx-1 sm:mx-2">&gt;</span>
        <span className="text-gray-800 break-words">{girl.name}</span>
      </nav>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{girl.name}</h2>
              <p className="text-gray-500 mt-1 text-sm break-words">
                <a href={`/shop/${girl.shop_id}`} className="hover:text-blue-600 break-words">
                  {girl.shop_name}
                </a>
                <span className="mx-1">-</span>
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

          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">評価内訳</h3>
            <PanelRatingBar
              matchCount={girl.panel_match_count || 0}
              diffCount={girl.panel_diff_count || 0}
              jiraiCount={girl.jirai_count || 0}
            />
          </div>
        </div>
      </div>

      <GirlPageClient
        girlId={girl.id}
        girlName={girl.name}
        initialReviews={reviews}
      />
    </div>
  );
}
