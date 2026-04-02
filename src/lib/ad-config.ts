/**
 * Ad configuration: note(自社広告)のみ配信
 * 外部ネットワーク（忍者/ExoClick/JuicyAds）は全て停止
 */
export const AD_CONFIG = {
  enabled: true,

  // 自社広告（note誘導）- 100%配信
  noteAd: {
    link: 'https://note.com/kaito_ura/n/n5a879e870165',
    images: ['/ad/sp-ad1.jpg', '/ad/sp-ad2.jpg', '/ad/sp-ad3.jpg', '/ad/sp-ad4.jpg'],
    utm: { source: 'panemaji', medium: 'banner', campaign: 'note_ad' },
  },

  // 外部ネットワークは全て無効
  ninjaAdmax: { enabled: false, zoneId: '229417' },
  exoclick: { enabled: false, zoneId: '5884574', scriptUrl: 'https://a.magsrv.com/ad-provider.js' },
  juicyads: { enabled: false, zoneId: '1114086', scriptUrl: 'https://poweredby.jads.co/js/jads.js' },

  // note 100%配信
  noteRatio: 1,
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
