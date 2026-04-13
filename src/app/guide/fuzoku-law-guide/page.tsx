import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗に関する法律ガイド｜知っておくべき基礎知識",
  description: "風俗に関する法律の基礎知識を解説。風営法の概要、利用者が知っておくべきルール、違法店の見分け方など、法律面の注意点を紹介します。",
  keywords: ["風俗 法律", "風営法", "風俗 違法", "風俗 ルール", "風俗 合法"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-law-guide" },
  openGraph: {
    title: "風俗に関する法律ガイド｜知っておくべき基礎知識",
    description: "風俗に関する法律の基礎知識。風営法と利用者が知るべきルールを解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-law-guide",
  },
};

export default function FuzokuLawGuidePage() {
  return (
    <ArticleLayout
      title="風俗に関する法律ガイド"
      subtitle="知っておくべき基礎知識と法的注意点"
      breadcrumb="風俗法律ガイド"
      slug="fuzoku-law-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗に関する法律の基礎知識。風営法と利用者が知るべきルールを解説。"
      relatedLinks={[
        { href: "/guide/fuzoku-age-limit-guide", label: "年齢制限ガイド" },
        { href: "/guide/fuzoku-age-verification", label: "年齢確認ガイド" },
        { href: "/guide/fuzoku-etiquette-guide", label: "風俗マナーガイド" },
        { href: "/guide/first-deriheru", label: "初めてのデリヘルガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          風営法の基本を理解しよう
        </h2>
        <p className="mb-3">
          日本の風俗営業は「風俗営業等の規制及び業務の適正化等に関する法律」（風営法）によって規制されています。
          この法律は風俗営業の許可制度、営業時間の制限、年齢制限などを定めており、
          利用者も基本的な内容を理解しておくことが大切です。
        </p>
        <p>
          風俗店が合法的に営業するためには、都道府県公安委員会への届出や許可が必要です。
          無届けの店舗は違法営業であり、利用者もトラブルに巻き込まれるリスクがあります。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          利用者が知っておくべき法律知識
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">年齢に関する法律</h3>
            <p>
              18歳未満の者が風俗サービスを利用することは法律で禁止されています。
              また、18歳未満の者にサービスを提供した店舗は厳しい罰則を受けます。
              利用者として、明らかに未成年と思われるキャストに遭遇した場合は利用を中止すべきです。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">禁止行為と罰則</h3>
            <p>
              風俗店での撮影・録音は各店舗の規約で禁止されており、
              場合によっては法的措置を取られることがあります。
              また、キャストへの暴力行為や脅迫は刑法上の犯罪として処罰の対象となります。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          違法店を避けるためのポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">大手ポータルサイト掲載店を選ぶ：</span>大手サイトに掲載されている店舗は一定の審査を通過しており、違法店のリスクが低いです。</li>
          <li><span className="font-semibold">不自然に安い料金に注意：</span>相場よりも極端に安い料金を掲げている店舗は、何らかの問題を抱えている可能性があります。</li>
          <li><span className="font-semibold">路上キャッチに応じない：</span>路上でのキャッチ営業は法律で規制されています。声をかけられても応じないようにしましょう。</li>
          <li><span className="font-semibold">口コミを確認する：</span>口コミサイトでの評判を確認することで、安心して利用できる店舗を見つけやすくなります。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
