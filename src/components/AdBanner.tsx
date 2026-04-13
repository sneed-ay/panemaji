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

/** コンテキストからFANZA検索キーワードを生成 */
function buildFanzaKeyword(context?: AdContext): string {
  if (!context) return '';
  const parts: string[] = [];
  if (context.area) parts.push(context.area);
  if (context.category) parts.push(context.category);
  if (context.keyword) parts.push(context.keyword);
  return parts.join(' ');
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
function FanzaWidget({ size, context }: { size: AdSize; context?: AdContext }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  const dimensions = size === 'header' || size === 'footer'
    ? { w: 320, h: 100 } : { w: 300, h: 250 };

  const keyword = buildFanzaKeyword(context);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;
    const container = containerRef.current;
    const { fanza } = AD_CONFIG;

    // キーワード付きDMMウィジェットURL
    let widgetUrl = `https://www.dmm.co.jp/widget/affiliate/id=${fanza.affiliateId}-998/fn=widget/service=${fanza.service.toLowerCase()}/floor=${fanza.defaultFloor}/size=${dimensions.w}_${dimensions.h}/`;
    if (keyword) {
      widgetUrl += `keyword=${encodeURIComponent(keyword)}/`;
    }

    const iframe = document.createElement('iframe');
    iframe.src = widgetUrl;
    iframe.width = String(dimensions.w);
    iframe.height = String(dimensions.h);
    iframe.scrolling = 'no';
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.style.maxWidth = '100%';
    container.appendChild(iframe);

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const hasIframe = containerRef.current.querySelector('iframe');
      if (!hasIframe || hasIframe.offsetHeight < 30) {
        setShowFallback(true);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [dimensions.w, dimensions.h, keyword]);

  if (showFallback) return <NoteAdImage size={size} />;
  return <div ref={containerRef} className="flex justify-center" />;
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

export default function AdBanner({ size, className = '', context }: AdBannerProps) {
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
        {adType === 'fanza' && <FanzaWidget size={size} context={context} />}
        {adType === 'note' && <NoteAdImage size={size} />}
        {adType === 'adstir' && <AdstirBanner size={size} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
