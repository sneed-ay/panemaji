'use client';

import { useEffect, useRef } from 'react';
import { AD_CONFIG } from '@/lib/ad-config';

/**
 * Adsterra Social Bar — 口コミセクションの後に表示
 * 登録後にzoneIdを設定してenabledをtrueにする
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

/**
 * Adsterra Popunder — layout.tsxでグローバル読み込み
 * 24時間に1回だけ発火、localStorage で頻度制御
 */
export function AdsterraPopunder() {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!AD_CONFIG.adsterra.enabled || !AD_CONFIG.adsterra.popunderZoneId || loadedRef.current) return;

    // 24時間頻度制御
    try {
      const lastShown = localStorage.getItem('adsterra_popunder_last');
      if (lastShown) {
        const elapsed = Date.now() - parseInt(lastShown, 10);
        const freqMs = AD_CONFIG.adsterra.popunderFrequencyHours * 3600000;
        if (elapsed < freqMs) return;
      }
    } catch {}

    loadedRef.current = true;

    const script = document.createElement('script');
    script.src = `https://alwingulla.com/${AD_CONFIG.adsterra.popunderZoneId}/invoke.js`;
    script.async = true;
    script.dataset.cfasync = 'false';
    document.body.appendChild(script);

    // 表示時刻を記録
    try { localStorage.setItem('adsterra_popunder_last', String(Date.now())); } catch {}

    return () => {
      try { document.body.removeChild(script); } catch {}
    };
  }, []);

  return null; // Popunder は視覚的要素なし
}
