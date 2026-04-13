import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "パネマジに関するよくある質問まとめ｜FAQ",
  description:
    "パネマジとは？パネマジの見分け方は？パネル写真と実物の違いに関するよくある質問をまとめて回答します。初心者にもわかりやすく解説。",
  keywords: ["パネマジ とは", "パネマジ 意味", "パネマジ FAQ", "パネル写真 違い", "パネマジ 見分け方"],
  alternates: { canonical: "https://panemaji.com/guide/panemaji-faq" },
  openGraph: {
    title: "パネマジに関するよくある質問まとめ｜FAQ",
    description: "パネマジに関するよくある質問をまとめて回答します。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/panemaji-faq",
  },
};

const faqs = [
  { q: "パネマジとは何ですか？", a: "パネマジとは「パネルマジック」の略で、風俗店のパネル写真（宣伝写真）と実際に来る女性の容姿に大きな差があることを指す俗語です。写真の加工・修正・角度詐欺などにより、実物とかけ離れた印象を与えるケースを総称してパネマジと呼びます。" },
  { q: "パネマジを見分ける方法はありますか？", a: "主な見分け方として、(1)写真の加工痕をチェックする、(2)写メ日記の自撮りと比較する、(3)口コミサイトの評価を確認する、(4)複数の写真を比較して一貫性を確認する、(5)動画コンテンツがあれば参考にする、などがあります。パネマジ掲示板の口コミ投票も参考になります。" },
  { q: "パネマジ掲示板の「パネル通り率」とは？", a: "パネル通り率とは、その女性に対する口コミ投票の中で「パネル通り」と評価された割合です。数値が高いほど写真と実物の一致度が高いことを意味します。100%なら全員がパネル通りと評価しています。" },
  { q: "パネマジが多い業態はありますか？", a: "一般的にデリヘル（デリバリーヘルス）はパネマジが多いとされています。対面で選べないため写真に頼る部分が大きいからです。一方、ソープランドは店頭で実物を見て選べるためパネマジリスクは低めです。メンエス（メンズエステ）は業態によりばらつきがあります。" },
  { q: "パネマジに遭ったらどうすればいい？", a: "チェンジ（交代）を申し出ることができますが、店舗によって対応は異なります。チェンジ料が発生する場合もあるため、事前に店舗のチェンジポリシーを確認しておくことが重要です。また、口コミ投稿で情報を共有することで他の利用者の参考になります。" },
  { q: "パネマジ掲示板に口コミを投稿するにはどうすればいい？", a: "パネマジ掲示板では、各女性のプロフィールページから「パネル通り」「許せる」「盛りすぎ」の3段階で投票できます。コメント付きの口コミも投稿でき、会員登録不要で匿名利用が可能です。" },
  { q: "写メ日記とパネル写真はどう違いますか？", a: "パネル写真はプロのカメラマンがスタジオで撮影し、加工・修正を施した宣伝用写真です。一方、写メ日記は女性が自分のスマホで撮影した自撮りが中心で、加工度合いはパネル写真より低い傾向にあります。写メ日記の方が実物に近いことが多いです。" },
  { q: "パネル通り率が高い店の特徴は？", a: "パネル通り率が高い店舗の特徴として、(1)口コミ数が多く評価が安定している、(2)写メ日記の更新頻度が高い、(3)営業歴が長い、(4)リピーター率が高い、(5)高級店やブランド重視の店舗、などが挙げられます。" },
];

export default function PanemajiFaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <ArticleLayout
      title="パネマジに関するよくある質問まとめ"
      subtitle="パネマジの意味から見分け方まで、初心者の疑問を解決"
      breadcrumb="パネマジFAQ"
      slug="panemaji-faq"
      datePublished="2026-04-12"
      dateModified="2026-04-12"
      description="パネマジに関するよくある質問をまとめて回答。パネマジの意味、見分け方、対策方法を解説。"
      relatedLinks={[
        { href: "/guide/panemaji-checker", label: "パネマジの見分け方ガイド｜7つのチェックポイント" },
        { href: "/guide/panemaji-taisaku", label: "パネマジ対策完全マニュアル" },
        { href: "/guide/how-to-use", label: "パネマジ掲示板の使い方ガイド" },
        { href: "/guide/first-deriheru", label: "初めてのデリヘル利用ガイド" },
        { href: "/guide/kuchikomi-katsuyou", label: "口コミの正しい読み方" },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          パネマジに関するよくある質問
        </h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">Q. {faq.q}</h3>
              <p className="text-gray-700">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </ArticleLayout>
  );
}
