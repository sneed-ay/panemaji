'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';
type AdType = 'note' | 'ninja';

interface AdBannerProps {
  size: AdSize;
  className?: string;
}

const AD_POSITIONS: AdSize[] = ['header', 'rectangle', 'footer'];

function getRandomNoteImage(): string {
  const variants = AD_CONFIG.noteAd.images;
  return variants[Math.floor(Math.random() * variants.length)];
}

function pickAdType(): AdType {
  if (!AD_CONFIG.ninjaAdmax.enabled) return 'note';
  const total = AD_CONFIG.noteRatio + AD_CONFIG.ninjaRatio;
  return Math.random() < AD_CONFIG.noteRatio / total ? 'note' : 'ninja';
}

/**
 * Randomly pick ONE position per page view.
 * Uses sessionStorage to persist across re-renders but reset on new page.
 */
function getActivePosition(): AdSize {
  if (typeof window === 'undefined') return 'header';
  try {
    const key = 'ad_active_pos_' + window.location.pathname;
    const cached = sessionStorage.getItem(key);
    if (cached && AD_POSITIONS.includes(cached as AdSize)) return cached as AdSize;
    const pos = AD_POSITIONS[Math.floor(Math.random() * AD_POSITIONS.length)];
    sessionStorage.setItem(key, pos);
    return pos;
  } catch {
    return AD_POSITIONS[Math.floor(Math.random() * AD_POSITIONS.length)];
  }
}

function NinjaAdMaxBanner({ onDismiss }: { onDismiss: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const script = document.createElement('script');
    script.src = AD_CONFIG.ninjaAdmax.scriptSrc;
    el.appendChild(script);
    return () => { if (el) el.innerHTML = ''; };
  }, []);

  return (
    <div className="relative bg-gray-50 border border-gray-200 rounded-lg text-center py-2 my-3">
      <div className="text-[10px] text-gray-400 mb-1">PR</div>
      <div ref={containerRef} className="inline-block" />
      <button onClick={onDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}

function NoteAdBanner({ adSrc, size, onDismiss, onImgError }: {
  adSrc: string; size: AdSize; onDismiss: () => void; onImgError: () => void;
}) {
  const link = getAdLink(size);
  const handleClick = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'ad_click', { ad_size: size, ad_type: 'note', ad_image: adSrc, ad_page: window.location.pathname });
    } catch {}
  };

  return (
    <div className="relative bg-gray-50 border border-gray-200 rounded-lg text-center py-2 my-3">
      <div className="text-[10px] text-gray-400 mb-1">PR</div>
      <a href={link} target="_blank" rel="noopener noreferrer sponsored"
        className="inline-block w-full max-w-lg px-2" onClick={handleClick}>
        <img src={adSrc} alt="裏垢戦略をチェック" className="w-full h-auto rounded-lg" onError={onImgError} />
      </a>
      <button onClick={onDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}

export default function AdBanner({ size, className = '' }: AdBannerProps) {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [adSrc, setAdSrc] = useState('');
  const [adType, setAdType] = useState<AdType>('note');

  useEffect(() => {
    if (!AD_CONFIG.enabled) return;

    // Only show if this position was randomly selected for this page
    const activePos = getActivePosition();
    if (activePos !== size) return;

    // Check dismiss (24hr)
    try {
      const raw = localStorage.getItem(`ad_dismissed_${size}`);
      if (raw && Date.now() < parseInt(raw, 10)) return;
    } catch {}

    const chosenType = pickAdType();
    setAdType(chosenType);
    if (chosenType === 'note') setAdSrc(getRandomNoteImage());
    setVisible(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'ad_impression', { ad_size: size, ad_type: chosenType });
    } catch {}
  }, [size]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(`ad_dismissed_${size}`, String(Date.now() + 86400000)); } catch {}
  }, [size]);

  if (!AD_CONFIG.enabled || !visible) return null;

  return (
    <div className={className}>
      {adType === 'ninja' ? (
        <NinjaAdMaxBanner onDismiss={handleDismiss} />
      ) : (
        !imgError && adSrc ? (
          <NoteAdBanner adSrc={adSrc} size={size} onDismiss={handleDismiss} onImgError={() => setImgError(true)} />
        ) : null
      )}
    </div>
  );
}
