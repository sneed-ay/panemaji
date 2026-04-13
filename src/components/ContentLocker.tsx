'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const UNLOCK_KEY = 'content_unlocked';
const UNLOCK_DURATION = 86400000; // 24時間
const COUNTDOWN_SECONDS = 5;

/** localStorageの解除状態をチェック */
function isUnlocked(): boolean {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw && Date.now() < parseInt(raw, 10)) return true;
  } catch {}
  return false;
}

/** 解除状態を保存 */
function saveUnlock(): void {
  try {
    localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_DURATION));
  } catch {}
}

/** FANZAウィジェット（ロッカー内広告用） */
function LockerFanzaAd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;
    const container = containerRef.current;
    const dataId = '700d7d51a632d919255af456a6e3ced7';

    const ins = document.createElement('ins');
    ins.className = 'dmm-widget-placement';
    ins.dataset.id = dataId;
    ins.style.background = 'transparent';
    container.appendChild(ins);

    const script = document.createElement('script');
    script.src = `https://widget-view.dmm.co.jp/js/placement.js?_=${Date.now()}`;
    script.className = 'dmm-widget-scripts';
    script.dataset.id = dataId;
    container.appendChild(script);
  }, []);

  return <div ref={containerRef} className="flex justify-center my-3" />;
}

interface ContentLockerProps {
  children: React.ReactNode;
  reviewCount: number;
}

export default function ContentLocker({ children, reviewCount }: ContentLockerProps) {
  const [unlocked, setUnlocked] = useState(true); // SSR: 表示状態で開始
  const [countdown, setCountdown] = useState(-1); // -1: 未開始
  const [showButton, setShowButton] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // クライアントで解除状態をチェック
    setUnlocked(isUnlocked());
  }, []);

  // カウントダウン処理
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [countdown]);

  // カウントダウン完了
  useEffect(() => {
    if (countdown === 0) setShowButton(true);
  }, [countdown]);

  const handleStartCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
  }, []);

  const handleUnlock = useCallback(() => {
    saveUnlock();
    setUnlocked(true);
    // GA tracking
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'content_unlock', { method: 'ad_view' });
    } catch {}
  }, []);

  // 口コミ0件 or 解除済み → そのまま表示
  if (reviewCount === 0 || unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* 口コミ1件目だけ表示 + 残りはぼかし */}
      <div className="relative overflow-hidden" style={{ maxHeight: '400px' }}>
        {children}
        {/* グラデーションマスク */}
        <div className="absolute inset-0 top-[120px]" style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.7) 10%, rgba(255,255,255,0.95) 40%)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ロッカーオーバーレイ */}
      <div className="relative -mt-32 pt-8 pb-6 px-4 flex flex-col items-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 sm:p-6 w-full max-w-md text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            口コミを見るにはこちら
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            広告を見ると24時間すべての口コミが閲覧できます
          </p>

          {countdown === -1 ? (
            /* 開始前: 広告表示ボタン */
            <button
              onClick={handleStartCountdown}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>▶</span>
              <span>短い広告を見る（{COUNTDOWN_SECONDS}秒）</span>
            </button>
          ) : (
            /* カウントダウン中 or 完了 */
            <div>
              {/* 広告表示エリア */}
              <div className="bg-gray-50 rounded-lg p-2 mb-3 min-h-[260px] flex items-center justify-center">
                <LockerFanzaAd />
              </div>

              {showButton ? (
                <button
                  onClick={handleUnlock}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                >
                  口コミを見る
                </button>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{countdown}</div>
                  <p className="text-xs text-gray-400">あと{countdown}秒お待ちください...</p>
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
