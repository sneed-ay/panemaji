import { AD_CONFIG } from '@/lib/ad-config';

// 2026-05-09: adstir 撤去 (CPM ¥2.71)
// 2026-05-10: parally 追加 → fanza:note:parally = 1:1:1
// 2026-06-12: note(kaito_ura) 完全撤去 → fanza:parally = 1:1 のみ
// 2026-08-25: めろカノ 追加 → merokano:fanza = 4:1 (parally は Ratio 0 で停止)
export type AdType = 'fanza' | 'parally' | 'merokano';

/**
 * 配信比率 (AD_CONFIG.{merokano,fanza,parally}Ratio) に基づいて広告タイプを1つ抽選。
 * メインの AdBanner で使用。Ratio 0 の広告は候補に入らない。
 */
export function pickAdType(): AdType {
  const candidates: { type: AdType; weight: number }[] = [];

  if (AD_CONFIG.merokanoAd.images.length > 0 && AD_CONFIG.merokanoRatio > 0) {
    candidates.push({ type: 'merokano', weight: AD_CONFIG.merokanoRatio });
  }
  if (AD_CONFIG.fanza.enabled && AD_CONFIG.fanzaRatio > 0) {
    candidates.push({ type: 'fanza', weight: AD_CONFIG.fanzaRatio });
  }
  if (AD_CONFIG.parallyAd.images.length > 0 && AD_CONFIG.parallyRatio > 0) {
    candidates.push({ type: 'parally', weight: AD_CONFIG.parallyRatio });
  }

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return 'fanza';
  let rand = Math.random() * total;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c.type;
  }
  return 'fanza';
}
