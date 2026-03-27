/**
 * Ad configuration for self-promotion banners (note.com) and Ninja AdMax
 * Set enabled to false to hide all ads site-wide.
 */
export const AD_CONFIG = {
  enabled: true,
  // note広告（自社広告）
  noteAd: {
    link: 'https://note.com/kaito_ura/n/n5a879e870165',
    images: ['/ad/sp-ad1.jpg', '/ad/sp-ad2.jpg', '/ad/sp-ad3.jpg', '/ad/sp-ad4.jpg'],
    utm: {
      source: 'panemaji',
      medium: 'banner',
      campaign: 'note_ad',
    },
  },
  // 忍者AdMax（外部広告ネットワーク）- 審査完了後にtrueに変更
  ninjaAdmax: {
    enabled: false,
    scriptSrc: 'https://adm.shinobi.jp/s/6fd6c506b10e1accd8bd7a507c384683',
  },
  // note:忍者 = 1:2 の割合
  noteRatio: 1,  // 33%
  ninjaRatio: 2, // 67%
} as const;

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
