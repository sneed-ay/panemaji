import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "初めてのデリヘル利用ガイド｜失敗しない選び方",
  description:
    "デリヘルを初めて利用する方向けの完全ガイド。予約方法から当日の流れ、パネマジ回避のコツまで詳しく解説します。",
  keywords: ["デリヘル 初めて", "デリヘル 初心者", "デリヘル 使い方", "デリヘル 予約方法"],
  alternates: { canonical: "https://panemaji.com/guide/first-deriheru" },
  openGraph: {
    title: "初めてのデリヘル利用ガイド｜失敗しない選び方",
    description: "デリヘルを初めて利用する方向けの完全ガイド。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/first-deriheru",
  },
};

export default function FirstDeriheruPage() {
  return (
    <ArticleLayout
      title="初めてのデリヘル利用ガイド"
      subtitle="失敗しないための店舗選びから当日の流れまで"
      breadcrumb="初めてのデリヘル"
      ctaHref="/"
      ctaLabel="パネマジ掲示板で店舗を探す →"
      relatedLinks={[
        { href: "/guide/how-to-use", label: "パネマジ掲示板の使い方ガイド" },
        { href: "/guide/panemaji-taisaku", label: "パネマジ対策完全マニュアル" },
        { href: "/guide/deriheru-erabikata", label: "デリヘル店の賢い選び方" },
        { href: "/guide/panemaji-checker", label: "パネマジの見分け方ガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          デリヘルとは
        </h2>
        <p className="mb-3">
          デリヘル（デリバリーヘルス）は、指定した場所に女性が来てくれる風俗サービスです。
          ホテルや自宅に派遣されるのが一般的で、店舗に足を運ぶ必要がないのが特徴です。
        </p>
        <p>
          全国に多数の店舗が営業しており、初めての方でも比較的利用しやすいサービスです。
          ただし、パネル写真と実物が異なる「パネマジ」には注意が必要です。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          利用の基本的な流れ
        </h2>
        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
            <div>
              <h3 className="font-bold mb-1">店舗を選ぶ</h3>
              <p>
                パネマジ掲示板やポータルサイトで、エリアと予算に合った店舗を探します。
                口コミ評価の高い店舗を選ぶのが初めての方には安心です。
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
            <div>
              <h3 className="font-bold mb-1">女性を選んで予約</h3>
              <p>
                店舗のホームページでパネル写真やプロフィールを確認し、気になる女性を選びます。
                電話やWebで予約しましょう。初めての利用であることを伝えると丁寧に案内してもらえます。
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
            <div>
              <h3 className="font-bold mb-1">場所を準備する</h3>
              <p>
                ホテルまたは自宅で待ちます。ラブホテルの場合は先に部屋を取り、
                部屋番号を店舗に伝えます。ビジネスホテルでもデリヘル可のホテルがあります。
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
            <div>
              <h3 className="font-bold mb-1">女性が到着</h3>
              <p>
                予約時間になると女性が到着します。料金を支払い、サービスを受けます。
                時間制で、60分・90分・120分などのコースが一般的です。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          初心者がパネマジを避けるコツ
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li>
            <span className="font-semibold">口コミが多い女性を選ぶ：</span>
            初めての利用では、口コミ数が多く「パネル通り」の評価が高い女性を選ぶのが安全です。
          </li>
          <li>
            <span className="font-semibold">人気ランキングを参考に：</span>
            パネマジ掲示板のランキングで上位にいる女性は、パネル一致度が高い傾向にあります。
          </li>
          <li>
            <span className="font-semibold">老舗の有名店を選ぶ：</span>
            初めての方は、営業年数が長く評判の良い店舗を選ぶのがおすすめです。
          </li>
          <li>
            <span className="font-semibold">極端に安い店は避ける：</span>
            相場より極端に安い店舗はパネマジのリスクが高い場合があります。適正価格帯の店舗を選びましょう。
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          初心者向けの注意点
        </h2>
        <div className="bg-blue-50 rounded-lg p-4">
          <ul className="space-y-2 list-disc list-inside text-blue-800">
            <li>料金体系を事前に確認し、追加料金の有無を把握しておきましょう</li>
            <li>キャンセル料や変更ルールも事前に確認しておくと安心です</li>
            <li>お酒を飲みすぎた状態での利用は避けましょう</li>
            <li>利用後はパネマジ掲示板で口コミを投稿し、他の利用者の参考にしましょう</li>
          </ul>
        </div>
      </section>
    </ArticleLayout>
  );
}
