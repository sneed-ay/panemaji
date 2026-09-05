'use client';

import { useState, useEffect } from 'react';
import { getMe } from '@/lib/client-fetch';

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
  // gate: open=表示 / guest=未ログイン / stale=会員だが直近30日に投稿なし。
  // 初期は open = SSR では口コミを出す (クローラに content を見せSEO維持)。クライアントで判定して切替。
  const [gate, setGate] = useState<'open' | 'guest' | 'stale'>('open');

  useEffect(() => {
    getMe().then((d) => {
      if (!d) return; // 取得失敗時は open のまま (SSR と同じ表示を維持)
      if (!d.user) setGate('guest');
      else if (!d.user.is_admin && !d.reviewed_recently) setGate('stale');
      // 管理者 or 直近30日に投稿あり → open のまま (見放題)
    });
  }, []);

  // 口コミ0件 or open → そのまま表示
  if (reviewCount === 0 || gate === 'open') {
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
          {gate === 'guest' ? (
            <>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">口コミを見るには無料会員登録</h3>
              <p className="text-xs text-gray-500 mb-4">
                無料登録して口コミを1件投稿すると、サイト全体の口コミが見放題になります（毎月1件でOK）。
              </p>
              <a
                href={`/signup?next=${encodeURIComponent(currentPath)}`}
                className="block w-full mb-2 py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors no-underline"
              >
                ✨ 無料会員登録（30秒）
              </a>
              <p className="text-[10px] text-gray-400 mb-3">メアド + パスワードだけ・メアド認証なし</p>
              <a href={`/login?next=${encodeURIComponent(currentPath)}`} className="block text-xs text-pink-600 hover:underline">
                既に会員の方はログイン
              </a>
            </>
          ) : (
            <>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">口コミを1件投稿すると見放題</h3>
              <p className="text-xs text-gray-500 mb-4">
                直近1ヶ月の口コミ投稿がありません。どの嬢でも評価（パネル通り/盛りすぎ 等）を1件入れると、サイト全体の口コミがまた見放題になります（毎月1件でOK）。
              </p>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="block w-full mb-1 py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors"
              >
                ⬆ このページ上部の「評価」から入れる
              </button>
              <p className="text-[10px] text-gray-400">投稿後にページを更新すると見放題になります</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
