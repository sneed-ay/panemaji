'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';
type AdType = 'note' | 'exoclick' | 'juicyads';

interface AdBannerProps {
  size: AdSize;
  className?: string;
}

function getRandomNoteImage(): string {
  const variants = AD_CONFIG.noteAd.images;
  return variants[Math.floor(Math.random() * variants.length)];
}

/** 配信比率に基づいて広告タイプを選択（zoneId未設定のネットワークはスキップ） */
function pickAdType(): AdType {
  const candidates: { type: AdType; weight: number }[] = [];

  // noteは常に候補
  candidates.push({ type: 'note', weight: AD_CONFIG.noteRatio });

  // ExoClick: enabled かつ zoneId が設定済みの場合のみ
  if (AD_CONFIG.exoclick.enabled && AD_CONFIG.exoclick.zoneId) {
    candidates.push({ type: 'exoclick', weight: AD_CONFIG.exoclickRatio });
  }

  // JuicyAds: enabled かつ zoneId が設定済みの場合のみ
  if (AD_CONFIG.juicyads.enabled && AD_CONFIG.juicyads.zoneId) {
    candidates.push({ type: 'juicyads', weight: AD_CONFIG.juicyadsRatio });
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c.type;
  }
  return 'note'; // fallback
}

/** ExoClick広告バナー */
function ExoClickBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    const container = containerRef.current;
    const { exoclick } = AD_CONFIG;

    // スクリプトタグを挿入
    const providerScript = document.createElement('script');
    providerScript.type = 'application/javascript';
    providerScript.src = exoclick.scriptUrl;
    container.appendChild(providerScript);

    // ins要素を挿入
    const ins = document.createElement('ins');
    ins.className = 'adsbyexoclick';
    ins.style.display = 'inline-block';
    ins.style.width = '300px';
    ins.style.height = '250px';
    ins.dataset.zoneid = exoclick.zoneId;
    container.appendChild(ins);

    // push呼び出し
    const pushScript = document.createElement('script');
    pushScript.textContent = '(adsbyexoclick = window.adsbyexoclick || []).push({});';
    container.appendChild(pushScript);
  }, []);

  return <div ref={containerRef} className="flex justify-center" />;
}

/** JuicyAds広告バナー */
function JuicyAdsBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    const container = containerRef.current;
    const { juicyads } = AD_CONFIG;

    // スクリプトタグを挿入
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.dataset.cfasync = 'false';
    script.async = true;
    script.src = juicyads.scriptUrl;
    container.appendChild(script);

    // ins要素を挿入
    const ins = document.createElement('ins');
    ins.id = juicyads.zoneId;
    ins.dataset.width = '300';
    ins.dataset.height = '250';
    container.appendChild(ins);

    // push呼び出しスクリプト（JuicyAds v3.0必須）
    const pushScript = document.createElement('script');
    pushScript.type = 'text/javascript';
    pushScript.textContent = `(window.adsbyjuicy = window.adsbyjuicy || []).push({'adzone':${juicyads.zoneId}});`;
    container.appendChild(pushScript);
  }, []);

  return <div ref={containerRef} className="flex justify-center" />;
}

/** Note自社広告バナー */
function NoteAdImage({ size }: { size: AdSize }) {
  const [adSrc] = useState(getRandomNoteImage);
  const [imgError, setImgError] = useState(false);
  const link = getAdLink(size);

  const handleClick = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'ad_click', { ad_size: size, ad_type: 'note', ad_page: window.location.pathname });
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

    // Check dismiss (24hr)
    try {
      const raw = localStorage.getItem(`ad_dismissed_${size}`);
      if (raw && Date.now() < parseInt(raw, 10)) return;
    } catch {}

    const picked = pickAdType();
    setAdType(picked);
    setVisible(true);

    // GA impression
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'ad_impression', { ad_size: size, ad_type: picked });
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
        {adType === 'exoclick' && <ExoClickBanner />}
        {adType === 'juicyads' && <JuicyAdsBanner />}
        {adType === 'note' && <NoteAdImage size={size} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
