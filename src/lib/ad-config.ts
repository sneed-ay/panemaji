/**
 * Ad configuration for self-promotion banners (note.com)
 * Set enabled to false to hide all ads site-wide.
 */
export const AD_CONFIG = {
  enabled: true,
  link: 'https://note.com/kaito_ura/all',
  images: {
    header_pc: '/ad/note-728x90.png',
    header_sp: '/ad/note-320x100.png',
    rectangle: [
      '/ad/note-300x250.png',
      '/ad/note-300x250-v2.png',
      '/ad/note-300x250-v3.png',
    ],
    footer_sp: '/ad/note-320x50.png',
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
