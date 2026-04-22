import { AD_CONFIG } from '@/lib/ad-config';

export type AdType = 'note' | 'fanza' | 'adstir';

/**
 * 配信比率 (AD_CONFIG.fanzaRatio / noteRatio / adstirRatio) に基づいて広告タイプを1つ抽選。
 * メインの AdBanner と ContentLocker で共有する。
 */
export function pickAdType(): AdType {
  const candidates: { type: AdType; weight: number }[] = [];

  if (AD_CONFIG.fanza.enabled) {
    candidates.push({ type: 'fanza', weight: AD_CONFIG.fanzaRatio });
  }
  candidates.push({ type: 'note', weight: AD_CONFIG.noteRatio });
  if (AD_CONFIG.adstir.enabled && AD_CONFIG.adstir.appId) {
    candidates.push({ type: 'adstir', weight: AD_CONFIG.adstirRatio });
  }

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return 'note';
  let rand = Math.random() * total;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c.type;
  }
  return 'note';
}
