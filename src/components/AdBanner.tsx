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
    // Hide for 24 hours
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(getDismissKey(size), String(expiry));
  } catch {
    // localStorage unavailable
  }
}

/** Pick a random rectangle image variant */
function getRandomRectangle(): string {
  const variants = AD_CONFIG.images.rectangle;
  return variants[Math.floor(Math.random() * variants.length)];
}

export default function AdBanner({ size, className = '' }: AdBannerProps) {
  const [visible, setVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [rectangleSrc, setRectangleSrc] = useState<string>('');

  useEffect(() => {
    if (!AD_CONFIG.enabled) return;
    if (isDismissed(size)) return;
    setVisible(true);
    if (size === 'rectangle') {
      setRectangleSrc(getRandomRectangle());
    }
  }, [size]);

  const handleDismiss = useCallback(() => {
    dismissAd(size);
    setVisible(false);
  }, [size]);

  const handleImgError = useCallback(() => {
    setImgError(true);
  }, []);

  if (!AD_CONFIG.enabled || !visible || imgError) return null;

  const link = getAdLink(size);

  if (size === 'header') {
    return (
      <div className={`relative bg-gray-100 text-center py-2 ${className}`}>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block"
        >
          {/* PC: 728x90 */}
          <img
            src={AD_CONFIG.images.header_pc}
            alt="note記事をチェック"
            width={728}
            height={90}
            className="hidden md:inline-block max-w-full h-auto"
            onError={handleImgError}
          />
          {/* SP: 320x100 */}
          <img
            src={AD_CONFIG.images.header_sp}
            alt="note記事をチェック"
            width={320}
            height={100}
            className="inline-block md:hidden max-w-full h-auto"
            onError={handleImgError}
          />
        </a>
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full text-xs leading-none transition-colors"
          aria-label="広告を閉じる"
        >
          &times;
        </button>
      </div>
    );
  }

  if (size === 'rectangle') {
    if (!rectangleSrc) return null;
    return (
      <div className={`text-center my-4 ${className}`}>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block"
        >
          <img
            src={rectangleSrc}
            alt="note記事をチェック"
            width={300}
            height={250}
            className="max-w-full h-auto rounded-lg shadow"
            onError={handleImgError}
          />
        </a>
      </div>
    );
  }

  if (size === 'footer') {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-100 text-center py-1 md:hidden ${className}`}
      >
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block"
        >
          <img
            src={AD_CONFIG.images.footer_sp}
            alt="note記事をチェック"
            width={320}
            height={50}
            className="max-w-full h-auto"
            onError={handleImgError}
          />
        </a>
        <button
          onClick={handleDismiss}
          className="absolute top-0 right-1 w-5 h-5 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full text-[10px] leading-none transition-colors"
          aria-label="広告を閉じる"
        >
          &times;
        </button>
      </div>
    );
  }

  return null;
}
