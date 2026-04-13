/**
 * Ad configuration: FANZA(コンテキスト連動) / note / adstir / Adsterra
 */
export const AD_CONFIG = {
  enabled: true,

  // 自社広告（note誘導）
  noteAd: {
    link: 'https://note.com/kaito_ura/n/n5a879e870165',
    images: ['/ad/sp-ad1.jpg', '/ad/sp-ad2.jpg', '/ad/sp-ad3.jpg', '/ad/sp-ad4.jpg'],
    utm: { source: 'panemaji', medium: 'banner', campaign: 'note_ad' },
  },

  // FANZA動的ウィジェット（DMMアフィリエイト - コンテキスト連動）
  fanza: {
    enabled: true,
    affiliateId: 'shumpo-001',
    apiId: '3man2sH6YEEYxuKyeefg',
    service: 'FANZA',
    defaultFloor: 'videoa',
  },

  // adstir SSP広告
  adstir: {
    enabled: true,
    appId: 'MEDIA-da9880ba',
    spot: 1,
    scriptUrl: 'https://js.ad-stir.com/js/adstir.js',
  },

  // Adsterra（Social Bar + Popunder）
  adsterra: {
    enabled: true,
    socialBarZoneId: '29042260',
    popunderZoneId: '29042259',
    popunderFrequencyHours: 24,
  },

  // fam.（オーバーレイ広告）- 審査通過後に設定
  fam: {
    enabled: false,
    zoneId: '',
  },

  // 旧外部ネットワークは全て無効
  ninjaAdmax: { enabled: false, zoneId: '229417' },
  exoclick: { enabled: false, zoneId: '5884574', scriptUrl: 'https://a.magsrv.com/ad-provider.js' },
  juicyads: { enabled: false, zoneId: '1114086', scriptUrl: 'https://poweredby.jads.co/js/jads.js' },

  // バナー配信比率: FANZA高め 2:1:1
  fanzaRatio: 2,
  noteRatio: 1,
  adstirRatio: 1,
  ninjaRatio: 0,
  exoclickRatio: 0,
  juicyadsRatio: 0,
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
