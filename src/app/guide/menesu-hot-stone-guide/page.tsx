import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "メンエスのホットストーン施術ガイド｜温熱効果の魅力",
  description: "メンズエステのホットストーン施術を解説。温めた石を使った施術の効果、通常マッサージとの違い、ホットストーンが向いている方の特徴を紹介します。",
  keywords: ["メンエス ホットストーン", "メンズエステ ホットストーン", "メンエス 温熱", "メンエス ストーンマッサージ", "メンエス 温石"],
  alternates: { canonical: "https://panemaji.com/guide/menesu-hot-stone-guide" },
  openGraph: {
    title: "メンエスのホットストーン施術ガイド｜温熱効果の魅力",
    description: "メンズエステのホットストーン施術の効果と魅力を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/menesu-hot-stone-guide",
  },
};

export default function MenesuHotStoneGuidePage() {
  return (
    <ArticleLayout
      title="メンエスのホットストーン施術ガイド"
      subtitle="温熱効果で深層からほぐす癒しの施術"
      breadcrumb="ホットストーン施術ガイド"
      slug="menesu-hot-stone-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="メンズエステのホットストーン施術の効果と魅力を解説。"
      relatedLinks={[
        { href: "/guide/menesu-aroma-type-guide", label: "アロマオイル種類ガイド" },
        { href: "/guide/menesu-back-guide", label: "背中・腰施術ガイド" },
        { href: "/guide/menesu-oil-guide", label: "メンエスのオイルガイド" },
        { href: "/guide/menesu-pressure-guide", label: "圧の強さガイド" },
        { href: "/guide/hajimete-menesu", label: "初めてのメンエスガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          ホットストーン施術とは
        </h2>
        <p className="mb-3">
          ホットストーン施術は、50〜60度に温めた玄武岩などの天然石を身体に置いたり、
          石を使ってマッサージしたりする施術法です。
          温熱効果により筋肉が緩みやすくなり、通常のマッサージよりも深いリラクゼーションが得られます。
        </p>
        <p>
          冷え性の方や慢性的なコリに悩む方に特に人気があり、
          冬場だけでなく夏の冷房による冷え対策としても効果的です。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          ホットストーンの効果と特徴
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">深部への温熱効果</h3>
            <p>
              温めた石の熱は皮膚から筋肉の深層まで伝わり、
              血管を拡張させて血流を改善します。
              手技だけでは届きにくい深層の筋肉の緊張もほぐすことができ、
              施術後の持続効果が長いのが特徴です。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">リラクゼーション効果</h3>
            <p>
              じんわりとした温かさが副交感神経を優位にし、
              深いリラクゼーション状態をもたらします。
              施術中に心地よく眠ってしまう方も多く、ストレス解消効果も抜群です。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          ホットストーン施術を受ける際のポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">オプションとして追加可能：</span>多くのサロンではオイルトリートメントにホットストーンをオプション追加できます。追加料金は2,000〜3,000円程度です。</li>
          <li><span className="font-semibold">熱さの調整は遠慮なく：</span>石の温度が熱すぎると感じたら我慢せずセラピストに伝えましょう。適切な温度で施術を受けることが効果を最大化します。</li>
          <li><span className="font-semibold">体調に注意：</span>炎症がある部位や発熱時はホットストーンの使用を避けるべきです。事前にセラピストに体調を伝えてください。</li>
          <li><span className="font-semibold">冬場は特におすすめ：</span>身体が冷えやすい冬場はホットストーンの効果を特に実感しやすく、芯から温まる施術が堪能できます。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
