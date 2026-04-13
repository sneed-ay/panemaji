import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "福岡ソープ完全ガイド｜中洲の名店と初心者向け情報",
  description: "福岡・中洲のソープランドを徹底ガイド。エリアの特徴、ランク別の料金相場、初心者向けのおすすめ情報を紹介します。",
  keywords: ["福岡 ソープ", "中洲 ソープ", "福岡 ソープランド", "中洲 風俗", "福岡 ソープ おすすめ"],
  alternates: { canonical: "https://panemaji.com/guide/soap-fukuoka-detail" },
  openGraph: {
    title: "福岡ソープ完全ガイド｜中洲の名店と初心者向け情報",
    description: "福岡・中洲のソープランドを徹底ガイド。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/soap-fukuoka-detail",
  },
};

export default function SoapFukuokaDetailPage() {
  return (
    <ArticleLayout
      title="福岡ソープ完全ガイド"
      subtitle="中洲の名店と初心者向け情報まとめ"
      breadcrumb="福岡ソープガイド"
      slug="soap-fukuoka-detail"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="福岡・中洲のソープランドを徹底ガイド。"
      relatedLinks={[
        { href: "/guide/fuzoku-regional-comparison", label: "全国エリア比較" },
        { href: "/guide/soap-yoshiwara-detail", label: "吉原ソープ完全ガイド" },
        { href: "/guide/soap-susukino-detail", label: "すすきのソープ完全ガイド" },
        { href: "/guide/fuzoku-price-trend-2026", label: "2026年の料金トレンド" },
        { href: "/guide/fuzoku-parking-guide", label: "駐車場ガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          福岡・中洲ソープの特徴
        </h2>
        <p className="mb-3">
          福岡のソープランドは中洲に集中しており、九州最大の歓楽街として
          全国から利用者が訪れます。博多駅や天神からのアクセスが良く、
          出張ビジネスマンの利用も多いエリアです。
        </p>
        <p>
          東京の吉原と比較すると料金は2〜3割安い傾向にあり、
          コストパフォーマンスの高さが中洲ソープの魅力です。
          九州ならではのホスピタリティある接客も評判です。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          ランク別の料金相場と特徴
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">高級店（総額4万円〜）</h3>
            <p>
              中洲の高級ソープはキャストの容姿・接客レベルともに高水準です。
              内装も豪華で非日常的な体験が楽しめます。
              初回限定の割引を用意している店舗もあるため事前にチェックしましょう。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">中級店（総額2.5万〜4万円）</h3>
            <p>
              コストパフォーマンスが最も高いのが中級ランクです。
              キャストの質と料金のバランスが良く、初心者にもおすすめ。
              中洲では最も店舗数が多い価格帯でもあります。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">大衆店（総額2.5万円以下）</h3>
            <p>
              リーズナブルに利用できる大衆ソープは予算を抑えたい方向け。
              キャストの年齢層はやや高めですが、経験豊富で接客上手な方が多いのが特徴です。
              フリーコースならさらにお得に利用できます。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          初心者向けの利用ポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">アクセス方法：</span>地下鉄中洲川端駅から徒歩圏内。天神からもタクシーで5分程度と好アクセスです。</li>
          <li><span className="font-semibold">営業時間：</span>多くの店舗は朝10時頃から深夜まで営業。昼間は空いておりゆったり利用できます。</li>
          <li><span className="font-semibold">予約のコツ：</span>週末や連休は混雑するため平日の利用がおすすめ。電話予約が基本ですがWeb予約対応店も増えています。</li>
          <li><span className="font-semibold">初回割引の活用：</span>新規のお客様向けに入浴料割引を実施している店舗が多いです。初めての方は積極的に活用しましょう。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
