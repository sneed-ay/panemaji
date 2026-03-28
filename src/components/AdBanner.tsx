'use client';

import { useState, useEffect, useCallback } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';
type AdType = 'note' | 'ninja' | 'exoclick' | 'juicyads';

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

  // 忍者AdMax
  if (AD_CONFIG.ninjaAdmax.enabled && AD_CONFIG.ninjaAdmax.zoneId) {
    candidates.push({ type: 'ninja', weight: AD_CONFIG.ninjaRatio });
  }

  // ExoClick
  if (AD_CONFIG.exoclick.enabled && AD_CONFIG.exoclick.zoneId) {
    candidates.push({ type: 'exoclick', weight: AD_CONFIG.exoclickRatio });
  }

  // JuicyAds
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

/** 忍者AdMax広告バナー - iframe方式 */
function NinjaAdMaxBanner() {
  const { ninjaAdmax } = AD_CONFIG;
  const html = `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;justify-content:center;}</style></head><body>
<script src="https://adm.shinobi.jp/s/${ninjaAdmax.zoneId}" type="text/javascript"></script>
</body></html>`;

  return (
    <div className="flex justify-center">
      <iframe
        srcDoc={html}
        style={{ width: 320, height: 100, border: 'none', overflow: 'hidden' }}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        scrolling="no"
      />
    </div>
  );
}

/** ExoClick広告バナー - iframe方式（SPAでも安定動作） */
function ExoClickBanner() {
  const { exoclick } = AD_CONFIG;
  const html = `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;justify-content:center;}</style></head><body>
<script async type="application/javascript" src="${exoclick.scriptUrl}"></script>
<ins class="eas6a97888e2" data-zoneid="${exoclick.zoneId}"></ins>
<script>(AdProvider = window.AdProvider || []).push({"serve": {}});</script>
</body></html>`;

  return (
    <div className="flex justify-center">
      <iframe
        srcDoc={html}
        style={{ width: 300, height: 250, border: 'none', overflow: 'hidden' }}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        scrolling="no"
      />
    </div>
  );
}

/** JuicyAds広告バナー - iframe方式（SPAでも動作する） */
function JuicyAdsBanner() {
  const { juicyads } = AD_CONFIG;
  const html = `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;justify-content:center;}</style></head><body>
<!-- JuicyAds v3.0 -->
<script type="text/javascript" data-cfasync="false" async src="${juicyads.scriptUrl}"></script>
<ins id="${juicyads.zoneId}" data-width="300" data-height="250"></ins>
<script type="text/javascript">(window.adsbyjuicy = window.adsbyjuicy || []).push({'adzone':${juicyads.zoneId}});</script>
</body></html>`;

  return (
    <div className="flex justify-center">
      <iframe
        srcDoc={html}
        style={{ width: 300, height: 250, border: 'none', overflow: 'hidden' }}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        scrolling="no"
      />
    </div>
  );
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
        {adType === 'ninja' && <NinjaAdMaxBanner />}
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
