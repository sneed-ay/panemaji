'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AD_CONFIG, getAdLink, wrapClickUrl } from '@/lib/ad-config';

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

/** FANZA動的バナー（DMM API v3 で商品取得→カスタム表示） */
function FanzaWidget() {
  const [items, setItems] = useState<{ title: string; url: string; imageUrl: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const impressionFiredRef = useRef(false);

  useEffect(() => {
    fetch('/api/fanza')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setItems(data.slice(0, 3)); })
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

// モジュールレベルのフラグ: ページ内に1つだけadstirバナーを出す
// 複数同時実行されても adstir_vars は各iframe内でローカルに宣言するので問題ないが、
// 同一 app_id / ad_spot のリクエストを重複させない方針で1枠に絞る
let adstirInstanceExists = false;

/**
 * adstir SSP広告バナー（iframe sandbox 方式）
 *
 * adstir.js は内部で document.write() を21箇所使っている同期版SDK。
 * Next.js / SPA で <script> を dynamic inject しても DOMContentLoaded 後は
 * document.write が無効化され、SDKが広告配信リクエストを発行できない。
 *
 * 対策: 新規iframeを作り contentDocument.write() で公式タグを書き込む。
 * iframe 内部は独立した document lifecycle を持つため document.write が機能する。
 */
function AdstirBanner({ size }: { size: AdSize }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    if (adstirInstanceExists) {
      setShowFallback(true);
      return;
    }
    adstirInstanceExists = true;

    const { adstir } = AD_CONFIG;
    const container = containerRef.current;
    if (!container) return;

    // sandboxとなる iframe を作成（300x250固定、公式枠サイズ）
    const sandbox = document.createElement('iframe');
    sandbox.style.cssText = 'width:300px;height:250px;border:0;display:block;';
    sandbox.setAttribute('scrolling', 'no');
    sandbox.setAttribute('frameborder', '0');
    sandbox.setAttribute('title', 'Ad');
    container.appendChild(sandbox);

    // iframe 内部に公式タグを書き込む
    const innerDoc = sandbox.contentDocument;
    if (!innerDoc) {
      adstirInstanceExists = false;
      setShowFallback(true);
      return;
    }
    innerDoc.open();
    innerDoc.write(
      '<!doctype html><html><head><base target="_top"><meta charset="utf-8"></head>' +
      '<body style="margin:0;padding:0;">' +
      '<script type="text/javascript">var adstir_vars = { ver: "4.0", app_id: "' + adstir.appId + '", ad_spot: ' + adstir.spot + ', center: false };<\/script>' +
      '<script type="text/javascript" src="' + adstir.scriptUrl + '"><\/script>' +
      '</body></html>'
    );
    innerDoc.close();

    // 広告iframeが iframe 内部に生成されたら impression を計測してフォールバック解除
    let impressionFired = false;
    const moveTimer = setInterval(() => {
      const innerIframe = innerDoc.querySelector('iframe');
      if (innerIframe && !impressionFired) {
        impressionFired = true;
        trackAdEvent('banner_impression', 'adstir', { ad_size: size });
        clearInterval(moveTimer);

        // ネストiframeへのフォーカス移動をクリックプロキシとして計測
        // 注: cross-origin iframe のため実クリックは取得不可。タブ切替・アラート等で
        // 誤発火する可能性あり (精度低)。正確な実績は adstir 管理画面を参照すること。
        const onBlur = () => {
          setTimeout(() => {
            // document.activeElementは外側iframe=sandboxを指す
            if (document.activeElement === sandbox) {
              trackAdEvent('banner_click', 'adstir', { ad_size: size });
            }
          }, 100);
        };
        window.addEventListener('blur', onBlur);
      }
    }, 500);

    // 5秒以内に広告iframeが生成されなかったら no-fill とみなして note 自社広告へ
    const fallbackTimer = setTimeout(() => {
      clearInterval(moveTimer);
      if (!innerDoc.querySelector('iframe')) {
        sandbox.remove();
        adstirInstanceExists = false;
        setShowFallback(true);
      }
    }, 5000);

    return () => {
      clearInterval(moveTimer);
      clearTimeout(fallbackTimer);
      adstirInstanceExists = false;
    };
  }, []);

  if (showFallback) return <NoteAdImage size={size} />;
  return <div ref={containerRef} className="flex justify-center min-h-[250px]" />;
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
        {adType === 'adstir' && <AdstirBanner size={size} />}
      </div>
      <button onClick={handleDismiss}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full text-xs"
        aria-label="閉じる">×</button>
    </div>
  );
}
