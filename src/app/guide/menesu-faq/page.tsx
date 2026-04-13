import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "メンエスのよくある質問｜初心者が気になる疑問を解説",
  description:
    "メンズエステ（メンエス）に関するよくある質問をまとめて回答。料金、流れ、マナー、パネマジ対策まで初心者の疑問を解決します。",
  keywords: ["メンエス とは", "メンエス 初めて", "メンエス FAQ", "メンズエステ 質問", "メンエス マナー"],
  alternates: { canonical: "https://panemaji.com/guide/menesu-faq" },
  openGraph: {
    title: "メンエスのよくある質問｜初心者が気になる疑問を解説",
    description: "メンエスに関するよくある質問をまとめて回答します。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/menesu-faq",
  },
};

const faqs = [
  { q: "メンエス（メンズエステ）とは何ですか？", a: "メンエスとは、男性向けのリラクゼーションマッサージを提供するエステサロンの総称です。セラピスト（女性スタッフ）がオイルマッサージやアロママッサージなどの施術を行います。一般的なリラクゼーションサロンとは異なり、際どい施術を売りにする店舗もあります。" },
  { q: "メンエスとデリヘルの違いは何ですか？", a: "メンエスはあくまでマッサージ・エステサービスであり、本来は性的サービスを提供しません。デリヘルは風俗営業として性的サービスを前提としています。ただし、メンエスの中にはグレーゾーンの施術を提供する店舗も存在します。" },
  { q: "メンエスの料金相場はどのくらいですか？", a: "一般的な相場は60分10,000〜15,000円、90分15,000〜22,000円、120分20,000〜30,000円程度です。エリアや店舗のグレードにより大きく異なります。新宿や銀座など都心は高め、郊外は安めの傾向です。" },
  { q: "メンエスでのマナーを教えてください", a: "基本的なマナーとして、(1)施術前にシャワーを浴びる、(2)セラピストに許可なく触らない、(3)性的サービスを強要しない、(4)時間内に終了する、(5)清潔な服装で来店する、などがあります。マナーの良い客はセラピストからの印象も良くなります。" },
  { q: "メンエスにもパネマジはありますか？", a: "はい、メンエスでもパネマジは存在します。ただしデリヘルほど極端な差は少ない傾向です。セラピスト個人のSNS（特にTwitter/X）があれば、自撮り写真で実物に近い姿を確認できることが多いです。" },
  { q: "メンエスの施術はどんな流れですか？", a: "一般的な流れは、(1)来店・受付、(2)着替え・シャワー、(3)うつ伏せでの背面施術、(4)仰向けでの前面施術、(5)シャワー・着替え、(6)お会計・退店です。施術の詳細は店舗やコースにより異なります。" },
  { q: "チップは必要ですか？", a: "チップは基本的に不要です。ただし、満足度が高かった場合にセラピストへ渡す利用者もいます。チップの相場は1,000〜3,000円程度が多いですが、あくまで任意です。" },
];

export default function MenesuFaqPage() {
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
      title="メンエスのよくある質問｜初心者が気になる疑問を解説"
      subtitle="メンズエステの基本から料金・マナーまで徹底FAQ"
      breadcrumb="メンエスFAQ"
      slug="menesu-faq"
      datePublished="2026-04-12"
      dateModified="2026-04-12"
      description="メンエスに関するよくある質問をまとめて回答。料金、マナー、パネマジ対策まで解説。"
      relatedLinks={[
        { href: "/guide/hajimete-menesu", label: "初めてのメンエス完全ガイド" },
        { href: "/guide/menesu-nagare", label: "メンズエステの施術の流れ完全解説" },
        { href: "/guide/menesu-ryoukin-souba", label: "メンエスの料金相場まとめ" },
        { href: "/guide/menesu-panemaji", label: "メンエスのパネマジ事情" },
        { href: "/guide/menesu-erabikata", label: "失敗しないメンエスの選び方" },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          メンエスに関するよくある質問
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
