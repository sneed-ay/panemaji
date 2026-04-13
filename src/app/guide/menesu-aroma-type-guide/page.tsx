import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "メンエスのアロマオイル種類ガイド｜香りで選ぶ施術",
  description: "メンズエステで使用されるアロマオイルの種類を解説。ラベンダーやユーカリなど香りの特徴、効能別の選び方、おすすめの組み合わせを紹介します。",
  keywords: ["メンエス アロマオイル", "メンエス 香り", "メンズエステ アロマ 種類", "メンエス エッセンシャルオイル", "メンエス ラベンダー"],
  alternates: { canonical: "https://panemaji.com/guide/menesu-aroma-type-guide" },
  openGraph: {
    title: "メンエスのアロマオイル種類ガイド｜香りで選ぶ施術",
    description: "メンズエステで使われるアロマオイルの種類と効能別の選び方を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/menesu-aroma-type-guide",
  },
};

export default function MenesuAromaTypeGuidePage() {
  return (
    <ArticleLayout
      title="メンエスのアロマオイル種類ガイド"
      subtitle="香りで選ぶ施術で極上のリラクゼーション"
      breadcrumb="アロマオイル種類ガイド"
      slug="menesu-aroma-type-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="メンズエステで使われるアロマオイルの種類と効能別の選び方を解説。"
      relatedLinks={[
        { href: "/guide/menesu-oil-guide", label: "メンエスのオイルガイド" },
        { href: "/guide/menesu-hot-stone-guide", label: "ホットストーン施術ガイド" },
        { href: "/guide/menesu-lighting-guide", label: "照明・雰囲気ガイド" },
        { href: "/guide/menesu-music-guide", label: "BGM・音楽ガイド" },
        { href: "/guide/hajimete-menesu", label: "初めてのメンエスガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          アロマオイルが施術にもたらす効果
        </h2>
        <p className="mb-3">
          メンズエステで使用されるアロマオイルは、単なるマッサージの潤滑剤ではありません。
          植物から抽出されたエッセンシャルオイルには、リラクゼーションや血行促進など様々な効能があります。
        </p>
        <p>
          香りは嗅覚を通じて直接脳に働きかけるため、
          心身のリラックス効果を高め、施術の満足度を大きく左右する要素となります。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          人気のアロマオイルとその特徴
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">リラックス系の香り</h3>
            <p>
              ラベンダーは万人に好まれる定番で、緊張緩和と安眠効果に優れています。
              カモミールは甘い香りで不安を和らげ、イランイランはエキゾチックな香りで深いリラクゼーションをもたらします。
              初めての方にはラベンダーがおすすめです。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">リフレッシュ系の香り</h3>
            <p>
              ユーカリやペパーミントはスッキリとした清涼感があり、疲労回復に効果的です。
              レモングラスは爽やかな柑橘系の香りで気分転換に最適です。
              仕事終わりのリフレッシュ目的の方におすすめの香りです。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          目的別アロマオイルの選び方
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">安眠したい方：</span>ラベンダーやカモミールなど鎮静効果のある香りを選ぶと、施術後に質の良い睡眠が得られます。</li>
          <li><span className="font-semibold">筋肉のコリに：</span>ローズマリーやジュニパーベリーは血行促進効果が高く、筋肉の緊張をほぐすのに適しています。</li>
          <li><span className="font-semibold">気分転換したい方：</span>オレンジやグレープフルーツなど柑橘系は明るい気分にしてくれるため、ストレス解消に最適です。</li>
          <li><span className="font-semibold">香りが苦手な方：</span>無香料のキャリアオイルのみで施術してもらえるサロンもあるため、予約時に相談しましょう。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
