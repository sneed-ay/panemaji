import { getGirlWithReviewStats, getReviewsByGirl } from '@/lib/queries';
import { notFound } from 'next/navigation';
import PanelRatingBar from '@/components/PanelRatingBar';
import PanemajiScore from '@/components/PanemajiScore';
import GirlPageClient from './GirlPageClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const girl = getGirlWithReviewStats(parseInt(params.id));
  if (!girl) return {};
  return {
    title: `${girl.name}（${girl.shop_name}）のパネマジ度・口コミ`,
    description: `${girl.shop_name}の${girl.name}さんはパネル通り？パネマジ度の口コミ・評価をチェック。${girl.age ? girl.age + '歳' : ''}${girl.bust ? ' ' + girl.bust + '(' + (girl.cup || '') + ')' : ''}`,
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
      <nav className="text-sm text-gray-500">
        <a href="/" className="hover:text-blue-600">トップ</a>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-500">{girl.area_name}</span>
        <span className="mx-2">&gt;</span>
        <a href={`/shop/${girl.shop_id}`} className="hover:text-blue-600">{girl.shop_name}</a>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-800">{girl.name}</span>
      </nav>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{girl.name}</h2>
              <p className="text-gray-500 mt-1">
                <a href={`/shop/${girl.shop_id}`} className="hover:text-blue-600">
                  {girl.shop_name}
                </a>
                <span className="mx-1">-</span>
                {girl.area_name}
              </p>
            </div>
            <PanemajiScore pct={girl.panemaji_pct ?? -1} reviewCount={girl.review_count || 0} size="lg" />
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
