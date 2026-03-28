/**
 * Ad configuration for self-promotion banners (note.com), ExoClick, and JuicyAds
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

  // ExoClick（成人向けアドネットワーク）
  exoclick: {
    enabled: true, // アカウント登録後にtrueにする
    zoneId: '', // 登録後に設定
    scriptUrl: 'https://a.magsrv.com/ad-provider.js', // ExoClickの標準スクリプト
  },

  // JuicyAds（成人向けアドネットワーク）
  juicyads: {
    enabled: true, // アカウント登録後にtrueにする
    zoneId: '', // 登録後に設定
    scriptUrl: 'https://js.juicyads.com/jp.js',
  },

  // 配信比率: note:exoclick:juicyads = 1:1:1
  noteRatio: 1,
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
