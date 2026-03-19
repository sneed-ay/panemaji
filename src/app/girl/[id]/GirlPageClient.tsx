'use client';

import { useState } from 'react';
import ReviewForm from '@/components/ReviewForm';
import PanelRatingBadge from '@/components/PanelRatingBadge';
import type { Review } from '@/lib/db';

type Props = {
  girlId: number;
  girlName: string;
  initialReviews: Review[];
};

export default function GirlPageClient({ girlId, girlName, initialReviews }: Props) {
  const [reviews] = useState(initialReviews);
  const [showForm, setShowForm] = useState(false);

  const handleSuccess = () => {
    // Reload page to refresh data
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Review Form Toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white font-bold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg"
        >
          {showForm ? '閉じる' : '口コミを投稿する'}
        </button>
      </div>

      {showForm && (
        <ReviewForm girlId={girlId} girlName={girlName} onSuccess={handleSuccess} />
      )}

      {/* Reviews List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          口コミ一覧（{reviews.length}件）
        </h3>

        {reviews.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            まだ口コミはありません。最初の投稿者になりましょう！
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <PanelRatingBadge rating={review.panel_rating} />
                  <span className="text-xs text-gray-400">
                    {review.created_at?.split(' ')[0] || review.created_at}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-gray-700 mt-2 whitespace-pre-wrap">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
