import Link from 'next/link';
import type { Metadata } from 'next';

// 404 ページは noindex (ソフト404 評価回避)
export const metadata: Metadata = {
  title: 'ページが見つかりません',
  robots: { index: false, follow: true },
};

/**
 * カスタム 404 ページ
 *
 * Google が「ソフト 404」(=200 OK だが実質 404) と判定するのを避けるため、
 * 明確に noindex + 関連リンク提供で UX を改善する。
 */
export default function NotFound() {
  // 注意: slug は v5b マイグレーション後の compound slug を使う
  // (旧 'shibuya' / 'gotanda' / 'ueno' / 'kinshicho' は area DB に存在しないため 404)
  const popularAreas = [
    { name: '新宿', slug: 'shinjuku' },
    { name: '池袋', slug: 'ikebukuro' },
    { name: '渋谷・恵比寿', slug: 'shibuya-ebisu' },
    { name: '五反田・目黒', slug: 'gotanda-meguro' },
    { name: '上野・鶯谷', slug: 'ueno-uguisudani' },
    { name: '錦糸町・亀戸', slug: 'kinshicho-kameido' },
  ];
  const popularPrefs = [
    { name: '東京都', slug: 'tokyo' },
    { name: '神奈川県', slug: 'kanagawa' },
    { name: '大阪府', slug: 'osaka' },
    { name: '愛知県', slug: 'aichi' },
    { name: '福岡県', slug: 'fukuoka' },
    { name: '北海道', slug: 'hokkaido' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">ページが見つかりませんでした</h1>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          お探しのページは削除されたか、URL が変更された可能性があります。<br />
          下記のリンクから関連ページをお探しください。
        </p>
        <Link
          href="/"
          className="inline-block bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-6 rounded-lg no-underline transition-colors mb-6"
        >
          トップへ戻る
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mt-5">
        <h2 className="text-base font-bold text-gray-800 mb-3">人気エリアから探す</h2>
        <div className="flex flex-wrap gap-2">
          {popularAreas.map((a) => (
            <Link
              key={a.slug}
              href={`/area/${a.slug}`}
              className="bg-gray-100 hover:bg-pink-50 hover:text-pink-700 text-gray-700 px-3 py-1.5 rounded text-sm no-underline transition-colors"
            >
              {a.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">都道府県から探す</h2>
        <div className="flex flex-wrap gap-2">
          {popularPrefs.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="bg-gray-100 hover:bg-pink-50 hover:text-pink-700 text-gray-700 px-3 py-1.5 rounded text-sm no-underline transition-colors"
            >
              {p.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 mt-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">その他のメニュー</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/ranking" className="text-blue-600 hover:underline no-underline">🏆 パネマジランキング</Link>
          <Link href="/guide" className="text-blue-600 hover:underline no-underline">📖 ガイド・コラム</Link>
          <Link href="/search" className="text-blue-600 hover:underline no-underline">🔍 店舗検索</Link>
        </div>
      </div>
    </div>
  );
}
