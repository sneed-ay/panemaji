'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';
type AdType = 'note' | 'ninja';

const AD_POSITIONS: AdSize[] = ['header', 'rectangle', 'footer'];

interface AdBannerProps {
  size: AdSize;
  className?: string;
}

const DISMISS_KEY_PREFIX = 'ad_dismissed_';

function getDismissKey(size: AdSize): string {
  return `${DISMISS_KEY_PREFIX}${size}`;
}

function isDismissed(size: AdSize): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(getDismissKey(size));
    if (!raw) return false;
    const expiry = parseInt(raw, 10);
    if (Date.now() < expiry) return true;
    localStorage.removeItem(getDismissKey(size));
    return false;
  } catch {
    return false;
  }
}

function dismissAd(size: AdSize): void {
  try {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(getDismissKey(size), String(expiry));
  } catch {}
}

/** Pick a random ad image from the 4 patterns */
function getRandomNoteImage(): string {
  const variants = AD_CONFIG.noteAd.images;
  return variants[Math.floor(Math.random() * variants.length)];
}

/** Determine ad type based on note:ninja ratio (1:2) */
function pickAdType(): AdType {
  if (!AD_CONFIG.ninjaAdmax.enabled) return 'note';
  const total = AD_CONFIG.noteRatio + AD_CONFIG.ninjaRatio;
  const threshold = AD_CONFIG.noteRatio / total; // 0.33
  return Math.random() < threshold ? 'note' : 'ninja';
}

/**
 * Get the active ad position for the current page.
 * Uses a module-level cache so all instances on the same page get the same value.
 */
let _cachedActivePosition: AdSize | null = null;
let _cachedAdType: AdType | null = null;

function getActivePosition(): AdSize {
  if (_cachedActivePosition) return _cachedActivePosition;
  _cachedActivePosition = AD_POSITIONS[Math.floor(Math.random() * AD_POSITIONS.length)];
  return _cachedActivePosition;
}

function getAdType(): AdType {
  if (_cachedAdType) return _cachedAdType;
  _cachedAdType = pickAdType();
  return _cachedAdType;
}

/** Ninja AdMax component - dynamically loads script on client side */
function NinjaAdMaxBanner({ size, className, onDismiss }: { size: AdSize; className: string; onDismiss: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const script = document.createElement('script');
    script.src = AD_CONFIG.ninjaAdmax.scriptSrc;
    container.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  if (size === 'header') {
    return (
      <div className={`relative bg-gray-900 text-center py-1 ${className}`}>
        <div ref={containerRef} className="inline-block w-full max-w-3xl px-2" />
        <button
          onClick={onDismiss}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-xs leading-none transition-colors"
          aria-label="広告を閉じる"
        >
          &times;
        </button>
      </div>
    );
  }

  if (size === 'rectangle') {
    return (
      <div className={`text-center my-4 ${className}`}>
        <div ref={containerRef} className="inline-block w-full max-w-lg px-2" />
      </div>
    );
  }

  if (size === 'footer') {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-center py-1 md:hidden ${className}`}>
        <div ref={containerRef} className="inline-block w-full max-w-md px-2" />
        <button
          onClick={onDismiss}
          className="absolute top-0 right-1 w-5 h-5 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-[10px] leading-none transition-colors"
          aria-label="広告を閉じる"
        >
          &times;
        </button>
      </div>
    );
  }

  return null;
}

export default function AdBanner({ size, className = '' }: AdBannerProps) {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [adSrc, setAdSrc] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const [adType, setAdType] = useState<AdType>('note');

  useEffect(() => {
    if (!AD_CONFIG.enabled) return;

    // Determine which single position should show the ad on this page
    const activePos = getActivePosition();

    // Only show if this instance's position matches the chosen one
    if (activePos !== size) return;

    setIsActive(true);

    if (isDismissed(size)) return;

    const chosenType = getAdType();
    setAdType(chosenType);

    if (chosenType === 'note') {
      const src = getRandomNoteImage();
      setAdSrc(src);
      // Send GA4 impression event for note ad
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.gtag) {
          w.gtag('event', 'ad_impression', {
            ad_size: size,
            ad_type: 'note',
            ad_image: src,
            ad_link: AD_CONFIG.noteAd.link,
          });
        }
      } catch {}
    } else {
      // Send GA4 impression event for ninja ad
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.gtag) {
          w.gtag('event', 'ad_impression', {
            ad_size: size,
            ad_type: 'ninja_admax',
          });
        }
      } catch {}
    }

    setVisible(true);
  }, [size]);

  const handleDismiss = useCallback(() => {
    dismissAd(size);
    setVisible(false);
  }, [size]);

  const handleImgError = useCallback(() => {
    setImgError(true);
  }, []);

  const handleClick = useCallback(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) {
        w.gtag('event', 'ad_click', {
          ad_size: size,
          ad_type: 'note',
          ad_image: adSrc,
          ad_link: AD_CONFIG.noteAd.link,
          ad_page: window.location.pathname,
        });
      }
    } catch {}
  }, [size, adSrc]);

  if (!AD_CONFIG.enabled || !visible || !isActive) return null;

  // Ninja AdMax ad
  if (adType === 'ninja') {
    return <NinjaAdMaxBanner size={size} className={className} onDismiss={handleDismiss} />;
  }

  // Note ad (existing behavior)
  if (imgError || !adSrc) return null;

  const link = getAdLink(size);

  if (size === 'header') {
    return (
      <div className={`relative bg-gray-900 text-center py-1 ${className}`}>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block w-full max-w-3xl px-2"
          onClick={handleClick}
        >
          <img
            src={adSrc}
            alt="裏垢戦略をチェック"
            className="w-full h-auto rounded"
            onError={handleImgError}
          />
        </a>
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-xs leading-none transition-colors"
          aria-label="広告を閉じる"
        >
          &times;
        </button>
      </div>
    );
  }

  if (size === 'rectangle') {
    return (
      <div className={`text-center my-4 ${className}`}>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block w-full max-w-lg px-2"
          onClick={handleClick}
        >
          <img
            src={adSrc}
            alt="裏垢戦略をチェック"
            className="w-full h-auto rounded-lg shadow"
            onError={handleImgError}
          />
        </a>
      </div>
    );
  }

  if (size === 'footer') {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-center py-1 md:hidden ${className}`}
      >
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block w-full max-w-md px-2"
          onClick={handleClick}
        >
          <img
            src={adSrc}
            alt="裏垢戦略をチェック"
            className="w-full h-auto"
            onError={handleImgError}
          />
        </a>
        <button
          onClick={handleDismiss}
          className="absolute top-0 right-1 w-5 h-5 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full text-[10px] leading-none transition-colors"
          aria-label="広告を閉じる"
        >
          &times;
        </button>
      </div>
    );
  }

  return null;
}
