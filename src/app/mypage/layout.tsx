import type { Metadata } from 'next';

/**
 * /mypage は会員のログイン後ページ。検索結果に出す意味がないので noindex にする。
 *
 * page.tsx が 'use client' のため metadata を export できず、この layout で指定する
 * (/login /signup はサーバーコンポーネントなので page.tsx 側で指定している)。
 *
 * 2026-09-02 まで robots が index,follow のまま、さらに layout.tsx(ルート) の
 * canonical がトップ固定で継承され「トップページの複製」と申告していた。
 */
export const metadata: Metadata = {
  title: 'マイページ',
  description: 'パネマジ掲示板の会員マイページ',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://panemaji.com/mypage' },
};

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
