'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';
type AdType = 'note' | 'fanza' | 'adstir';

/** コンテキスト情報（FANZAのキーワード連動用） */
export interface AdContext {
  area?: string;    // エリア名 (例: "渋谷")
  category?: string; // カテゴリ (例: "デリヘル")
  keyword?: string;  // 追加キーワード
}

interface AdBannerProps {
  size: AdSize;
  className?: string;
  context?: AdContext;
}

function getRandomImage(images: string[]): string {
  return images[Math.floor(Math.random() * images.length)];
}

/** 配信比率に基づいて広告タイプを選択 */
function pickAdType(): AdType {
  const candidates: { type: AdType; weight: number }[] = [];

  if (AD_CONFIG.fanza.enabled) {
    candidates.push({ type: 'fanza', weight: AD_CONFIG.fanzaRatio });
  }
  candidates.push({ type: 'note', weight: AD_CONFIG.noteRatio });
  if (AD_CONFIG.adstir.enabled && AD_CONFIG.adstir.appId) {
    candidates.push({ type: 'adstir', weight: AD_CONFIG.adstirRatio });
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c.type;
  }
  return 'note';
}

/** FANZA動的ウィジェット（DMMアフィリエイト - コンテキスト連動） */
function FanzaWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;
    const container = containerRef.current;

    // DMM公式 placement.js 方式
    const dataId = '700d7d51a632d919255af456a6e3ced7';
    const ins = document.createElement('ins');
    ins.className = 'dmm-widget-placement';
    ins.dataset.id = dataId;
    ins.style.background = 'transparent';
    container.appendChild(ins);

    // cache-busterで毎回再ロードしins要素をスキャンさせる
    const script = document.createElement('script');
    script.src = `https://widget-view.dmm.co.jp/js/placement.js?_=${Date.now()}`;
    script.className = 'dmm-widget-scripts';
    script.dataset.id = dataId;
    container.appendChild(script);

    // placement.jsの読み込み・描画完了まで待つ（フォールバックなし）
    // ins要素をDOMに残し続けないとplacement.jsが動作しない
    return () => {};
  }, []);

  // フォールバックせず常にins要素を保持（placement.jsが非同期で描画）
  return <div ref={containerRef} className="flex justify-center min-h-[50px]" />;
}

/** adstir SSP広告バナー */
function AdstirBanner({ size }: { size: AdSize }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;
    const container = containerRef.current;
    const { adstir } = AD_CONFIG;

    const varsScript = document.createElement('script');
    varsScript.type = 'text/javascript';
    varsScript.textContent = `var adstir_vars = { ver: "4.0", app_id: "${adstir.appId}", ad_spot: ${adstir.spot}, center: true };`;
    container.appendChild(varsScript);

    const sdkScript = document.createElement('script');
    sdkScript.type = 'text/javascript';
    sdkScript.src = adstir.scriptUrl;
    sdkScript.async = true;
    container.appendChild(sdkScript);

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const hasContent = containerRef.current.querySelector('iframe, img, canvas, svg, [class*="ad"]');
      const height = containerRef.current.offsetHeight;
      if (!hasContent || height < 50) {
        setShowFallback(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (showFallback) return <NoteAdImage size={size} />;
  return <div ref={containerRef} className="flex justify-center min-h-[250px]" />;
}

/** Note自社広告バナー */
function NoteAdImage({ size }: { size: AdSize }) {
  const [adSrc] = useState(() => getRandomImage(AD_CONFIG.noteAd.images));
  const [imgError, setImgError] = useState(false);
  const link = getAdLink(size);

  const handleClick = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'banner_click', { ad_size: size, ad_type: 'note', ad_page: window.location.pathname });
    } catch {}
  };

  if (imgError) return null;

  return (
    <a href={link} target="_blank" rel="noopener noreferrer sponsored"
      className="inline-block w-full max-w-lg" onClick={handleClick}>
      <img src={adSrc} alt="PR" className="w-full h-auto rounded-lg" onError={() => setImgError(true)} />
    </a>
  );
}

export default function AdBanner({ size, className = '' }: AdBannerProps) {
  const [visible, setVisible] = useState(false);
  const [adType, setAdType] = useState<AdType>('note');

  useEffect(() => {
    if (!AD_CONFIG.enabled) return;

    try {
      const raw = localStorage.getItem(`ad_dismissed_${size}`);
      if (raw && Date.now() < parseInt(raw, 10)) return;
    } catch {}

    const picked = pickAdType();
    setAdType(picked);
    setVisible(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'banner_view', { ad_size: size, ad_type: picked });
    } catch {}
  }, [size]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(`ad_dismissed_${size}`, String(Date.now() + 86400000)); } catch {}
  }, [size]);

  if (!AD_CONFIG.enabled || !visible) return null;

  return (
    <div className={`relative bg-gray-50 border border-gray-200 rounded-lg text-center py-2 my-3 ${className}`}>
      <div className="text-[10px] text-gray-400 mb-1">PR</div>
      <div className="px-2">
        {adType === 'fanza' && <FanzaWidget />}
        {adType === 'note' && <NoteAdImage size={size} />}
        {adType === 'adstir' && <AdstirBanner size={size} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
