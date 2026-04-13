import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗の年齢確認ガイド｜身分証は必要？",
  description: "風俗利用時の年齢確認について解説。身分証の提示は必要か、どのような書類が使えるか、プライバシーへの配慮など、年齢確認の疑問に答えます。",
  keywords: ["風俗 年齢確認", "風俗 身分証", "デリヘル 身分証明", "風俗 本人確認", "風俗 免許証"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-age-verification" },
  openGraph: {
    title: "風俗の年齢確認ガイド｜身分証は必要？",
    description: "風俗利用時の年齢確認を解説。身分証の必要性とプライバシーへの配慮。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-age-verification",
  },
};

export default function FuzokuAgeVerificationPage() {
  return (
    <ArticleLayout
      title="風俗の年齢確認ガイド"
      subtitle="身分証は必要？年齢確認の実態と対応法"
      breadcrumb="年齢確認ガイド"
      slug="fuzoku-age-verification"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗利用時の年齢確認を解説。身分証の必要性とプライバシーへの配慮。"
      relatedLinks={[
        { href: "/guide/fuzoku-age-limit-guide", label: "風俗の年齢制限ガイド" },
        { href: "/guide/fuzoku-law-guide", label: "風俗に関する法律ガイド" },
        { href: "/guide/first-deriheru", label: "初めてのデリヘルガイド" },
        { href: "/guide/fuzoku-membership-guide", label: "会員制度ガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          風俗で年齢確認はされる？
        </h2>
        <p className="mb-3">
          風俗店での年齢確認は店舗によって対応が異なります。
          法律上、店舗は18歳未満の利用者にサービスを提供してはならないため、
          若く見える方は身分証の提示を求められることがあります。
        </p>
        <p>
          近年はコンプライアンス意識の高まりから、全利用者に年齢確認を実施する店舗も増えています。
          身分証を持参しておくことで、スムーズに利用を開始できます。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          使える身分証と確認方法
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">有効な身分証明書</h3>
            <p>
              運転免許証、マイナンバーカード、パスポート、住民基本台帳カードなど、
              顔写真付きの公的身分証が一般的に有効です。
              健康保険証は顔写真がないため、追加の確認を求められる場合があります。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">プライバシーへの配慮</h3>
            <p>
              多くの店舗では生年月日の確認のみを行い、氏名や住所は確認しないよう配慮しています。
              身分証のコピーを取られることは通常ありません。
              不安な場合は事前に店舗へ確認方法を問い合わせてみましょう。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          年齢確認に関するよくある疑問
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">身分証がない場合：</span>身分証が手元にない場合は利用を断られることがあります。スマホに保存した画像では認められないケースが多いです。</li>
          <li><span className="font-semibold">個人情報の取扱い：</span>まともな店舗であれば身分証情報を記録・保存することはありません。不審に感じたら利用を中止しましょう。</li>
          <li><span className="font-semibold">会員証での代替：</span>会員登録済みの店舗では、初回に年齢確認を済ませていれば会員証だけで利用できる場合があります。</li>
          <li><span className="font-semibold">デリヘルの場合：</span>デリヘルでは対面時にキャストが確認するケースと電話予約時に口頭確認するケースがあります。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
