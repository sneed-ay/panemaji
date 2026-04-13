import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "デリヘル初心者のよくある質問｜不安を解消するFAQ",
  description: "デリヘル初めての方向けによくある質問をまとめました。予約方法、料金、マナー、注意点まで丁寧に解説します。",
  keywords: ["デリヘル 初めて 質問", "デリヘル 不安", "デリヘル FAQ", "デリヘル 初心者", "デリヘル 予約方法"],
  alternates: { canonical: "https://panemaji.com/guide/deriheru-hajimete-faq" },
  openGraph: {
    title: "デリヘル初心者のよくある質問｜不安を解消するFAQ",
    description: "デリヘル初めての方向けによくある質問をまとめました。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/deriheru-hajimete-faq",
  },
};

const faqs = [
  { q: "デリヘルの予約はどうやってしますか？", a: "電話またはWebフォームで予約します。希望の時間・コース・指名の有無・ホテル名（または自宅）を伝えましょう。多くの店舗はLINEでの予約にも対応しています。初めての場合は電話予約が確実です。" },
  { q: "ホテルはどうやって選べばいい？", a: "デリヘルはラブホテルまたはビジネスホテルで利用します。初めての場合はラブホテルが無難です。店舗に「おすすめのホテルはありますか？」と聞くと教えてもらえることが多いです。自宅派遣も可能な店舗があります。" },
  { q: "料金の支払い方法は？", a: "基本的に現金払いが主流です。クレジットカード対応の店舗もありますが少数派です。料金はコース料金＋交通費＋指名料で、入室後に女性に直接渡すケースが多いです。" },
  { q: "身分証の提示は必要？", a: "通常は不要です。ただし、18歳未満でないことの確認を電話で行う店舗はあります。身分証の提示を求められることは基本的にありません。" },
  { q: "どんな服装で行けばいい？", a: "特に決まりはありませんが、清潔感のある普段着で問題ありません。ホテルに入る際に目立ちすぎない格好が無難です。" },
  { q: "女の子が来る前に準備することは？", a: "シャワーを浴びて清潔にしておきましょう。部屋を簡単に片付け、料金を封筒に入れて準備しておくとスマートです。歯磨きや口臭ケアも忘れずに。" },
  { q: "サービスの時間はどこからカウント？", a: "女性がホテルの部屋に到着した時点からカウントが始まるのが一般的です。シャワータイムも含まれるため、実質のプレイ時間はコース時間より短くなります。" },
  { q: "チェンジはできますか？", a: "多くの店舗でチェンジ（女性の交代）は可能ですが、チェンジ料が発生したり、次の女性が到着するまで時間がかかる場合があります。チェンジのルールは店舗により異なるため、事前に確認しましょう。" },
];

export default function DeriheruHajimeteFaqPage() {
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
      title="デリヘル初心者のよくある質問｜不安を解消するFAQ"
      subtitle="初めてのデリヘル利用で気になる疑問を全て解決"
      breadcrumb="デリヘル初心者FAQ"
      slug="deriheru-hajimete-faq"
      datePublished="2026-04-12"
      dateModified="2026-04-12"
      description="デリヘル初心者向けFAQ。予約方法、料金、マナー、注意点を解説。"
      relatedLinks={[
        { href: "/guide/first-deriheru", label: "初めてのデリヘル利用ガイド" },
        { href: "/guide/panemaji-faq", label: "パネマジに関するよくある質問まとめ" },
        { href: "/guide/fuzoku-yougo", label: "風俗用語集｜初心者向け基本用語50選" },
        { href: "/guide/deriheru-erabikata", label: "デリヘル店の賢い選び方" },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">デリヘル初心者のよくある質問</h2>
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
