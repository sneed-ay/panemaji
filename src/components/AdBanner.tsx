'use client';

import { useState, useEffect, useRef } from 'react';
import { AD_CONFIG, getAdLink, getParallyAdLink, wrapClickUrl } from '@/lib/ad-config';
import { pickAdType, type AdType } from '@/lib/pickAdType';
import { pickFreshFanza } from '@/lib/fanzaPool';
// adstir は 2026-05-09 撤去
// parally (sneed) は 2026-05-10 追加 → fanza:note:parally = 1:1:1

type AdSize = 'header' | 'rectangle' | 'footer';

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

/** FANZA動的バナー（DMM API v3 で商品取得→3枚横並び） */
function FanzaWidget() {
  const [items, setItems] = useState<{ title: string; url: string; imageUrl: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const impressionFiredRef = useRef(false);

  useEffect(() => {
    // 大きめのプールを取得し、ページ内 FANZA 共有プールで重複しない3件を選ぶ
    fetch('/api/fanza?n=12')
      .then(r => r.json())
      .then((data: { title: string; url: string; imageUrl: string }[]) => {
        const picked = pickFreshFanza(data, 3);
        if (picked.length > 0) setItems(picked);
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

/** Note自社広告バナー (kaito_ura) */
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

/** Parally 自社広告バナー (sneed) */
function ParallyAdImage({ size }: { size: AdSize }) {
  const [adSrc] = useState(() => getRandomImage(AD_CONFIG.parallyAd.images));
  const [imgError, setImgError] = useState(false);
  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  const link = wrapClickUrl(getParallyAdLink(size), { adType: 'parally', adSize: size, adPage: pagePath });

  const handleClick = () => {
    trackAdEvent('banner_click', 'parally', { ad_size: size });
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

    // 過去の dismiss 状態が localStorage に残っているとユーザーが「広告が二度と出ない」と感じるため
    // ×ボタン廃止に伴い、既存の ad_dismissed_* キーを掃除する (1回だけ走る無害な後始末)
    try {
      for (const key of ['ad_dismissed_header', 'ad_dismissed_rectangle', 'ad_dismissed_footer']) {
        localStorage.removeItem(key);
      }
    } catch {}

    const picked = pickAdType();
    setAdType(picked);
    setVisible(true);

    // banner_view: バナーが表示されるたびに計測（adType別にGAで集計可能）
    trackAdEvent('banner_view', picked, { ad_size: size });
  }, [size]);

  if (!AD_CONFIG.enabled || !visible) return null;

  return (
    <div className={`relative bg-gray-50 border border-gray-200 rounded-lg text-center py-2 my-3 ${className}`}>
      <div className="px-2">
        {adType === 'fanza' && <FanzaWidget />}
        {adType === 'note' && <NoteAdImage size={size} />}
        {adType === 'parally' && <ParallyAdImage size={size} />}
      </div>
    </div>
  );
}
