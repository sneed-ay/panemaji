import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗の紹介制度ガイド｜友達紹介割引の活用法",
  description: "風俗店の紹介制度・友達紹介割引の活用法を解説。紹介特典の種類、利用条件、注意点をまとめて紹介します。",
  keywords: ["風俗 紹介", "風俗 友達紹介", "デリヘル 紹介割引", "風俗 紹介制度", "風俗 紹介特典"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-referral-guide" },
  openGraph: {
    title: "風俗の紹介制度ガイド｜友達紹介割引の活用法",
    description: "風俗店の紹介制度と友達紹介割引の活用法を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-referral-guide",
  },
};

export default function FuzokuReferralGuidePage() {
  return (
    <ArticleLayout
      title="風俗の紹介制度ガイド"
      subtitle="友達紹介割引を賢く活用する方法"
      breadcrumb="紹介制度ガイド"
      slug="fuzoku-referral-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗店の紹介制度と友達紹介割引の活用法を解説。"
      relatedLinks={[
        { href: "/guide/fuzoku-point-guide", label: "ポイントカード活用ガイド" },
        { href: "/guide/deriheru-cost-save-guide", label: "コスト節約ガイド" },
        { href: "/guide/fuzoku-phone-manner", label: "電話マナーガイド" },
        { href: "/guide/fuzoku-price-trend-2026", label: "2026年の料金トレンド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          風俗の紹介制度とは
        </h2>
        <p className="mb-3">
          風俗店の紹介制度は既存の会員が友人・知人を紹介すると、
          紹介者と被紹介者の双方が割引やサービスを受けられる制度です。
          新規顧客の獲得に効果的なため多くの店舗が導入しています。
        </p>
        <p>
          紹介特典は店舗によって異なりますが、料金割引やコース延長、
          次回利用時のポイント付与などが一般的です。
          うまく活用すれば通常よりお得に利用できます。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          紹介制度の利用方法
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">紹介の手順</h3>
            <p>
              紹介制度を利用するには、被紹介者が予約時に紹介者の会員番号や名前を
              伝えるのが一般的です。店舗によっては紹介カードやクーポンコードを
              使用する場合もあります。事前に利用手順を確認しておきましょう。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">特典の種類</h3>
            <p>
              紹介者には次回利用の割引やポイント付与、被紹介者には初回割引が
              適用されるパターンが多いです。中には双方にコース延長や
              オプション無料のサービスがつく太っ腹な店舗もあります。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">紹介しやすい環境づくり</h3>
            <p>
              風俗の紹介はデリケートな話題のため、同じ趣味を持つ信頼できる友人に
              限定するのが無難です。無理に紹介を勧めるとトラブルの元になります。
              自然な流れで話題が出たときに紹介制度の存在を伝えましょう。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          紹介制度の注意点
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">利用条件の確認：</span>紹介特典の適用には条件がある場合が多いです。最低利用コースや有効期限を事前に確認しましょう。</li>
          <li><span className="font-semibold">個人情報の取り扱い：</span>紹介時に会員番号等を共有する必要がありますが、個人情報の管理には十分注意しましょう。</li>
          <li><span className="font-semibold">他の割引との併用：</span>紹介割引は他のイベント割引と併用できないケースが多いです。どちらがお得か比較しましょう。</li>
          <li><span className="font-semibold">トラブル時の責任：</span>紹介した友人がトラブルを起こすと紹介者にも影響が及ぶ場合があります。信頼できる相手に限りましょう。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
