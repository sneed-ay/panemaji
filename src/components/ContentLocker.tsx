'use client';

import { useState, useEffect, useRef } from 'react';
import { AD_CONFIG } from '@/lib/ad-config';

const UNLOCK_KEY = 'content_unlocked';

function isUnlocked(): boolean {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw && Date.now() < parseInt(raw, 10)) return true;
  } catch {}
  return false;
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

interface ContentLockerProps {
  children: React.ReactNode;
  reviewCount: number;
}

export default function ContentLocker({ children, reviewCount }: ContentLockerProps) {
  const [unlocked, setUnlocked] = useState(true); // SSRデフォルト
  const scriptLoaded = useRef(false);

  useEffect(() => {
    setUnlocked(isUnlocked());
  }, []);

  // AdMavenスクリプトをロック状態のページにロード
  // 外部リンク（/unlock）クリック時にAdMavenがフルページロッカーを表示
  useEffect(() => {
    // Single Link方式: スクリプト注入不要（リンク先がAdMavenロッカーページ）
  }, []);

  // GA tracking
  const trackUnlockClick = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'content_locker_click', { method: 'admaven' });
    } catch {}
  };

  if (reviewCount === 0 || unlocked) {
    return <>{children}</>;
  }

  // ロック状態: ダミーカード + AdMavenトリガーリンク
  return (
    <div className="relative">
      {/* プレースホルダー + ぼかし */}
      <div className="relative overflow-hidden" style={{ maxHeight: '180px' }}>
        <PlaceholderReviews count={reviewCount} />
        <div className="absolute inset-0 top-[50px]" style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,1) 80%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ロッカーカード */}
      <div className="relative -mt-8 pb-4 px-4 flex flex-col items-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 sm:p-6 w-full max-w-md text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            口コミを見るにはこちら
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            短い広告を見ると24時間すべての口コミが閲覧できます
          </p>

          {/* AdMaven Single Link → ロッカーページ → /unlock にリダイレクト */}
          <a
            href="https://ultra-links.net/s?gnGY7kq8"
            onClick={trackUnlockClick}
            rel="noopener noreferrer"
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-center no-underline"
          >
            ▶ 口コミを見る（広告が表示されます）
          </a>

          <p className="text-[10px] text-gray-400 mt-3">
            ※ 解除後24時間、サイト全体の口コミが閲覧可能になります
          </p>
        </div>
      </div>
    </div>
  );
}
