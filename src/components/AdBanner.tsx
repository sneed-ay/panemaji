'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink, wrapClickUrl } from '@/lib/ad-config';
import AdstirBanner from './AdstirBanner';

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

/** GA gtag ヘルパー (beacon 送信で target="_blank" 遷移との競合を回避) */
function trackAdEvent(event: 'banner_view' | 'banner_click' | 'banner_impression', adType: AdType, extra: Record<string, string | number> = {}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.gtag) {
      w.gtag('event', event, {
        transport_type: 'beacon',
        ad_type: adType,
        ad_page: typeof window !== 'undefined' ? window.location.pathname : '',
        ...extra,
      });
    }
  } catch {}
}

/**
 * モジュールレベルで「ページ内で既に表示した FANZA 商品の URL」を記録し、
 * 同一ページに複数 FanzaWidget が居ても別の商品を引けるようにする。
 * ページ遷移時も保持されるが、各 .then() で都度フィルタするので害は限定的。
 * 無制限に膨れないよう 200 件でリセット。
 */
const shownFanzaUrls = new Set<string>();
function rememberFanzaUrls(urls: string[]) {
  for (const u of urls) shownFanzaUrls.add(u);
  if (shownFanzaUrls.size > 200) shownFanzaUrls.clear();
}

/** FANZA動的バナー（DMM API v3 で商品取得→カスタム表示） */
function FanzaWidget() {
  const [items, setItems] = useState<{ title: string; url: string; imageUrl: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const impressionFiredRef = useRef(false);

  useEffect(() => {
    // 大きめのプールを取得し、まだ同一ページで出していない商品から3件を選ぶ
    fetch('/api/fanza?n=12')
      .then(r => r.json())
      .then((data: { title: string; url: string; imageUrl: string }[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const fresh = data.filter(it => !shownFanzaUrls.has(it.url));
        const picked = (fresh.length >= 3 ? fresh : [...fresh, ...data.filter(it => !fresh.includes(it))]).slice(0, 3);
        rememberFanzaUrls(picked.map(it => it.url));
        setItems(picked);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // 実際にFANZA商品が表示されたらimpression計測
  useEffect(() => {
    if (items.length > 0 && !impressionFiredRef.current) {
      impressionFiredRef.current = true;
      trackAdEvent('banner_impression', 'fanza', { items_count: items.length });
    }
  }, [items]);

  const handleFanzaClick = (index: number, url: string) => {
    trackAdEvent('banner_click', 'fanza', { item_index: index, item_url: url.substring(0, 100) });
  };

  if (loaded && items.length === 0) return <NoteAdImage size="rectangle" />;
  if (!loaded) return <div className="flex justify-center min-h-[50px]" />;

  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  return (
    <div className="flex gap-2 justify-center overflow-hidden">
      {items.map((item, i) => (
        <a key={i}
          href={wrapClickUrl(item.url, { adType: 'fanza', adSize: 'rectangle', adPage: pagePath })}
          target="_blank" rel="noopener noreferrer sponsored"
          className="shrink-0 w-[100px] hover:opacity-80 transition-opacity no-underline"
          onClick={() => handleFanzaClick(i, item.url)}>
          <img src={item.imageUrl} alt="" className="w-full h-auto rounded" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

/** Note自社広告バナー */
function NoteAdImage({ size }: { size: AdSize }) {
  const [adSrc] = useState(() => getRandomImage(AD_CONFIG.noteAd.images));
  const [imgError, setImgError] = useState(false);
  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  const link = wrapClickUrl(getAdLink(size), { adType: 'note', adSize: size, adPage: pagePath });

  const handleClick = () => {
    trackAdEvent('banner_click', 'note', { ad_size: size });
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

    try {
      const raw = localStorage.getItem(`ad_dismissed_${size}`);
      if (raw && Date.now() < parseInt(raw, 10)) return;
    } catch {}

    const picked = pickAdType();
    setAdType(picked);
    setVisible(true);

    // banner_view: バナーが表示されるたびに計測（adType別にGAで集計可能）
    trackAdEvent('banner_view', picked, { ad_size: size });
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
        {adType === 'fanza' && <FanzaWidget />}
        {adType === 'note' && <NoteAdImage size={size} />}
        {adType === 'adstir' && <AdstirBanner size={size} placement="banner" fallback={<NoteAdImage size={size} />} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
