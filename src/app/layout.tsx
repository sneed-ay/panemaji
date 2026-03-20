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
    "パネマジ掲示板は、風俗嬢のパネル写真と実物が一致しているか口コミでチェックできるサイト。東京都のデリヘル607店舗・5万人以上の女性を網羅。パネマジ度をみんなで共有しよう。",
  keywords: [
    "パネマジ",
    "パネマジ掲示板",
    "パネマジチェッカー",
    "パネル写真",
    "風俗 口コミ",
    "デリヘル 口コミ",
    "パネル詐欺",
    "風俗 写真 違う",
    "パネマジ度",
    "東京 デリヘル",
    "風俗 評価",
  ],
  openGraph: {
    title: "パネマジ掲示板｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネマジ掲示板 - パネル写真と実物が一致しているか口コミでチェック。東京デリヘル607店舗を網羅。",
    type: "website",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "パネマジ掲示板｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネマジ掲示板 - パネル写真と実物が一致しているか口コミでチェック。東京デリヘル607店舗を網羅。",
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
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
        <link rel="canonical" href="https://panemaji.com" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
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
            <a href="/" className="text-white no-underline hover:no-underline">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                🔍 パネマジ掲示板
              </h1>
              <p className="text-pink-200 text-xs sm:text-sm mt-1">
                パネル写真と実物の一致度を口コミでチェック
              </p>
            </a>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
        <footer className="bg-gray-800 text-gray-400 text-center py-4 sm:py-6 mt-8 sm:mt-12 text-xs sm:text-sm px-3">
          <p>&copy; 2026 パネマジ掲示板 - 東京デリヘル パネマジ口コミサイト</p>
        </footer>
      </body>
    </html>
  );
}
