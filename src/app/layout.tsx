import type { Metadata, Viewport } from "next";
import "./globals.css";
import AdBanner from "@/components/AdBanner";
import BottomNav from "@/components/BottomNav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "パネマジ掲示板｜風俗パネル写真の口コミ・評価サイト",
    template: "%s｜パネマジ掲示板",
  },
  description:
    "パネマジ掲示板は、風俗嬢のパネル写真と実物が一致しているか口コミでチェックできるサイト。全国46都道府県の風俗3,000店舗以上・14万人以上の女性を網羅。リアル度をみんなで共有しよう。",
  keywords: [
    "パネマジ",
    "パネマジ掲示板",
    "パネマジチェッカー",
    "パネル写真",
    "風俗 口コミ",
    "デリヘル 口コミ",
    "盛りすぎ",
    "風俗 写真 違う",
    "リアル度",
    "東京 デリヘル",
    "風俗 評価",
  ],
  openGraph: {
    title: "パネマジ掲示板｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネマジ掲示板 - パネル写真と実物が一致しているか口コミでチェック。全国3,000店舗以上を網羅。",
    type: "website",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com",
    images: [{ url: "https://panemaji.com/ogp-banner.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "パネマジ掲示板｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネマジ掲示板 - パネル写真と実物が一致しているか口コミでチェック。全国3,000店舗以上を網羅。",
    images: ["https://panemaji.com/ogp-banner.png"],
  },
  icons: null,
  alternates: {
    canonical: "https://panemaji.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="google-site-verification" content="TzICLVP1AEQfl0OnOYdsvLmx0DthDQk5J4IPEH3_MAo" />
        <meta name="google-site-verification" content="PSaa2abLK1zBpmEGM4_h6DlO0YcBdtgnI4xwSY429wY" />
        <meta name="juicyads-site-verification" content="c3797979fbf983b489abba36968255d9" />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ec4899" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" type="image/x-icon" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-CM0CD47KFB" />
            <script dangerouslySetInnerHTML={{ __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', { analytics_storage: 'granted' });
              gtag('config', 'G-CM0CD47KFB');
            `}} />
        </>
      </head>
      <body className="min-h-screen bg-gray-100 overflow-x-hidden">
        <header className="bg-gradient-to-r from-pink-600 to-purple-700 text-white shadow-lg">
          {/* メインヘッダー */}
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <a href="/" className="text-white no-underline hover:no-underline shrink-0">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
                  🔍 パネマジ掲示板
                </h1>
                <p className="text-pink-200 text-[10px] sm:text-xs mt-0.5">
                  パネル写真と実物の一致度を口コミでチェック
                </p>
              </a>
              {/* PC: 検索バー */}
              <form action="/search" method="GET" className="hidden md:flex flex-1 max-w-md mx-4">
                <div className="flex w-full">
                  <input
                    type="text"
                    name="q"
                    placeholder="店舗名・女の子の名前で検索..."
                    className="flex-1 px-3 py-1.5 rounded-l-lg text-gray-800 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <button type="submit" className="px-3 py-1.5 bg-pink-500 hover:bg-pink-400 rounded-r-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
              {/* SP: 検索アイコン */}
              <a href="/search" className="md:hidden shrink-0 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors no-underline text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </a>
            </div>
          </div>
          {/* ナビゲーションバー */}
          <nav className="bg-black/20 border-t border-white/10">
            <div className="max-w-6xl mx-auto px-2 sm:px-4">
              <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide py-1.5 text-xs sm:text-sm">
                <a href="/" className="shrink-0 px-2.5 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/90 hover:text-white flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
                  <span className="hidden sm:inline">トップ</span>
                </a>
                <a href="/search" className="shrink-0 px-2.5 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/90 hover:text-white flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  検索
                </a>
                <a href="/ranking" className="shrink-0 px-2.5 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/90 hover:text-white flex items-center gap-1">
                  🏆 ランキング
                </a>
                <a href="/guide" className="shrink-0 px-2.5 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/90 hover:text-white flex items-center gap-1">
                  📖 ガイド
                </a>
                <span className="hidden sm:inline text-white/30 mx-1">|</span>
                <a href="/area/shinjuku" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs">新宿</a>
                <a href="/area/ikebukuro" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs">池袋</a>
                <a href="/area/shibuya" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs">渋谷</a>
                <a href="/area/gotanda" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs">五反田</a>
                <a href="/area/shinbashi" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs">新橋</a>
                <a href="/area/ueno" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs hidden sm:inline-block">上野</a>
                <a href="/area/kinshicho" className="shrink-0 px-2 py-1 rounded-md hover:bg-white/15 transition-colors no-underline text-white/70 hover:text-white text-xs hidden sm:inline-block">錦糸町</a>
              </div>
            </div>
          </nav>
        </header>
        <AdBanner size="header" />
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 md:pb-6">{children}</main>
        <AdBanner size="footer" />
        <BottomNav />
        <footer className="bg-gray-800 text-gray-400 text-center py-4 sm:py-6 mt-8 sm:mt-12 text-xs sm:text-sm px-3">
          <div className="flex justify-center flex-wrap gap-4 mb-2">
            <a href="/guide/how-to-use" className="hover:text-white transition-colors">使い方</a>
            <a href="/guide/panemaji-checker" className="hover:text-white transition-colors">パネマジ見分け方</a>
            <a href="/guide" className="hover:text-white transition-colors">コラム・ガイド</a>
            <a href="/terms" className="hover:text-white transition-colors">利用規約</a>
            <a href="/contact" className="hover:text-white transition-colors">お問い合わせ</a>
          </div>
          <p>&copy; 2026 パネマジ掲示板 - 風俗 パネマジ口コミサイト</p>
        </footer>
      </body>
    </html>
  );
}
