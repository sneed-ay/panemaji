'use client';

import { useEffect, useRef, useState } from 'react';
import { AD_CONFIG } from '@/lib/ad-config';

type AdSize = 'header' | 'rectangle' | 'footer' | 'locker';
type AdPlacement = 'banner' | 'locker';

// placement 単位で「ページ内に同時1枠」ロック。banner と locker は独立して1枠ずつ出せる
const mountedPlacements: Set<AdPlacement> = new Set();

function trackAdEvent(
  event: 'banner_impression' | 'banner_click',
  extra: Record<string, string | number> = {}
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.gtag) {
      w.gtag('event', event, {
        transport_type: 'beacon',
        ad_type: 'adstir',
        ad_page: typeof window !== 'undefined' ? window.location.pathname : '',
        ...extra,
      });
    }
  } catch {}
}

export interface AdstirBannerProps {
  size: AdSize;
  /** 'banner'（通常ページ内広告枠）/ 'locker'（ContentLocker内）。
   *  各 placement は独立して1枠ずつ出せるため、同時に2枠まで広告表示可。 */
  placement?: AdPlacement;
  /** adstir が 5 秒以内に広告を返さなかった場合のフォールバック要素 */
  fallback?: React.ReactNode;
}

/**
 * adstir SSP広告バナー（iframe sandbox 方式）
 *
 * adstir.js は内部で document.write() を使う同期版SDK。
 * Next.js/SPA で <script> を dynamic inject すると DOMContentLoaded 後は
 * document.write が無効化されて配信リクエストが走らない。
 *
 * 対策: 新規 iframe を作り contentDocument.write() で公式タグを書き込む。
 * iframe 内部は独立した document lifecycle を持つため document.write が機能する。
 */
export default function AdstirBanner({ size, placement = 'banner', fallback = null }: AdstirBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    if (mountedPlacements.has(placement)) {
      setShowFallback(true);
      return;
    }
    mountedPlacements.add(placement);

    const { adstir } = AD_CONFIG;
    const container = containerRef.current;
    if (!container) return;

    // srcdoc に初期 HTML を埋め込んで通常の document lifecycle を走らせる。
    // innerDoc.open()/write()/close() 方式は close() 後の adstir SDK 内部 document.write が効かず
    // ad iframe が生成されないケースがあるため srcdoc に切り替え。
    const sandbox = document.createElement('iframe');
    sandbox.style.cssText = 'width:300px;height:250px;border:0;display:block;';
    sandbox.setAttribute('scrolling', 'no');
    sandbox.setAttribute('frameborder', '0');
    sandbox.setAttribute('title', 'Ad');
    sandbox.srcdoc =
      '<!doctype html><html><head><base target="_top"><meta charset="utf-8"></head>' +
      '<body style="margin:0;padding:0;">' +
      '<script>var adstir_vars = { ver: "4.0", app_id: "' + adstir.appId + '", ad_spot: ' + adstir.spot + ', center: false };<\/script>' +
      '<script src="' + adstir.scriptUrl + '"><\/script>' +
      '</body></html>';
    container.appendChild(sandbox);

    let impressionFired = false;
    const moveTimer = setInterval(() => {
      const innerDoc = sandbox.contentDocument;
      const innerIframe = innerDoc?.querySelector('iframe');
      if (innerIframe && !impressionFired) {
        impressionFired = true;
        trackAdEvent('banner_impression', { ad_size: size, ad_placement: placement });
        clearInterval(moveTimer);

        const onBlur = () => {
          setTimeout(() => {
            if (document.activeElement === sandbox) {
              trackAdEvent('banner_click', { ad_size: size, ad_placement: placement });
            }
          }, 100);
        };
        window.addEventListener('blur', onBlur);
      }
    }, 500);

    // 8 秒まで待つ（5 秒だと adstir のレスポンス前にタイムアウトしがち）
    const fallbackTimer = setTimeout(() => {
      clearInterval(moveTimer);
      const innerDoc = sandbox.contentDocument;
      if (!innerDoc?.querySelector('iframe')) {
        sandbox.remove();
        mountedPlacements.delete(placement);
        setShowFallback(true);
      }
    }, 8000);

    return () => {
      clearInterval(moveTimer);
      clearTimeout(fallbackTimer);
      mountedPlacements.delete(placement);
    };
  }, [placement, size]);

  if (showFallback) return <>{fallback}</>;
  return <div ref={containerRef} className="flex justify-center min-h-[250px]" />;
}
