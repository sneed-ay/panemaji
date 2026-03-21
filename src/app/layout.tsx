import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    "パネマジ掲示板は、風俗嬢のパネル写真と実物が一致しているか口コミでチェックできるサイト。全国46都道府県のデリヘル3,000店舗以上・14万人以上の女性を網羅。リアル度をみんなで共有しよう。",
  keywords: [
    "パネマジ",
    "パネマジ掲示板",
    "パネマジチェッカー",
    "パネル写真",
    "風俗 口コミ",
    "デリヘル 口コミ",
    "パネル詐欺",
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
    images: [{ url: "https://panemaji.com/icon-512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "パネマジ掲示板｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネマジ掲示板 - パネル写真と実物が一致しているか口コミでチェック。全国3,000店舗以上を網羅。",
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
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <a href="/" className="text-white no-underline hover:no-underline">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  🔍 パネマジ掲示板
                </h1>
                <p className="text-pink-200 text-xs sm:text-sm mt-1">
                  パネル写真と実物の一致度を口コミでチェック
                </p>
              </a>
              <a
                href="/ranking"
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs sm:text-sm font-medium transition-colors no-underline"
              >
                &#x1F3C6;
                <span className="hidden sm:inline">ランキング</span>
              </a>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
        <footer className="bg-gray-800 text-gray-400 text-center py-4 sm:py-6 mt-8 sm:mt-12 text-xs sm:text-sm px-3">
          <div className="flex justify-center gap-4 mb-2">
            <a href="/terms" className="hover:text-white transition-colors">利用規約</a>
            <a href="/contact" className="hover:text-white transition-colors">お問い合わせ</a>
          </div>
          <p>&copy; 2026 パネマジ掲示板 - デリヘル パネマジ口コミサイト</p>
        </footer>
      </body>
    </html>
  );
}
