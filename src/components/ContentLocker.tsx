'use client';

import { useState, useEffect } from 'react';

/**
 * 口コミ閲覧ゲート。
 * 2026-05-31: 「短い広告を見る」方式を廃止し、無料会員登録(ログイン)のみで閲覧可能にする方針へ変更。
 * - 会員(ログイン中) or 口コミ0件 → そのまま表示
 * - 未会員 → 会員登録/ログイン誘導 (広告ゲートは廃止)
 */

interface ContentLockerProps {
  children: React.ReactNode;
  reviewCount: number;
}

/** ロック時のダミー口コミカード */
function PlaceholderReviews({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
        <div key={i} className="border border-gray-100 rounded-lg p-3 sm:p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-gray-200 rounded-full h-6 w-24" />
            <div className="bg-gray-200 rounded h-4 w-20" />
          </div>
          <div className="space-y-2 mt-2">
            <div className="bg-gray-200 rounded h-4 w-full" />
            <div className="bg-gray-200 rounded h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContentLocker({ children, reviewCount }: ContentLockerProps) {
  // 初期は非ロック = SSR では口コミを出す (クローラに content を見せSEO維持)。
  // クライアントで /api/me を確認し、未会員ならロックに切り替える (旧 広告ゲートと同じ soft gate 方針)。
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { if (!d.user) setLocked(true); })
      .catch(() => {});
  }, []);

  // 口コミ0件 or 非ロック(会員/初期SSR) → そのまま表示
  if (reviewCount === 0 || !locked) {
    return <>{children}</>;
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <div className="relative">
      <div className="relative overflow-hidden" style={{ maxHeight: '180px' }}>
        <PlaceholderReviews count={reviewCount} />
        <div
          className="absolute inset-0 top-[50px]"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,1) 80%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="relative -mt-8 pb-4 px-4 flex flex-col items-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 sm:p-6 w-full max-w-md text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            口コミを見るには無料会員登録
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            無料会員登録だけで、サイト全体の口コミがすべて見放題になります。
          </p>

          <a
            href={`/signup?next=${encodeURIComponent(currentPath)}`}
            className="block w-full mb-2 py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors no-underline"
          >
            ✨ 無料会員登録で口コミを全部見る
          </a>
          <p className="text-[10px] text-gray-400 mb-3">
            メアド + パスワードだけ・30秒・メアド認証なし
          </p>

          <a
            href={`/login?next=${encodeURIComponent(currentPath)}`}
            className="block text-xs text-pink-600 hover:underline"
          >
            既に会員の方はログイン
          </a>
        </div>
      </div>
    </div>
  );
}
