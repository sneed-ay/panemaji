'use client';

import { useState, useCallback } from 'react';

type Props = {
  girlId: number;
  girlName: string;
  alreadyVoted: boolean;
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

const RATING_OPTIONS = [
  { value: 'panel_match', label: 'パネル通り', emoji: '\ud83d\ude0a', color: 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200', selectedColor: 'border-green-500 bg-green-100 text-green-800 ring-2 ring-green-400' },
  { value: 'panel_diff', label: '許せる', emoji: '\ud83e\udd14', color: 'border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 active:bg-yellow-200', selectedColor: 'border-yellow-500 bg-yellow-100 text-yellow-800 ring-2 ring-yellow-400' },
  { value: 'jirai', label: 'パネル詐欺', emoji: '\ud83d\udc80', color: 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200', selectedColor: 'border-red-500 bg-red-100 text-red-800 ring-2 ring-red-400' },
] as const;

export default function OneTabVote({ girlId, alreadyVoted, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [voted, setVoted] = useState(alreadyVoted);
  const [error, setError] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [commentSent, setCommentSent] = useState(false);
  const [showChangeVote, setShowChangeVote] = useState(false);

  const handleVote = useCallback(async (rating: string) => {
    if (submitting) return;
    setSubmitting(rating);
    setError('');

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          girl_id: girlId,
          panel_rating: rating,
          comment: null,
          browser_id: getBrowserId(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'ALREADY_REVIEWED') {
          localStorage.setItem(`reviewed_${girlId}`, '1');
          setVoted(true);
    
          onSuccess();
          return;
        }
        throw new Error(data.error || '投稿に失敗しました');
      }

      localStorage.setItem(`reviewed_${girlId}`, '1');
      setVoted(true);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '投稿に失敗しました');
    } finally {
      setSubmitting(null);
    }
  }, [girlId, submitting, onSuccess]);

  // Already voted state
  if (voted && !showChangeVote) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 text-center space-y-3">
        <div className="text-green-600 font-bold text-base flex items-center justify-center gap-1.5">
          <span className="text-lg">&#x2705;</span>
          <span>投票ありがとう！</span>
        </div>

        {/* Optional comment after voting */}
        {!showComment && !commentSent && (
          <button
            onClick={() => setShowComment(true)}
            className="text-sm text-blue-500 hover:text-blue-700 underline"
          >
            コメントを追加する（任意）
          </button>
        )}

        {showComment && !commentSent && (
          <div className="space-y-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="写真との違いを具体的に..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{comment.length}/500</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowComment(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
                >
                  やめる
                </button>
                <button
                  onClick={async () => {
                    if (!comment.trim()) return;
                    // Update the review with a comment via a PATCH-like re-submit
                    // Since unique constraint prevents new insert, we use a dedicated endpoint or rely on the comment
                    try {
                      await fetch('/api/reviews/comment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          girl_id: girlId,
                          comment: comment.trim(),
                          browser_id: getBrowserId(),
                        }),
                      });
                      setCommentSent(true);
                      setShowComment(false);
                    } catch {
                      // Silently fail - vote was already recorded
                      setCommentSent(true);
                      setShowComment(false);
                    }
                  }}
                  disabled={!comment.trim()}
                  className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  送信
                </button>
              </div>
            </div>
          </div>
        )}

        {commentSent && (
          <p className="text-xs text-gray-400">コメントを追加しました</p>
        )}

        <button
          onClick={() => setShowChangeVote(true)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          投票を変更する
        </button>
      </div>
    );
  }

  // If user wants to change vote, show the same UI but with a note
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-3">
      <p className="text-center text-sm font-bold text-gray-700">
        この子はパネル通り？
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {RATING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleVote(opt.value)}
            disabled={!!submitting}
            className={`border-2 rounded-xl p-3 sm:p-4 text-center transition-all min-h-[72px] flex flex-col items-center justify-center gap-1 ${
              submitting === opt.value
                ? opt.selectedColor + ' font-bold'
                : submitting
                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : opt.color
            }`}
          >
            <span className="text-2xl sm:text-3xl leading-none">{opt.emoji}</span>
            <span className="text-xs sm:text-sm font-medium leading-tight">{opt.label}</span>
            {submitting === opt.value && (
              <span className="text-[10px] text-gray-500 animate-pulse">送信中...</span>
            )}
          </button>
        ))}
      </div>

      {showChangeVote && (
        <button
          onClick={() => { setShowChangeVote(false); setVoted(true); }}
          className="block mx-auto text-xs text-gray-400 hover:text-gray-600 underline"
        >
          キャンセル
        </button>
      )}
    </div>
  );
}
