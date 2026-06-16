import { AD_CONFIG } from '@/lib/ad-config';

// 2026-05-09: adstir 撤去 (CPM ¥2.71)
// 2026-05-10: parally 追加 → fanza:note:parally = 1:1:1
export type AdType = 'note' | 'fanza' | 'parally';

/**
 * 配信比率 (AD_CONFIG.{fanza,note,parally}Ratio) に基づいて広告タイプを1つ抽選。
 * メインの AdBanner と ContentLocker で共有する。
 */
export function pickAdType(): AdType {
  const candidates: { type: AdType; weight: number }[] = [];

  if (AD_CONFIG.fanza.enabled) {
    candidates.push({ type: 'fanza', weight: AD_CONFIG.fanzaRatio });
  }
  // 2026-06-12: note(kaito_ura) 撤去。noteRatio > 0 の時だけ抽選候補に入れる
  if (AD_CONFIG.noteRatio > 0) {
    candidates.push({ type: 'note', weight: AD_CONFIG.noteRatio });
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
