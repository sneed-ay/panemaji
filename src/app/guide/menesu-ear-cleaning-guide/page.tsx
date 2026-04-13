import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "メンエスの耳かき・イヤーエステガイド｜癒しの施術",
  description: "メンズエステの耳かき・イヤーエステを解説。耳かき施術の種類、イヤーエステの効果、施術を受ける際の注意点やおすすめサロンの選び方を紹介します。",
  keywords: ["メンエス 耳かき", "メンエス イヤーエステ", "メンズエステ 耳", "メンエス 耳ケア", "メンエス 耳かき 施術"],
  alternates: { canonical: "https://panemaji.com/guide/menesu-ear-cleaning-guide" },
  openGraph: {
    title: "メンエスの耳かき・イヤーエステガイド｜癒しの施術",
    description: "メンズエステの耳かき・イヤーエステの施術内容と効果を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/menesu-ear-cleaning-guide",
  },
};

export default function MenesuEarCleaningGuidePage() {
  return (
    <ArticleLayout
      title="メンエスの耳かき・イヤーエステガイド"
      subtitle="癒しの耳ケア施術で究極のリラクゼーション"
      breadcrumb="耳かき・イヤーエステ"
      slug="menesu-ear-cleaning-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="メンズエステの耳かき・イヤーエステの施術内容と効果を解説。"
      relatedLinks={[
        { href: "/guide/menesu-scalp-guide", label: "ヘッドスパ・頭皮ケアガイド" },
        { href: "/guide/menesu-facial-guide", label: "フェイシャル施術ガイド" },
        { href: "/guide/menesu-music-guide", label: "BGM・音楽ガイド" },
        { href: "/guide/menesu-lighting-guide", label: "照明・雰囲気ガイド" },
        { href: "/guide/hajimete-menesu", label: "初めてのメンエスガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          耳かき・イヤーエステとは
        </h2>
        <p className="mb-3">
          メンズエステの耳かき・イヤーエステは、専用の器具を使った耳のクリーニングと
          耳周辺のリラクゼーションを組み合わせた施術です。
          膝枕スタイルで行われることが多く、究極の癒し体験として人気があります。
        </p>
        <p>
          耳には多くのツボが集中しているため、耳周辺のマッサージは
          全身のリラックスや自律神経の調整にも効果があるとされています。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          イヤーエステの施術内容
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">耳かき＋耳ツボマッサージ</h3>
            <p>
              竹製や金属製の専用耳かきで丁寧にクリーニングした後、
              耳のツボを刺激するマッサージを行います。
              耳たぶや耳周辺の血行が促進され、深いリラクゼーションが得られます。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">イヤーキャンドル</h3>
            <p>
              天然素材のキャンドルを使用したイヤーキャンドルは、
              温かさとほのかな香りで心身を深くリラックスさせます。
              耳の中を温めることで緊張がほぐれ、施術後のスッキリ感が魅力です。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          イヤーエステを楽しむポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">オプションとして追加：</span>多くのサロンではボディ施術にオプションとして耳かきを追加できます。15〜30分程度のメニューが一般的です。</li>
          <li><span className="font-semibold">衛生管理を確認：</span>使い捨て器具や消毒済みの器具を使用しているサロンを選びましょう。衛生面は最も重要なポイントです。</li>
          <li><span className="font-semibold">耳に不安がある方は事前相談：</span>耳に持病がある方や直近で耳の治療を受けた方は、施術前にセラピストに相談してください。</li>
          <li><span className="font-semibold">ヘッドスパとの組み合わせ：</span>耳かきとヘッドスパを組み合わせると頭部全体のリフレッシュ効果が高まりおすすめです。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
