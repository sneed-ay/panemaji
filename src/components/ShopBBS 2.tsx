'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type Comment = {
  id: number;
  shop_id: number;
  comment: string;
  browser_id: string | null;
  created_at: string;
};

function getBrowserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('panemaji_browser_id');
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('panemaji_browser_id', id);
    }
    return id;
  } catch {
    return '';
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}`;
  } catch {
    return dateStr;
  }
}

export default function ShopBBS({ shopId, initialComments }: { shopId: number; initialComments: Comment[] }) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Refresh comments periodically
  useEffect(() => {
    const refresh = () => {
      fetch(`/api/shop-comments?shop_id=${shopId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.comments) setComments(data.comments);
        })
        .catch(() => {});
    };
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [shopId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed) return;
      if (trimmed.length > 500) {
        setError('500文字以内で入力してください');
        return;
      }

      setPosting(true);
      setError('');
      setSuccess('');

      try {
        const res = await fetch('/api/shop-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop_id: shopId,
            comment: trimmed,
            browser_id: getBrowserId(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '投稿に失敗しました');
          return;
        }

        // Refresh full list
        const listRes = await fetch(`/api/shop-comments?shop_id=${shopId}`);
        const listData = await listRes.json();
        if (listData.comments) setComments(listData.comments);

        setText('');
        setSuccess('投稿しました');
        setTimeout(() => setSuccess(''), 3000);
        // Scroll to bottom
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } catch {
        setError('通信エラーが発生しました');
      } finally {
        setPosting(false);
      }
    },
    [text, shopId]
  );

  return (
    <div className="bg-[#f0e8d8] border border-[#d0c8b0] rounded" style={{ fontFamily: '"MS PGothic", "IPAMonaPGothic", sans-serif' }}>
      {/* Header */}
      <div className="bg-[#cc3300] text-white px-3 py-2 text-sm font-bold rounded-t">
        みんなの掲示板
      </div>

      {/* Comments */}
      <div className="px-3 py-2 max-h-[500px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-gray-600 text-sm py-4 text-center">まだ書き込みはありません。最初の一言を投稿しよう！</p>
        ) : (
          <div className="space-y-1">
            {comments.map((c, idx) => (
              <div key={c.id} className="text-sm border-b border-[#d0c8b0] pb-1.5 mb-1.5 last:border-b-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-green-800">{idx + 1}</span>
                  <span className="text-gray-500 text-xs">名無しさん</span>
                  <span className="text-gray-400 text-xs">{formatDate(c.created_at)}</span>
                </div>
                <p className="text-gray-800 mt-0.5 whitespace-pre-wrap break-words pl-2">{c.comment}</p>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Post Form */}
      <div className="border-t border-[#d0c8b0] px-3 py-3 bg-[#e8e0d0] rounded-b">
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="コメントを書き込む...（匿名・会員登録不要）"
            rows={3}
            maxLength={500}
            className="w-full border border-[#c0b8a0] rounded px-2 py-1.5 text-sm bg-white resize-none focus:outline-none focus:ring-1 focus:ring-[#cc3300]"
          />
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-xs text-gray-500">{text.length}/500</span>
            <div className="flex items-center gap-2">
              {error && <span className="text-red-600 text-xs">{error}</span>}
              {success && <span className="text-green-700 text-xs">{success}</span>}
              <button
                type="submit"
                disabled={posting || !text.trim()}
                className="bg-[#cc3300] text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-[#aa2200] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? '投稿中...' : '書き込む'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
