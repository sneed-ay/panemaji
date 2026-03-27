/**
 * Ad configuration for self-promotion banners (note.com)
 * Set enabled to false to hide all ads site-wide.
 */
export const AD_CONFIG = {
  enabled: true,
  link: 'https://note.com/kaito_ura/n/n5a879e870165',
  images: {
    // SP 320x100 banners (4 patterns, random display)
    header_pc: '/ad/sp-ad1.jpg',
    header_sp: '/ad/sp-ad1.jpg',
    rectangle: [
      '/ad/sp-ad1.jpg',
      '/ad/sp-ad2.jpg',
      '/ad/sp-ad3.jpg',
      '/ad/sp-ad4.jpg',
    ],
    footer_sp: '/ad/sp-ad1.jpg',
  },
  utm: {
    source: 'panemaji',
    medium: 'banner',
    campaign: 'note_ad',
  },
} as const;

/** Build the full ad link with UTM parameters */
export function getAdLink(content: string): string {
  const { link, utm } = AD_CONFIG;
  const params = new URLSearchParams({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
    utm_content: content,
  });
  return `${link}?${params.toString()}`;
}
