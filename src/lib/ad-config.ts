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
  // ⚠️ affiliate_id "shumpo-001" が DMM API で "Invalid Request Error" を返す
  //    → DMMアフィリエイト管理画面でアカウント状態を確認し、有効なIDに更新すること
  fanza: {
    enabled: false, // affiliate_idが無効のため一時無効化
    affiliateId: 'shumpo-001',
    apiId: '3man2sH6YEEYxuKyeefg',
    service: 'FANZA',
    defaultFloor: 'videoa',
  },

  // adstir SSP広告（審査通過後にenabledをtrueに戻す）
  adstir: {
    enabled: false,
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

  // バナー配信比率: FANZA 67% / note 33%（adstir審査通過まで）
  fanzaRatio: 2,
  noteRatio: 1,
  adstirRatio: 0,
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
