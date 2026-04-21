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
  // クリックトラッキング用ID: shumpo-018（ダッシュボードで確認する方）
  // API用ID: shumpo-990（DMM API v3は末尾990-999のみ受付）
  fanza: {
    enabled: true,
    affiliateId: 'shumpo-018',
    apiAffiliateId: 'shumpo-990', // API専用（末尾990-999制限）
    apiId: '3man2sH6YEEYxuKyeefg',
    service: 'FANZA',
    defaultFloor: 'videoa',
  },

  // adstir SSP広告（審査通過済み / panemaji_rectangle 300x250）
  // spot はメディア内の広告枠通し番号（公式タグで ad_spot: 1 が正しい）
  // 302792 は広告枠IDで内部識別子なのでSDKには渡さない
  adstir: {
    enabled: true,
    appId: 'MEDIA-da9880ba',
    spot: 1,
    scriptUrl: 'https://js.ad-stir.com/js/adstir.js',
  },

  // Adsterra（Social Barのみ。Popunderは現代ブラウザで機能しないため廃止）
  adsterra: {
    enabled: true,
    socialBarZoneId: '29042260',
  },

  // AdMaven コンテンツロッカー（CPM）
  adMaven: {
    enabled: true,
    scriptUrl: '//dcbbwymp1bhlf.cloudfront.net/?wbbcd=1253022',
  },

  // CPALead コンテンツロッカー（CPA/CPC）- 登録後にappId設定
  cpaLead: {
    enabled: false, // appId取得後にtrueに変更
    appId: '',      // アプリID
    subId: 'panemaji_locker', // トラッキング用サブID
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

  // バナー配信比率: FANZA 50% / note 25% / adstir 25%
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

/**
 * Wrap any outbound ad URL via the server-side click tracking endpoint (/api/click)
 *
 * サーバー側で ad_clicks テーブルに記録してから 302 で遷移させる。
 * GA の beacon 送信漏れ・広告ブロッカー対策として並列で動かす。
 *
 * @param destUrl  最終遷移先 URL (必ず allow-list 内のホストを指すこと)
 * @param meta     ad_type / ad_size / ad_page のメタ情報
 */
export function wrapClickUrl(
  destUrl: string,
  meta: { adType: string; adSize?: string; adPage?: string }
): string {
  const params = new URLSearchParams({
    to: destUrl,
    ad_type: meta.adType,
  });
  if (meta.adSize) params.set('ad_size', meta.adSize);
  if (meta.adPage) params.set('ad_page', meta.adPage);
  return `/api/click?${params.toString()}`;
}
