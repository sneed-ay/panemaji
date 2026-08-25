'use client';

import { useState, useEffect, useRef } from 'react';
import { AD_CONFIG, getParallyAdLink, getMerokanoAdLink, wrapClickUrl } from '@/lib/ad-config';
import { pickAdType, type AdType } from '@/lib/pickAdType';
import { pickFreshFanza } from '@/lib/fanzaPool';
// adstir は 2026-05-09 撤去
// parally (sneed) は 2026-05-10 追加 → fanza:note:parally = 1:1:1
// めろカノ (merokano.jp) は 2026-08-25 追加 → merokano:fanza = 4:1 (parally は Ratio 0 で停止)

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

  // 2026-06-12: note(kaito_ura) 撤去 → FANZA0件時のフォールバックは parally に
  // 2026-08-25: parally 停止 → フォールバックは めろカノ に
  if (loaded && items.length === 0) return <MerokanoAdImage size="rectangle" />;
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
          {/* width/height 必須: 無いと読み込み前の高さが 0 になり、loading="lazy" の
              交差判定が成立せず画像が永久にフェッチされない (2026-08-25 修正)。
              広告枠なので確実にインプレッションを出すため lazy 自体も外す。
              DMM の ps.jpg サムネは 147x200。読み込み後は h-auto で実比率に従う。 */}
          <img src={item.imageUrl} alt="" className="w-full h-auto rounded" width={147} height={200} />
        </a>
      ))}
    </div>
  );
}

/** めろカノ バナー広告 (merokano.jp) */
function MerokanoAdImage({ size }: { size: AdSize }) {
  const [adSrc] = useState(() => getRandomImage(AD_CONFIG.merokanoAd.images));
  const [imgError, setImgError] = useState(false);
  // 同じ basename で -512 / (無印=1024) / -1536 の3解像度を public/ad/ に配置してある
  const srcBase = adSrc.replace(/\.webp$/, '');
  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  const link = wrapClickUrl(getMerokanoAdLink(size), { adType: 'merokano', adSize: size, adPage: pagePath });

  const handleClick = () => {
    trackAdEvent('banner_click', 'merokano', { ad_size: size });
  };

  if (imgError) return null;

  return (
    <a href={link} target="_blank" rel="noopener noreferrer sponsored"
      className="inline-block w-full max-w-lg" onClick={handleClick}>
      {/* 表示幅は px-2 の内側で最大 max-w-lg(512px)。DPR に応じて 1024/1536 を出し分ける。
          - DPR3 のスマホは 512css x3 = 1536px 必要。1024 固定だと引き伸ばしでボケる
          - DPR1 でも下限は 1024px にする。512px を等倍で出すより、1024px を
            ブラウザに縮小させた方が 2倍スーパーサンプリングが効いて精細に見えるため
          (2026-08-25 修正) */}
      <img src={adSrc} alt="めろカノ - 推し活アプリ [PR]" className="w-full h-auto rounded-lg"
        srcSet={`${srcBase}.webp 1024w, ${srcBase}-1536.webp 1536w`}
        sizes="(max-width: 528px) calc(100vw - 16px), 512px"
        width={1024} height={318} onError={() => setImgError(true)} />
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
  const [adType, setAdType] = useState<AdType>('fanza');

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
        {adType === 'merokano' && <MerokanoAdImage size={size} />}
        {adType === 'fanza' && <FanzaWidget />}
        {adType === 'parally' && <ParallyAdImage size={size} />}
      </div>
    </div>
  );
}
