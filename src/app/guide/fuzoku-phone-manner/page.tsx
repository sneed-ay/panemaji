import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗の電話マナーガイド｜予約電話の正しいかけ方",
  description: "風俗店への電話予約の正しいマナーを解説。初めての電話で伝えるべき内容、NGワード、スムーズな予約のコツを紹介します。",
  keywords: ["風俗 電話", "風俗 予約 電話", "デリヘル 電話 マナー", "風俗 電話 かけ方", "風俗 初めて 電話"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-phone-manner" },
  openGraph: {
    title: "風俗の電話マナーガイド｜予約電話の正しいかけ方",
    description: "風俗店への電話予約の正しいマナーを解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-phone-manner",
  },
};

export default function FuzokuPhoneMannerPage() {
  return (
    <ArticleLayout
      title="風俗の電話マナーガイド"
      subtitle="予約電話の正しいかけ方とスムーズな対応術"
      breadcrumb="電話マナーガイド"
      slug="fuzoku-phone-manner"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗店への電話予約の正しいマナーを解説。"
      relatedLinks={[
        { href: "/guide/deriheru-erabikata", label: "デリヘルの選び方" },
        { href: "/guide/fuzoku-first-timer-mistakes", label: "初心者が犯しがちなミス" },
        { href: "/guide/deriheru-hajimete-faq", label: "初めてのデリヘルFAQ" },
        { href: "/guide/fuzoku-referral-guide", label: "紹介制度ガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          電話予約の基本マナー
        </h2>
        <p className="mb-3">
          風俗店への電話は緊張するものですが、基本的なマナーを押さえておけば
          スムーズに予約できます。受付スタッフは毎日多くの電話を受けているため、
          簡潔かつ丁寧に要件を伝えることが大切です。
        </p>
        <p>
          電話をかける前に、希望の日時・コース・指名したいキャストを
          メモしておくと落ち着いて対応できます。初めての利用であることを伝えれば
          スタッフが丁寧に案内してくれるお店がほとんどです。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          電話で伝えるべき内容
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">予約時の必須情報</h3>
            <p>
              利用希望日時、希望コース（時間）、指名の有無を伝えましょう。
              デリヘルの場合はホテル名や自宅利用かも聞かれます。
              場所が決まっていない場合は「これから決めます」と伝えれば問題ありません。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">聞いておくべきポイント</h3>
            <p>
              料金の総額、入会金やその他費用の有無、交通費の有無を確認しましょう。
              Webサイトに記載されていない追加料金が発生するケースもあるため、
              事前に確認しておくとトラブルを防げます。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">避けるべきNG質問</h3>
            <p>
              具体的なサービス内容を電話で詳しく聞くのはNGです。
              店舗は法律の範囲内で営業しているため、電話での過度な質問は
              受付スタッフを困らせるだけでなく、予約を断られる原因にもなります。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          電話予約のコツまとめ
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">かける時間帯：</span>受付開始直後や深夜は混み合うため、営業時間の中間が繋がりやすくおすすめです。</li>
          <li><span className="font-semibold">非通知は避ける：</span>非通知設定だと電話に出てもらえないお店が多いです。番号通知でかけましょう。</li>
          <li><span className="font-semibold">キャンセルは早めに：</span>予約後のキャンセルは必ず電話で連絡を。無断キャンセルはブラックリスト入りの原因になります。</li>
          <li><span className="font-semibold">Web予約も活用：</span>電話が苦手な方はWeb予約やLINE予約に対応している店舗を選ぶのも手です。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
