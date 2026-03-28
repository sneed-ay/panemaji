/**
 * Ad configuration: note(自社) + 忍者AdMax + ExoClick + JuicyAds
 * 1週間テスト運用（2026-03-28〜04-04）後に勝者を残す
 * Set enabled to false to hide all ads site-wide.
 */
export const AD_CONFIG = {
  enabled: true,

  // 自社広告（note誘導）
  noteAd: {
    link: 'https://note.com/kaito_ura/n/n5a879e870165',
    images: ['/ad/sp-ad1.jpg', '/ad/sp-ad2.jpg', '/ad/sp-ad3.jpg', '/ad/sp-ad4.jpg'],
    utm: { source: 'panemaji', medium: 'banner', campaign: 'note_ad' },
  },

  // 忍者AdMax（日本国内DSP連携）
  ninjaAdmax: {
    enabled: true,
    zoneId: '229417',
  },

  // ExoClick（成人向けアドネットワーク）
  exoclick: {
    enabled: true,
    zoneId: '5884574',
    scriptUrl: 'https://a.magsrv.com/ad-provider.js',
  },

  // JuicyAds（成人向けアドネットワーク）
  juicyads: {
    enabled: true,
    zoneId: '1114086',
    scriptUrl: 'https://poweredby.jads.co/js/jads.js',
  },

  // 配信比率: note:ninja:exoclick:juicyads = 1:1:1:1
  noteRatio: 1,
  ninjaRatio: 1,
  exoclickRatio: 1,
  juicyadsRatio: 1,
};

/** Build the full ad link with UTM parameters */
export function getAdLink(content: string): string {
  const { noteAd } = AD_CONFIG;
  const params = new URLSearchParams({
    utm_source: noteAd.utm.source,
    utm_medium: noteAd.utm.medium,
    utm_campaign: noteAd.utm.campaign,
    utm_content: content,
  });
  return `${noteAd.link}?${params.toString()}`;
}
