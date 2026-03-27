'use client';

import { useState, useEffect, useCallback } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';

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
function getRandomAd(): string {
  const variants = AD_CONFIG.images.rectangle;
  return variants[Math.floor(Math.random() * variants.length)];
}

export default function AdBanner({ size, className = '' }: AdBannerProps) {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [adSrc, setAdSrc] = useState<string>('');

  useEffect(() => {
    if (!AD_CONFIG.enabled) return;
    if (isDismissed(size)) return;
    const src = getRandomAd();
    setAdSrc(src);
    setVisible(true);
    // Send GA4 impression event
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) {
        w.gtag('event', 'ad_impression', {
          ad_size: size,
          ad_image: src,
          ad_link: AD_CONFIG.link,
        });
      }
    } catch {}
  }, [size]);

  const handleDismiss = useCallback(() => {
    dismissAd(size);
    setVisible(false);
  }, [size]);

  const handleImgError = useCallback(() => {
    setImgError(true);
  }, []);

  const handleClick = useCallback(() => {
    // Send GA4 click event with link info for per-link tracking
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) {
        w.gtag('event', 'ad_click', {
          ad_size: size,
          ad_image: adSrc,
          ad_link: AD_CONFIG.link,
          ad_page: window.location.pathname,
        });
      }
    } catch {}
  }, [size, adSrc]);

  if (!AD_CONFIG.enabled || !visible || imgError || !adSrc) return null;

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
