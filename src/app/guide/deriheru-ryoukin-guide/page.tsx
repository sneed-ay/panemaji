import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "デリヘルの料金ガイド｜コース・オプション・交通費の仕組み",
  description: "デリヘルの料金体系を徹底解説。基本コース料金、指名料、オプション料金、交通費の仕組みと相場を紹介します。",
  keywords: ["デリヘル 料金", "デリヘル 相場", "デリヘル コース料金", "デリヘル オプション", "デリヘル 交通費"],
  alternates: { canonical: "https://panemaji.com/guide/deriheru-ryoukin-guide" },
  openGraph: {
    title: "デリヘルの料金ガイド｜コース・オプション・交通費の仕組み",
    description: "デリヘルの料金体系を徹底解説。コース・オプション・交通費の仕組み。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/deriheru-ryoukin-guide",
  },
};

export default function DeriheruRyoukinGuidePage() {
  return (
    <ArticleLayout
      title="デリヘルの料金ガイド"
      subtitle="コース・オプション・交通費の仕組みを徹底解説"
      breadcrumb="デリヘル料金ガイド"
      slug="deriheru-ryoukin-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="デリヘルの料金体系を徹底解説。基本コース料金、指名料、オプション、交通費の仕組みと相場。"
      relatedLinks={[
        { href: "/guide/first-deriheru", label: "初めてのデリヘル利用ガイド" },
        { href: "/guide/deriheru-erabikata", label: "デリヘル店の賢い選び方" },
        { href: "/guide/fuzoku-ryoukin-souba", label: "風俗の料金相場まとめ" },
        { href: "/guide/fuzoku-trouble-taisaku", label: "風俗トラブル対策ガイド" },
        { href: "/guide/fuzoku-beginner-checklist", label: "風俗初心者の持ち物チェックリスト" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          デリヘルの料金構成を理解する
        </h2>
        <p className="mb-3">
          デリヘルの料金は「基本コース料金」だけではありません。
          指名料、オプション料金、交通費など複数の要素で構成されており、
          総額を事前に把握しておくことがトラブル防止の第一歩です。
        </p>
        <p>
          ここでは各料金項目の仕組みと一般的な相場を解説します。
          初めての方も、利用経験のある方も、改めて確認しておきましょう。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          基本コース料金の相場
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">時間別の一般的な相場</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li><span className="font-semibold">60分コース：</span>12,000〜20,000円が中心帯。最も人気のある標準的なコース。</li>
              <li><span className="font-semibold">90分コース：</span>18,000〜28,000円程度。ゆっくり楽しみたい方におすすめ。</li>
              <li><span className="font-semibold">120分コース：</span>24,000〜38,000円程度。長時間のプレイや会話も重視する方向け。</li>
              <li><span className="font-semibold">ショートコース（40〜45分）：</span>8,000〜15,000円程度。時間に余裕がない場合に便利。</li>
            </ul>
          </div>
          <p className="text-sm text-gray-600">
            ※エリアや店舗のグレードによって大きく異なります。都心部は地方より1.2〜1.5倍程度高めの傾向があります。
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          指名料・オプション・交通費の仕組み
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">指名料（1,000〜3,000円）：</span>フリー（指名なし）なら不要。本指名は2,000〜3,000円、写真指名は1,000〜2,000円が相場です。</li>
          <li><span className="font-semibold">交通費（無料〜3,000円）：</span>自宅派遣の場合に発生。ホテル街の指定エリア内は無料の店舗も多いです。</li>
          <li><span className="font-semibold">オプション料金（1,000〜5,000円/項目）：</span>コスプレ、パンスト、即尺などの追加プレイに別途費用がかかります。</li>
          <li><span className="font-semibold">延長料金（3,000〜8,000円/30分）：</span>時間を延長する場合に発生。事前に店舗に確認しておきましょう。</li>
          <li><span className="font-semibold">入会金・年会費：</span>多くの店舗では無料ですが、一部の高級店では1,000〜3,000円の入会金が必要な場合があります。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          料金で失敗しないためのポイント
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">予約時に総額を確認する</h3>
            <p>
              予約の電話やLINEで「コース料金＋指名料＋交通費の総額はいくらですか？」と聞くのが確実です。
              料金を明示してくれない店舗は避けた方が無難です。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">割引・イベントを活用する</h3>
            <p>
              新規割引、メルマガ割引、雨の日割引など、多くの店舗がイベントを実施しています。
              公式サイトやポータルサイトで最新の割引情報をチェックしましょう。
              2,000〜5,000円の割引が受けられることも珍しくありません。
            </p>
          </div>
          <p>
            デリヘルの料金は事前に把握すれば怖くありません。
            口コミサイトで他の利用者の実際の支払額を参考にするのもおすすめです。
          </p>
        </div>
      </section>
    </ArticleLayout>
  );
}
