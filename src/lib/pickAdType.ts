import { AD_CONFIG } from '@/lib/ad-config';

// adstir 撤去 (2026-05-09): CPM ¥2.71 で収益寄与ゼロ。 fanza + note のみ。
export type AdType = 'note' | 'fanza';

/**
 * 配信比率 (AD_CONFIG.fanzaRatio / noteRatio) に基づいて広告タイプを1つ抽選。
 * メインの AdBanner と ContentLocker で共有する。
 */
export function pickAdType(): AdType {
  const candidates: { type: AdType; weight: number }[] = [];

  if (AD_CONFIG.fanza.enabled) {
    candidates.push({ type: 'fanza', weight: AD_CONFIG.fanzaRatio });
  }
  candidates.push({ type: 'note', weight: AD_CONFIG.noteRatio });

  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return 'note';
  let rand = Math.random() * total;
  for (const c of candidates) {
    rand -= c.weight;
    if (rand <= 0) return c.type;
  }
  return 'note';
}
