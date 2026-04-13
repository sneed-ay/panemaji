import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗の年齢制限ガイド｜何歳から利用できる？",
  description: "風俗の年齢制限について徹底解説。利用者側・働く側それぞれの年齢制限、法律上のルール、年齢確認の方法について詳しく紹介します。",
  keywords: ["風俗 年齢制限", "風俗 何歳から", "風俗 18歳", "風俗 年齢", "風俗 未成年"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-age-limit-guide" },
  openGraph: {
    title: "風俗の年齢制限ガイド｜何歳から利用できる？",
    description: "風俗の年齢制限を徹底解説。利用者側・働く側の年齢ルールと確認方法。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-age-limit-guide",
  },
};

export default function FuzokuAgeLimitGuidePage() {
  return (
    <ArticleLayout
      title="風俗の年齢制限ガイド"
      subtitle="何歳から利用できる？法律上のルールを解説"
      breadcrumb="年齢制限ガイド"
      slug="fuzoku-age-limit-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗の年齢制限を徹底解説。利用者側・働く側の年齢ルールと確認方法。"
      relatedLinks={[
        { href: "/guide/fuzoku-age-verification", label: "年齢確認ガイド" },
        { href: "/guide/fuzoku-law-guide", label: "風俗に関する法律ガイド" },
        { href: "/guide/first-deriheru", label: "初めてのデリヘルガイド" },
        { href: "/guide/fuzoku-etiquette-guide", label: "風俗マナーガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          風俗の年齢制限は何歳？
        </h2>
        <p className="mb-3">
          風俗営業等の規制及び業務の適正化等に関する法律（風営法）により、
          風俗サービスの利用は18歳以上と定められています。
          18歳未満の方は一切利用できません。
        </p>
        <p>
          また、多くの店舗では独自のルールとして「18歳以上の高校生不可」を設けており、
          高校在学中は18歳であっても利用を断られるケースがほとんどです。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          利用者側と働く側の年齢ルール
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">利用者側の年齢制限</h3>
            <p>
              法律上は18歳以上であれば利用可能ですが、店舗によっては20歳以上を条件にしている場合もあります。
              年齢上限は基本的にありませんが、健康状態に不安がある場合は無理をしないことが大切です。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">働く側の年齢制限</h3>
            <p>
              風俗店で働けるのは18歳以上（高校生不可）です。
              店舗には従業員の年齢確認義務があり、違反した場合は厳しい罰則が科されます。
              利用者として、明らかに年齢が疑わしい場合は利用を控えることも重要です。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          年齢に関する注意点
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">身分証の準備：</span>年齢確認のため身分証の提示を求められることがあります。運転免許証やマイナンバーカードを持参しましょう。</li>
          <li><span className="font-semibold">年齢詐称は厳禁：</span>未成年が年齢を偽って利用した場合、利用者側も法的責任を問われる可能性があります。</li>
          <li><span className="font-semibold">店舗独自のルール：</span>法律上の年齢制限に加え、店舗独自の年齢条件がある場合があります。事前に確認しておきましょう。</li>
          <li><span className="font-semibold">シニア向けサービス：</span>近年はシニア向けのゆったりしたコースを設ける店舗も増えており、年齢を問わず楽しめる環境が整いつつあります。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
