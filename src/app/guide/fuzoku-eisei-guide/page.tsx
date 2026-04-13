import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗利用時の衛生管理ガイド｜安全に楽しむための知識",
  description: "風俗利用時に知っておくべき衛生管理の知識を解説。性病予防、清潔マナー、安全な利用方法を紹介します。",
  keywords: ["風俗 衛生", "風俗 性病 予防", "デリヘル 衛生", "風俗 安全", "性病 対策"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-eisei-guide" },
  openGraph: {
    title: "風俗利用時の衛生管理ガイド｜安全に楽しむための知識",
    description: "風俗利用時の衛生管理の知識を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-eisei-guide",
  },
};

export default function FuzokuEiseiGuidePage() {
  return (
    <ArticleLayout
      title="風俗利用時の衛生管理ガイド｜安全に楽しむための知識"
      subtitle="健康を守りながら風俗を楽しむための必須知識"
      breadcrumb="衛生管理ガイド"
      slug="fuzoku-eisei-guide"
      datePublished="2026-04-12"
      dateModified="2026-04-12"
      description="風俗利用時の衛生管理の知識。性病予防、清潔マナー、安全な利用方法を解説。"
      relatedLinks={[
        { href: "/guide/first-deriheru", label: "初めてのデリヘル利用ガイド" },
        { href: "/guide/fuzoku-manner-guide", label: "風俗マナー完全ガイド" },
        { href: "/guide/fuzoku-trouble-taisaku", label: "風俗トラブル対策ガイド" },
        { href: "/guide/ns-nn-toha", label: "NS/NNとは？意味と注意点" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">風俗利用前の衛生準備</h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">シャワーを必ず浴びる：</span>利用前のシャワーは最低限のマナーです。爪を短く切り、体臭ケアも忘れずに。</li>
          <li><span className="font-semibold">口腔ケアを行う：</span>歯磨きやマウスウォッシュで口臭対策をしましょう。</li>
          <li><span className="font-semibold">体調が悪い時は利用を控える：</span>風邪やインフルエンザなどの症状がある場合はキャンセルしましょう。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">性感染症の予防</h2>
        <div className="bg-pink-50 rounded-lg p-4 mb-4">
          <p className="font-bold text-pink-700 mb-2">必ずコンドームを使用しましょう</p>
          <p>NS（ノースキン）やNN（ノーノー）を謳う店舗もありますが、性感染症のリスクが格段に高まります。自分と相手の健康を守るため、必ずコンドームを使用してください。</p>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-semibold">主な性感染症とリスク</p>
            <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
              <li>クラミジア：最も多い性感染症。自覚症状が少ない場合も。</li>
              <li>淋病：排尿時の痛みや膿が特徴。抗生物質で治療可能。</li>
              <li>梅毒：近年増加傾向。初期は痛みのない潰瘍ができる。</li>
              <li>HIV：コンドームの使用で予防可能。定期的な検査も重要。</li>
              <li>ヘルペス：コンドームでは完全に予防できない場合も。</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">利用後の衛生管理</h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">帰宅後すぐにシャワーを浴びる：</span>感染リスクを下げるため、早めに清潔にしましょう。</li>
          <li><span className="font-semibold">異変を感じたら早めに受診：</span>排尿時の違和感、発疹、痛みなどの症状が出たらすぐに医療機関を受診しましょう。</li>
          <li><span className="font-semibold">定期的な性感染症検査を：</span>風俗を定期的に利用する方は、3〜6ヶ月ごとの検査をおすすめします。保健所では無料・匿名で受けられます。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
