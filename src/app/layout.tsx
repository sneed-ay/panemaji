import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "パネマジチェッカー｜風俗パネル写真の口コミ・評価サイト",
    template: "%s｜パネマジチェッカー",
  },
  description:
    "風俗嬢のパネル写真と実物が一致しているか、口コミでチェックできるサイト。東京都のデリヘル607店舗・5万人以上の女性を網羅。パネマジ度をみんなで共有しよう。",
  keywords: [
    "パネマジ",
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
    title: "パネマジチェッカー｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネル写真と実物が一致しているか口コミでチェック。東京デリヘル607店舗を網羅。",
    type: "website",
    locale: "ja_JP",
    siteName: "パネマジチェッカー",
  },
  twitter: {
    card: "summary_large_image",
    title: "パネマジチェッカー｜風俗パネル写真の口コミ・評価サイト",
    description:
      "パネル写真と実物が一致しているか口コミでチェック。東京デリヘル607店舗を網羅。",
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
        <link rel="canonical" href="https://panemaji.onrender.com" />
      </head>
      <body className="min-h-screen bg-gray-100">
        <header className="bg-gradient-to-r from-pink-600 to-purple-700 text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <a href="/" className="text-white no-underline hover:no-underline">
              <h1 className="text-2xl font-bold tracking-tight">
                🔍 パネマジチェッカー
              </h1>
              <p className="text-pink-200 text-sm mt-1">
                パネル写真と実物の一致度を口コミでチェック
              </p>
            </a>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="bg-gray-800 text-gray-400 text-center py-6 mt-12 text-sm">
          <p>&copy; 2026 パネマジチェッカー - 東京デリヘル パネマジ口コミサイト</p>
        </footer>
      </body>
    </html>
  );
}
