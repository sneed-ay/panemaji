'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { wrapClickUrl } from '@/lib/ad-config';
import AdstirBanner from './AdstirBanner';
import { pickAdType, type AdType } from '@/lib/pickAdType';
import { pickFreshFanza } from '@/lib/fanzaPool';

const UNLOCK_KEY = 'content_unlocked';
const UNLOCK_DURATION = 86400000; // 24時間
const COUNTDOWN_SECONDS = 5;

function isUnlocked(): boolean {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw && Date.now() < parseInt(raw, 10)) return true;
  } catch {}
  return false;
}

function saveUnlock(): void {
  try {
    localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_DURATION));
  } catch {}
}

/** GA計測ヘルパー（ロッカー内広告共通） */
function trackLockerAd(event: 'banner_click' | 'banner_impression', adType: AdType, extra: Record<string, string | number> = {}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.gtag) {
      w.gtag('event', event, {
        transport_type: 'beacon',
        ad_type: adType,
        ad_placement: 'locker',
        ad_page: typeof window !== 'undefined' ? window.location.pathname : '',
        ...extra,
      });
    }
  } catch {}
}

/** note 自社バナー（adstir/FANZA no-fill 時 or pickAdType で note 当選時のフォールバック） */
function LockerNoteFallback() {
  const impressionRef = useRef(false);
  useEffect(() => {
    if (!impressionRef.current) {
      impressionRef.current = true;
      trackLockerAd('banner_impression', 'note');
    }
  }, []);
  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  const noteUrl = 'https://note.com/kaito_ura/n/n5a879e870165?utm_source=panemaji&utm_medium=locker';
  return (
    <div className="flex justify-center">
      <a href={wrapClickUrl(noteUrl, { adType: 'note', adSize: 'locker', adPage: pagePath })}
        target="_blank" rel="noopener noreferrer sponsored"
        onClick={() => trackLockerAd('banner_click', 'note')}>
        <img
          src={`/ad/sp-ad${Math.floor(Math.random() * 4) + 1}.jpg`}
          alt="PR"
          className="w-full max-w-[300px] h-auto rounded-lg"
        />
      </a>
    </div>
  );
}

/** ロッカー内 FANZA バナー（1商品のみ、大きめ） */
function LockerFanzaBanner() {
  const [item, setItem] = useState<{ title: string; url: string; imageUrl: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const impressionRef = useRef(false);

  useEffect(() => {
    fetch('/api/fanza?n=8')
      .then(r => r.json())
      .then((data: { title: string; url: string; imageUrl: string }[]) => {
        const picked = pickFreshFanza(data, 1);
        if (picked.length > 0) setItem(picked[0]);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (item && !impressionRef.current) {
      impressionRef.current = true;
      trackLockerAd('banner_impression', 'fanza');
    }
  }, [item]);

  // no-fill（APIが空返却）時は note フォールバック
  if (loaded && !item) return <LockerNoteFallback />;
  if (!item) return <div className="flex justify-center min-h-[240px]" />;

  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  // imageURL.small は大体 240x340 前後。locker 内で縦長に表示して目立たせる
  return (
    <div className="flex justify-center">
      <a href={wrapClickUrl(item.url, { adType: 'fanza', adSize: 'locker', adPage: pagePath })}
        target="_blank" rel="noopener noreferrer sponsored"
        className="block hover:opacity-80 transition-opacity no-underline"
        onClick={() => trackLockerAd('banner_click', 'fanza')}>
        <img src={item.imageUrl} alt="" className="max-h-[240px] w-auto rounded" loading="lazy" />
      </a>
    </div>
  );
}

/**
 * ロッカー内広告: メインと同じ比率で FANZA / adstir / note を抽選。
 * 1枠1広告ルールを遵守し、抽選された1種類だけ描画する。
 * no-fill / no-ad 時のみ LockerNoteFallback に自動差し替え。
 */
function LockerAd() {
  // 初回マウント時に抽選結果を固定（再レンダリングで切り替わらないように）
  const [adType] = useState<AdType>(() => pickAdType());

  if (adType === 'fanza') return <LockerFanzaBanner />;
  if (adType === 'adstir') {
    return <AdstirBanner size="locker" placement="locker" fallback={<LockerNoteFallback />} />;
  }
  return <LockerNoteFallback />;
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
  const [unlocked, setUnlocked] = useState(true);
  const [countdown, setCountdown] = useState(-1);
  const [showButton, setShowButton] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setUnlocked(isUnlocked());
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0) setShowButton(true);
  }, [countdown]);

  const handleStartCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
  }, []);

  const handleUnlock = useCallback(() => {
    saveUnlock();
    setUnlocked(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'content_unlock', { transport_type: 'beacon', method: 'ad_view' });
    } catch {}
  }, []);

  if (reviewCount === 0 || unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="relative overflow-hidden" style={{ maxHeight: '180px' }}>
        <PlaceholderReviews count={reviewCount} />
        <div className="absolute inset-0 top-[50px]" style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,1) 80%)',
          pointerEvents: 'none',
        }} />
      </div>

      <div className="relative -mt-8 pb-4 px-4 flex flex-col items-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 sm:p-6 w-full max-w-md text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            口コミを見るにはこちら
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            短い広告を見ると24時間すべての口コミが閲覧できます
          </p>

          {countdown === -1 ? (
            <button
              onClick={handleStartCountdown}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>▶</span>
              <span>短い広告を見る（{COUNTDOWN_SECONDS}秒）</span>
            </button>
          ) : (
            <div>
              <div className="bg-gray-50 rounded-lg p-2 mb-3">
                <LockerAd />
              </div>

              {showButton ? (
                <button
                  onClick={handleUnlock}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                >
                  口コミを見る
                </button>
              ) : (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 text-blue-600">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="font-bold text-lg">{countdown}秒</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-3">
            ※ 解除後24時間、サイト全体の口コミが閲覧可能になります
          </p>
        </div>
      </div>
    </div>
  );
}
