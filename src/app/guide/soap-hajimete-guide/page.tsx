import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "初めてのソープランド完全ガイド｜流れ・料金・選び方",
  description: "ソープランド初心者向けに入店から退店までの流れ、料金相場、店選びのコツを徹底解説。吉原・川崎・雄琴の特徴も紹介。",
  keywords: ["ソープ 初めて", "ソープランド 初心者", "ソープ 流れ", "ソープ 料金", "ソープ 選び方"],
  alternates: { canonical: "https://panemaji.com/guide/soap-hajimete-guide" },
  openGraph: {
    title: "初めてのソープランド完全ガイド｜流れ・料金・選び方",
    description: "ソープランド初心者向けに流れ・料金・選び方を徹底解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/soap-hajimete-guide",
  },
};

export default function SoapHajimeteGuidePage() {
  return (
    <ArticleLayout
      title="初めてのソープランド完全ガイド｜流れ・料金・選び方"
      subtitle="ソープ初心者の不安を全て解消する完全マニュアル"
      breadcrumb="ソープ初心者ガイド"
      slug="soap-hajimete-guide"
      datePublished="2026-04-12"
      dateModified="2026-04-12"
      description="ソープランド初心者向け完全ガイド。流れ・料金・選び方を解説。"
      relatedLinks={[
        { href: "/guide/yoshiwara-soap-guide", label: "吉原ソープ完全攻略ガイド" },
        { href: "/guide/kawasaki-deriheru", label: "川崎デリヘル完全ガイド｜堀之内ソープ街" },
        { href: "/guide/deriheru-vs-soap", label: "デリヘルとソープの違い完全比較" },
        { href: "/guide/fuzoku-yougo", label: "風俗用語集" },
        { href: "/guide/panemaji-faq", label: "パネマジFAQ" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">ソープランドとは</h2>
        <p className="mb-3">
          ソープランドは店舗内の個室で入浴サービスを含む風俗店です。デリヘルと異なり店舗に出向く形式で、
          女性と対面してから選べる場合もあるため、パネマジのリスクはデリヘルより低いとされています。
        </p>
        <p>日本三大ソープ街として吉原（東京）、川崎堀之内（神奈川）、雄琴（滋賀）が知られています。</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">ソープの流れ</h2>
        <div className="space-y-3">
          {[
            { step: "1", title: "予約・来店", desc: "電話またはWebで予約し、指定時間に来店。入口で受付を済ませます。" },
            { step: "2", title: "待合室で待機", desc: "案内されるまで待合室で待ちます。飲み物が用意されている店舗もあります。" },
            { step: "3", title: "対面・入室", desc: "女性と対面し、個室に案内されます。フリーの場合はここで初対面になります。" },
            { step: "4", title: "入浴・洗体", desc: "女性と一緒に入浴します。体を洗い合うのがソープの基本サービスです。" },
            { step: "5", title: "マットプレイ", desc: "エアマットの上でボディウォッシュを含むサービスを受けます（上級店の場合）。" },
            { step: "6", title: "ベッドプレイ", desc: "ベッドに移動してサービスを受けます。内容は店舗のグレードにより異なります。" },
            { step: "7", title: "シャワー・退店", desc: "再度シャワーを浴びて身支度を整え、退店します。料金は入店時に支払い済みが一般的。" },
          ].map((item) => (
            <div key={item.step} className="flex gap-3 items-start">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-600 text-white font-bold text-sm shrink-0">{item.step}</span>
              <div>
                <p className="font-semibold text-gray-800">{item.title}</p>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">ソープの料金相場</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-3 py-2 text-left">グレード</th>
                <th className="border border-gray-200 px-3 py-2 text-center">60〜70分</th>
                <th className="border border-gray-200 px-3 py-2 text-center">100〜120分</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-gray-200 px-3 py-2">大衆店</td><td className="border border-gray-200 px-3 py-2 text-center">15,000〜25,000円</td><td className="border border-gray-200 px-3 py-2 text-center">25,000〜40,000円</td></tr>
              <tr><td className="border border-gray-200 px-3 py-2">中級店</td><td className="border border-gray-200 px-3 py-2 text-center">30,000〜50,000円</td><td className="border border-gray-200 px-3 py-2 text-center">50,000〜70,000円</td></tr>
              <tr><td className="border border-gray-200 px-3 py-2">高級店</td><td className="border border-gray-200 px-3 py-2 text-center">50,000〜80,000円</td><td className="border border-gray-200 px-3 py-2 text-center">80,000〜120,000円</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">※ 吉原の料金相場。エリアにより異なります。</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">ソープ選びのポイント</h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">初心者は大衆店から：</span>料金がリーズナブルで、接客もフレンドリーな店舗が多いです。</li>
          <li><span className="font-semibold">口コミでパネマジ度を確認：</span>ソープでもパネル写真と実物の差はあります。口コミは必ずチェックしましょう。</li>
          <li><span className="font-semibold">フリーで回転を狙う：</span>指名なしのフリーは料金が安く、空いている女性に当たるため意外な良い出会いがあることも。</li>
          <li><span className="font-semibold">予約は早めに：</span>人気嬢は予約が埋まりやすいため、特に週末は早めの予約がおすすめです。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
