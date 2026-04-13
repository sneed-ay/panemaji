'use client';

import React, { useState, useEffect, useCallback } from 'react';
import OneTabVote from '@/components/OneTabVote';
import ShareButtons from '@/components/ShareButtons';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import GirlImage from '@/components/GirlImage';
import type { Review } from '@/lib/db';
import { AdsterraSocialBar } from '@/components/AdsterraAds';
import ContentLocker from '@/components/ContentLocker';

type OtherGirl = {
  id: number;
  name: string;
  image_url: string | null;
  review_count: number;
};

type Props = {
  girlId: number;
  girlName: string;
  shopName: string;
  initialReviews: Review[];
  otherGirls: OtherGirl[];
};

export default function GirlPageClient({ girlId, girlName, shopName, initialReviews, otherGirls }: Props) {
  const [reviews] = useState(initialReviews);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    const reviewed = localStorage.getItem(`reviewed_${girlId}`);
    if (reviewed) setVoted(true);
  }, [girlId]);

  const handleVoteSuccess = useCallback(() => {
    setVoted(true);
    // Reload after a short delay to refresh stats
    setTimeout(() => window.location.reload(), 800);
  }, []);

  return (
    <div className="space-y-6">
      {/* One-Tap Vote */}
      <OneTabVote
        girlId={girlId}
        girlName={girlName}
        alreadyVoted={voted}
        onSuccess={handleVoteSuccess}
      />

      {/* Post-vote share */}
      {voted && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <ShareButtons
            url={`/girl/${girlId}`}
            text={`${girlName}（${shopName}）のリアル度を評価しました！ #パネマジ掲示板`}
          />
        </div>
      )}

      {/* Post-vote recommendation */}
      {voted && otherGirls.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
            <span>💡</span>
            <span>{shopName} の他の女性も評価する？</span>
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {otherGirls.map((g) => (
              <a
                key={g.id}
                href={`/girl/${g.id}`}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
              >
                <GirlImage src={g.image_url} alt={g.name} size={64} />
                <span className="text-xs font-medium text-gray-800 text-center break-words line-clamp-1">{g.name}</span>
                <span className="text-[10px] text-gray-400">
                  {g.review_count === 0 ? 'まだ評価なし' : `${g.review_count}件`}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Reviews List with Content Locker */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          口コミ一覧（{reviews.length}件）
        </h3>

        <ContentLocker reviewCount={reviews.length}>
          {reviews.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              まだ口コミはありません。最初の投稿者になりましょう！
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, index) => (
                <React.Fragment key={review.id}>
                  <div className="border border-gray-100 rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <PanelRatingBadge rating={review.panel_rating} />
                      <span className="text-xs text-gray-400 shrink-0">
                        {review.created_at?.substring(0, 10) || review.created_at}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-gray-700 mt-2 whitespace-pre-wrap break-words text-sm sm:text-base">{review.comment}</p>
                    )}
                  </div>
                  {index === 2 && <AdsterraSocialBar />}
                </React.Fragment>
              ))}
            </div>
          )}
        </ContentLocker>
      </div>
    </div>
  );
}
