'use client';

import { useEffect, useRef } from 'react';
import { AD_CONFIG } from '@/lib/ad-config';

/**
 * Adsterra Social Bar — 口コミ3件目の後に表示
 * Adsterra側で広告在庫がマッチングされ次第、自動で表示開始
 */
export function AdsterraSocialBar() {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!AD_CONFIG.adsterra.enabled || !AD_CONFIG.adsterra.socialBarZoneId || loadedRef.current) return;
    loadedRef.current = true;

    const script = document.createElement('script');
    script.src = `https://alwingulla.com/${AD_CONFIG.adsterra.socialBarZoneId}/invoke.js`;
    script.async = true;
    script.dataset.cfasync = 'false';
    document.body.appendChild(script);

    return () => {
      try { document.body.removeChild(script); } catch {}
    };
  }, []);

  if (!AD_CONFIG.adsterra.enabled || !AD_CONFIG.adsterra.socialBarZoneId) return null;
  return <div id={`container-${AD_CONFIG.adsterra.socialBarZoneId}`} />;
}
