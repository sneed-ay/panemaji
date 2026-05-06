/**
 * Ad configuration: FANZA(コンテキスト連動) / note / adstir / Adsterra
 */
export const AD_CONFIG = {
  enabled: true,

  // 自社広告（note誘導）
  // 2026-05-06: 旧 n5a879e870165 → 新 n7a45cd2a0008 / バナー素材を 7枚に刷新
  // (3デザイン × 複数BG variant: 無料SEX 3点, ナンバーワン 2点, パパ活 2点)
  noteAd: {
    link: 'https://note.com/kaito_ura/n/n7a45cd2a0008',
    images: [
      '/ad/note-1.jpg', // 無料SEX (木枠ポスター)
      '/ad/note-2.jpg', // 無料SEX (グラデーション)
      '/ad/note-3.jpg', // ナンバーワン (夜景)
      '/ad/note-4.jpg', // パパ活 (ワインレッド)
      '/ad/note-5.jpg', // 無料SEX (白BG)
      '/ad/note-6.jpg', // ナンバーワン (白BG)
      '/ad/note-7.jpg', // パパ活 (白BG)
    ],
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

  // バナー配信比率: FANZA 40% / note 40% / adstir 20%
  // - FanzaWidget が空商品のとき → NoteAdImage にフォールバック
  // - AdstirBanner が 3秒で広告iframe生成失敗時 → NoteAdImage にフォールバック
  // 2026-04-23: adstir CPM ¥2.71 と低迷したため FANZA に比重を移した。
  // 2026-05-03: AdBlock 環境で adstir SDK URL がブロックされ空打ちになるため
  //             比率を更に FANZA 寄せ (75→80%)、 adstir フォールバック発火を 8s→3s に短縮。
  //             FANZA は自前API経由配信なので AdBlock 通過率が高い。
  // 2026-05-06: note 自社広告を再開 (新リンク + 新バナー7点)。
  //             比率は fanza:note:adstir = 4:4:2 (note を主軸に戻す)。
  fanzaRatio: 4,
  noteRatio: 4,
  adstirRatio: 2,
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
