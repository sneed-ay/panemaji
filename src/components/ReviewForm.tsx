'use client';

import { useState, useEffect } from 'react';

type Props = {
  girlId: number;
  girlName: string;
  onSuccess: () => void;
};

function getBrowserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('panemaji_browser_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('panemaji_browser_id', id);
  }
  return id;
}

export default function ReviewForm({ girlId, girlName, onSuccess }: Props) {
  const [panelRating, setPanelRating] = useState('');
  const [comment, setComment] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    const reviewed = localStorage.getItem(`reviewed_${girlId}`);
    if (reviewed) setAlreadyReviewed(true);
  }, [girlId]);

  if (alreadyReviewed) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
        この女性への口コミは投稿済みです
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelRating) {
      setError('評価を選択してください');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          girl_id: girlId,
          panel_rating: panelRating,
          comment: comment || null,
          twitter_url: twitterUrl || null,
          browser_id: getBrowserId(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'ALREADY_REVIEWED') {
          setAlreadyReviewed(true);
          localStorage.setItem(`reviewed_${girlId}`, '1');
          return;
        }
        throw new Error(data.error || '投稿に失敗しました');
      }

      localStorage.setItem(`reviewed_${girlId}`, '1');
      setPanelRating('');
      setComment('');
      setTwitterUrl('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingOptions = [
    { value: 'panel_match', label: 'パネル通り', emoji: '\u2705', color: 'border-green-400 bg-green-50 text-green-800 hover:bg-green-100' },
    { value: 'panel_diff', label: '許せる', emoji: '\u26a0\ufe0f', color: 'border-yellow-400 bg-yellow-50 text-yellow-800 hover:bg-yellow-100' },
    { value: 'jirai', label: '盛りすぎ', emoji: '\ud83d\udca3', color: 'border-red-400 bg-red-50 text-red-800 hover:bg-red-100' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 space-y-4">
      <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">
        {girlName} さんの口コミを投稿
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          リアル度 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {ratingOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPanelRating(opt.value)}
              className={`border-2 rounded-lg p-2 sm:p-3 text-center transition-all ${
                panelRating === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-blue-500 font-bold'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="text-xl sm:text-2xl mb-1">{opt.emoji}</div>
              <div className="text-xs sm:text-sm">{opt.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          コメント（任意）
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="写真との違いを具体的に..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">{comment.length}/500</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          𝕏 この子のXアカウント（任意）
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm shrink-0">@</span>
          <input
            type="text"
            value={twitterUrl}
            onChange={(e) => setTwitterUrl(e.target.value.replace(/^@/, ''))}
            placeholder="username"
            maxLength={15}
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">知っていたら教えてください（例: username）</p>
      </div>

      <button
        type="submit"
        disabled={submitting || !panelRating}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? '投稿中...' : '口コミを投稿する'}
      </button>
    </form>
  );
}
