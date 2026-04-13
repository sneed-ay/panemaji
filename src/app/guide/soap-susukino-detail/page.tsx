import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "すすきのソープ完全ガイド｜北海道最大のソープ街",
  description: "札幌すすきののソープランドを完全ガイド。北海道最大の歓楽街の特徴、ランク別料金、季節ごとの楽しみ方を紹介します。",
  keywords: ["すすきの ソープ", "札幌 ソープ", "すすきの ソープランド", "北海道 ソープ", "すすきの 風俗"],
  alternates: { canonical: "https://panemaji.com/guide/soap-susukino-detail" },
  openGraph: {
    title: "すすきのソープ完全ガイド｜北海道最大のソープ街",
    description: "札幌すすきののソープランドを完全ガイド。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/soap-susukino-detail",
  },
};

export default function SoapSusukinoDetailPage() {
  return (
    <ArticleLayout
      title="すすきのソープ完全ガイド"
      subtitle="北海道最大のソープ街を徹底解説"
      breadcrumb="すすきのソープガイド"
      slug="soap-susukino-detail"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="札幌すすきののソープランドを完全ガイド。"
      relatedLinks={[
        { href: "/guide/fuzoku-regional-comparison", label: "全国エリア比較" },
        { href: "/guide/soap-yoshiwara-detail", label: "吉原ソープ完全ガイド" },
        { href: "/guide/soap-fukuoka-detail", label: "福岡ソープ完全ガイド" },
        { href: "/guide/fuzoku-parking-guide", label: "駐車場ガイド" },
        { href: "/guide/fuzoku-price-trend-2026", label: "2026年の料金トレンド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          すすきのソープ街の概要
        </h2>
        <p className="mb-3">
          すすきのは北海道最大の歓楽街であり、日本三大歓楽街の一つに数えられます。
          ソープランドはすすきの交差点周辺に集中しており、
          地下鉄すすきの駅から徒歩でアクセスできる好立地です。
        </p>
        <p>
          観光地としても人気の札幌にあるため、旅行や出張と組み合わせて
          利用する方が多いのも特徴です。料金は東京より安く
          北海道ならではのおおらかな接客が楽しめます。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          ランク別の料金と特徴
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">高級店（総額3.5万円〜）</h3>
            <p>
              すすきのの高級ソープは東京の同ランクと比較してかなりリーズナブルです。
              キャストのレベルは高く、北海道各地から容姿端麗な女性が集まっています。
              観光客にも人気で週末は予約が取りにくいことも。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">中級店（総額2万〜3.5万円）</h3>
            <p>
              すすきので最も店舗数が多い価格帯です。
              コスパが良くバランスの取れたサービスが受けられるため、
              初めてすすきのソープを利用する方にはこのランクがおすすめです。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">大衆店（総額2万円以下）</h3>
            <p>
              総額2万円以下で利用できる大衆店もあり、予算を抑えたい方に最適です。
              すすきのの大衆ソープは料金の割にサービスが充実していると
              評判で、リピーターも多いです。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          すすきの利用の実践ポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">冬場のアクセス：</span>冬は積雪で移動が大変です。地下歩道を活用し、屋内駐車場を確保しておきましょう。</li>
          <li><span className="font-semibold">観光との組み合わせ：</span>札幌ラーメンやジンギスカンなど北海道グルメと合わせて楽しむ方も多いです。</li>
          <li><span className="font-semibold">雪まつり期間の混雑：</span>2月の雪まつり期間中は特に混み合います。この時期は早めの予約が必須です。</li>
          <li><span className="font-semibold">交通手段：</span>地下鉄すすきの駅から徒歩5分圏内。冬場は路面が凍結するためタクシーの利用も検討しましょう。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
