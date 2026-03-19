import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "パネマジ.jp | 写真と実物の一致度口コミサイト",
  description: "風俗嬢の写真（パネル）と実物が一致しているかの口コミ・評価サイト。東京都の風俗店を網羅。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-100">
        <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <a href="/" className="text-white no-underline hover:no-underline">
              <h1 className="text-2xl font-bold tracking-tight">
                パネマジ.jp
              </h1>
              <p className="text-blue-200 text-sm mt-1">
                写真と実物の一致度をみんなで共有
              </p>
            </a>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="bg-gray-800 text-gray-400 text-center py-6 mt-12 text-sm">
          <p>&copy; 2026 パネマジ.jp</p>
        </footer>
      </body>
    </html>
  );
}
