/**
 * Ad configuration: FANZA(コンテキスト連動) / note (kaito_ura) / parally (sneed)
 * adstir は 2026-05-09 撤去
 */
export const AD_CONFIG = {
  enabled: true,

  // 自社広告 #1: kaito_ura note 記事誘導
  // 2026-05-06: 旧 n5a879e870165 → 新 n7a45cd2a0008 / バナー素材 7枚
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

  // 自社広告 #2: parally note 記事誘導 (2026-05-10 追加)
  // 2次元エロ・1億円稼げる系のバナー (3 メッセージ × 2 デザイン variant = 6 枚)
  parallyAd: {
    link: 'https://note.com/sneed/n/n81d0caefa93f',
    images: [
      '/ad/parally-1.png', // エロ漫画好きなら1億円稼げる！ (淡白BG)
      '/ad/parally-2.png', // エロマニアだったから月100万稼げた！！ (ハート背景)
      '/ad/parally-3.png', // 性癖「2次元エロ」を隠していたら月100万円稼げた方法 (白BG)
      '/ad/parally-4.png', // エロ漫画好きなら1億円稼げる！ (虹/星BG variant)
      '/ad/parally-5.png', // 性癖「2次元エロ」を隠していたら月100万円稼げた方法 (¥コインBG variant)
      '/ad/parally-6.png', // エロマニアだったから月100万稼げた！！ (黒金 variant)
    ],
    utm: { source: 'panemaji', medium: 'banner', campaign: 'parally_ad' },
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

  // adstir SSP広告 — 2026-05-09 撤去: CPM がゴミカス低 (¥2.71) で収益貢献ゼロ。
  // 比率は note + FANZA に再配分。 設定は残置するが enabled: false で完全停止。
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

  // バナー配信比率
  // 2026-04-23: adstir CPM ¥2.71 で低迷 → FANZA 比重 up
  // 2026-05-03: AdBlock で adstir SDK ブロック → FANZA 寄せ
  // 2026-05-06: note 自社広告再開、 fanza:note:adstir = 4:4:2 → 5:4:1
  // 2026-05-09: adstir 完全撤去 → fanza:note = 5:5
  // 2026-05-10: parally 追加 → fanza:note:parally = 1:1:1 (三分割均等)
  fanzaRatio: 1,
  noteRatio: 1,
  parallyRatio: 1,
  adstirRatio: 0,
  ninjaRatio: 0,
  exoclickRatio: 0,
  juicyadsRatio: 0,
};

/** Build the full ad link with UTM parameters (kaito_ura note ad) */
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

/** Build the full ad link with UTM parameters (parally note ad) */
export function getParallyAdLink(content: string): string {
  const { parallyAd } = AD_CONFIG;
  const params = new URLSearchParams({
    utm_source: parallyAd.utm.source,
    utm_medium: parallyAd.utm.medium,
    utm_campaign: parallyAd.utm.campaign,
    utm_content: content,
  });
  return `${parallyAd.link}?${params.toString()}`;
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
