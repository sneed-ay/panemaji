'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG } from '@/lib/ad-config';

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

/** AdMaven コンテンツロッカー広告（CPM）*/
function AdMavenLockerAd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!AD_CONFIG.adMaven.enabled || loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;
    const container = containerRef.current;

    // AdMaven Content Locker script
    const script = document.createElement('script');
    script.src = `https://d3a58drcwcnmve.cloudfront.net/js/NotificationManagerIMP.js?pid=${AD_CONFIG.adMaven.publisherId}&lid=${AD_CONFIG.adMaven.lockerId}`;
    script.async = true;
    container.appendChild(script);
  }, []);

  if (!AD_CONFIG.adMaven.enabled) return null;
  return <div ref={containerRef} className="flex justify-center min-h-[250px]" />;
}

/** CPALead コンテンツロッカー広告（CPA/CPC）*/
function CPALeadLockerAd() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!AD_CONFIG.cpaLead.enabled || loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;
    const container = containerRef.current;

    // CPALead Content Locker script
    const script = document.createElement('script');
    script.src = `https://d1lxhc4jvstzrp.cloudfront.net/scripts/content-locker/cplocker.js`;
    script.async = true;
    script.dataset.appId = AD_CONFIG.cpaLead.appId;
    script.dataset.subId = AD_CONFIG.cpaLead.subId;
    container.appendChild(script);
  }, []);

  if (!AD_CONFIG.cpaLead.enabled) return null;
  return <div ref={containerRef} className="flex justify-center min-h-[250px]" />;
}

/** フォールバック広告（AdMaven/CPALead未登録時）: FANZA + noteバナー */
function FallbackLockerAd() {
  const fanzaRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !fanzaRef.current) return;
    loadedRef.current = true;
    const container = fanzaRef.current;
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

  return (
    <div className="space-y-3">
      <div ref={fanzaRef} className="flex justify-center" />
      <div className="flex justify-center">
        <a href="https://note.com/kaito_ura/n/n5a879e870165?utm_source=panemaji&utm_medium=locker" target="_blank" rel="noopener noreferrer sponsored">
          <img
            src={`/ad/sp-ad${Math.floor(Math.random() * 4) + 1}.jpg`}
            alt="PR"
            className="w-full max-w-[300px] h-auto rounded-lg"
          />
        </a>
      </div>
    </div>
  );
}

/** ロッカー内広告を優先順で表示 */
function LockerAd() {
  if (AD_CONFIG.adMaven.enabled) return <AdMavenLockerAd />;
  if (AD_CONFIG.cpaLead.enabled) return <CPALeadLockerAd />;
  return <FallbackLockerAd />;
}

/** ロック時のダミー口コミカード（実データは一切含まない） */
function PlaceholderReviews({ count }: { count: number }) {
  const placeholders = Array.from({ length: Math.min(count, 6) }, (_, i) => i);
  return (
    <div className="space-y-4">
      {placeholders.map((i) => (
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
      if (w.gtag) w.gtag('event', 'content_unlock', { method: 'ad_view' });
    } catch {}
  }, []);

  if (reviewCount === 0 || unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="relative overflow-hidden" style={{ maxHeight: '500px' }}>
        <PlaceholderReviews count={reviewCount} />
        <div className="absolute inset-0 top-[80px]" style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.6) 15%, rgba(255,255,255,0.9) 50%)',
          pointerEvents: 'none',
        }} />
      </div>

      <div className="relative -mt-48 pt-8 pb-6 px-4 flex flex-col items-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 sm:p-6 w-full max-w-md text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            口コミを見るにはこちら
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            広告を見ると24時間すべての口コミが閲覧できます
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
