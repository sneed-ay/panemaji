'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink } from '@/lib/ad-config';

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

/** FANZA動的バナー（DMM API v3 で商品取得→カスタム表示） */
function FanzaWidget() {
  const [items, setItems] = useState<{ title: string; url: string; imageUrl: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/fanza')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setItems(data.slice(0, 3)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && items.length === 0) return <NoteAdImage size="rectangle" />;
  if (!loaded) return <div className="flex justify-center min-h-[50px]" />;

  return (
    <div className="flex gap-2 justify-center overflow-hidden">
      {items.map((item, i) => (
        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer sponsored"
          className="shrink-0 w-[100px] hover:opacity-80 transition-opacity no-underline">
          <img src={item.imageUrl} alt="" className="w-full h-auto rounded" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

// モジュールレベルのフラグ: ページ内に1つだけadstirバナーを出す
// adstir SDKは window.adstir_vars を読み取って void 0 に消す仕様のため、
// 複数バナーが同時実行されると2個目以降が「adstir_vars is undefined」エラーになる
let adstirInstanceExists = false;

/** adstir SSP広告バナー */
function AdstirBanner({ size }: { size: AdSize }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // 既に別のAdBannerインスタンスでadstirが動いている場合は自社広告にフォールバック
    if (adstirInstanceExists) {
      setShowFallback(true);
      return;
    }
    adstirInstanceExists = true;

    const { adstir } = AD_CONFIG;

    // wrapper を body 直下に配置（React管理外のDOM）
    const wrapper = document.createElement('div');
    wrapper.id = `adstir-wrapper-${adstir.spot}`;
    wrapper.style.cssText = 'display:flex;justify-content:center;';
    document.body.appendChild(wrapper);

    // adstir_vars を明示的に window に設定（var だとscriptタグ内のローカルになるため）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).adstir_vars = { ver: '4.0', app_id: adstir.appId, ad_spot: adstir.spot, center: true };

    // script は wrapper 内に入れる（adstirはscriptタグの直後にiframeを挿入する仕様）
    const sdkScript = document.createElement('script');
    sdkScript.type = 'text/javascript';
    sdkScript.src = `${adstir.scriptUrl}?_=${Date.now()}-${Math.random()}`;
    wrapper.appendChild(sdkScript);

    // adstirがwrapperにiframeを作ったらReactコンテナに移動
    const moveTimer = setInterval(() => {
      const iframe = wrapper.querySelector('iframe');
      if (iframe && containerRef.current) {
        containerRef.current.appendChild(wrapper);
        clearInterval(moveTimer);
      }
    }, 500);

    const fallbackTimer = setTimeout(() => {
      clearInterval(moveTimer);
      if (!wrapper.querySelector('iframe')) {
        wrapper.remove();
        adstirInstanceExists = false; // fallback時はフラグを解放
        setShowFallback(true);
      }
    }, 5000);

    return () => {
      clearInterval(moveTimer);
      clearTimeout(fallbackTimer);
      adstirInstanceExists = false; // unmount時にフラグを解放
    };
  }, []);

  if (showFallback) return <NoteAdImage size={size} />;
  return <div ref={containerRef} className="flex justify-center min-h-[250px]" />;
}

/** Note自社広告バナー */
function NoteAdImage({ size }: { size: AdSize }) {
  const [adSrc] = useState(() => getRandomImage(AD_CONFIG.noteAd.images));
  const [imgError, setImgError] = useState(false);
  const link = getAdLink(size);

  const handleClick = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'banner_click', { ad_size: size, ad_type: 'note', ad_page: window.location.pathname });
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

    try {
      const raw = localStorage.getItem(`ad_dismissed_${size}`);
      if (raw && Date.now() < parseInt(raw, 10)) return;
    } catch {}

    const picked = pickAdType();
    setAdType(picked);
    setVisible(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.gtag) w.gtag('event', 'banner_view', { ad_size: size, ad_type: picked });
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
        {adType === 'fanza' && <FanzaWidget />}
        {adType === 'note' && <NoteAdImage size={size} />}
        {adType === 'adstir' && <AdstirBanner size={size} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
