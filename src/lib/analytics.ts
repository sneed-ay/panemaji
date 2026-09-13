/**
 * GA4 へのカスタムイベント送信 (gtag は layout.tsx で読み込み済み)。
 *
 * 2026-09-13: 会員登録の導線にイベントが1本も無かった。
 *   8/16〜9/4 に登録フォームの完了率が 70% → 44% に落ちていた (原因はサイトの遅さ。
 *   9/5 の速度改善で 79% に回復) のに、GA のページビューと本番DBの突き合わせでしか
 *   追えず3週間気付けなかった。各段階を記録して、次は GA の画面だけで分かるようにする。
 *
 * イベント名は GA の「イベント」レポートでそのまま件数が読めるように分けてある:
 *   gate_view_locker / gate_view_locker_stale / gate_view_vote / gate_view_review
 *                                        … 未会員向けの登録誘導が表示された
 *   gate_click_signup / gate_click_login … 誘導から登録/ログインへ進んだ (params.gate = 出どころ)
 *   gate_click_vote                      … 投稿切れ会員のロックから「評価を入れる」を押した
 *   auth_submit                          … 登録/ログインフォームを送信した
 *   sign_up / login                      … 成功 (GA4 の推奨イベント名)
 *   auth_error                           … 失敗 (params.code = API のエラー種別 / http_XXX / network)
 *
 * メールアドレス等の個人情報は絶対に送らないこと。
 */

export type EventParams = Record<string, string | number | boolean>;

const PAGE_TYPES = ['girl', 'shop', 'area', 'ranking', 'search', 'signup', 'login', 'mypage', 'guide'];

/** URL からページ種別を出す (GA 側で嬢/店舗ページ別に分けるため) */
export function pageType(pathname: string): string {
  if (pathname === '/') return 'top';
  const first = pathname.split('/')[1] || '';
  return PAGE_TYPES.includes(first) ? first : 'other';
}

export function trackEvent(name: string, params: EventParams = {}): void {
  try {
    if (typeof window === 'undefined') return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', name, {
      // 直後に画面遷移するクリックや登録成功でも取りこぼさないよう beacon で送る
      transport_type: 'beacon',
      page_type: pageType(window.location.pathname),
      ...params,
    });
  } catch {
    // 計測の失敗で画面を壊さない
  }
}
