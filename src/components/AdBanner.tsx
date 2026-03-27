'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer';

interface AdBannerProps {
  size: AdSize;
  className?: string;
}

function getRandomNoteImage(): string {
  const variants = AD_CONFIG.noteAd.images;
  return variants[Math.floor(Math.random() * variants.length)];
}

/** 忍者AdMax (SP 320x100) - iframe方式でdocument.write対応 */
function NinjaAdMaxBanner() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;overflow:hidden;display:flex;justify-content:center;}</style></head><body><script src="${AD_CONFIG.ninjaAdmax.scriptSrc}"><\/script></body></html>`);
    doc.close();
  }, []);
  return (
    <iframe
      ref={iframeRef}
      className="border-0 mx-auto block"
      style={{ width: '320px', height: '100px' }}
      scrolling="no"
      title="ad"
    />
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!AD_CONFIG.enabled) return;

    // Check dismiss (24hr)
    try {
      const raw = localStorage.getItem(`ad_dismissed_${size}`);
      if (raw && Date.now() < parseInt(raw, 10)) return;
    } catch {}

    // Detect mobile
    setIsMobile(window.innerWidth < 768);
    setVisible(true);

    // GA impression
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'ad_impression', { ad_size: size, ad_type: isMobile ? 'ninja_admax' : 'note' });
    } catch {}
  }, [size, isMobile]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(`ad_dismissed_${size}`, String(Date.now() + 86400000)); } catch {}
  }, [size]);

  if (!AD_CONFIG.enabled || !visible) return null;

  // SP: 忍者AdMax (note:忍者 = 1:2)、PC: note広告のみ
  const showNinja = isMobile && AD_CONFIG.ninjaAdmax.enabled && Math.random() > 0.33;

  return (
    <div className={`relative bg-gray-50 border border-gray-200 rounded-lg text-center py-2 my-3 ${className}`}>
      <div className="text-[10px] text-gray-400 mb-1">PR</div>
      <div className="px-2">
        {showNinja ? <NinjaAdMaxBanner /> : <NoteAdImage size={size} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
