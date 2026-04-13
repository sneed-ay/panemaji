import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗マナー度チェック｜あなたのマナーは大丈夫？",
  description: "風俗利用のマナーをセルフチェック。よくあるマナー違反の例、基本的なエチケット、キャストに嫌われるNG行動を解説します。",
  keywords: ["風俗 マナー", "風俗 エチケット", "デリヘル マナー", "風俗 NG行動", "風俗 マナーチェック"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-etiquette-test" },
  openGraph: {
    title: "風俗マナー度チェック｜あなたのマナーは大丈夫？",
    description: "風俗利用のマナーをセルフチェック。基本エチケットとNG行動を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-etiquette-test",
  },
};

export default function FuzokuEtiquetteTestPage() {
  return (
    <ArticleLayout
      title="風俗マナー度チェック"
      subtitle="あなたのマナーは大丈夫？セルフ診断"
      breadcrumb="マナーチェック"
      slug="fuzoku-etiquette-test"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗利用のマナーをセルフチェック。基本エチケットとNG行動を解説。"
      relatedLinks={[
        { href: "/guide/fuzoku-etiquette-guide", label: "風俗マナーガイド" },
        { href: "/guide/fuzoku-diet-body-guide", label: "ボディケアガイド" },
        { href: "/guide/first-deriheru", label: "初めてのデリヘルガイド" },
        { href: "/guide/deriheru-trouble-case1", label: "トラブル事例集" },
        { href: "/guide/fuzoku-newcomer-guide", label: "新人嬢ガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          マナーが良い客は得をする
        </h2>
        <p className="mb-3">
          風俗においてマナーの良し悪しは、サービスの質に直結します。
          キャストも人間ですから、礼儀正しい相手にはより丁寧に接してくれるものです。
          逆にマナーの悪い客はサービスが最低限になったり、出禁になることもあります。
        </p>
        <p>
          以下のチェックポイントで、自分のマナーを振り返ってみましょう。
          一つでも当てはまるものがあれば、改善の余地があるかもしれません。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          マナーチェックリスト
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">利用前のマナー</h3>
            <p>
              入浴や歯磨きを済ませているか、爪は短く切っているか、時間に遅れず到着しているか。
              これらは基本中の基本ですが、意外と疎かにしている方が多いポイントです。
              事前準備がしっかりしている客はキャストからの評価が高くなります。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">サービス中のマナー</h3>
            <p>
              禁止行為を強要しない、乱暴な扱いをしない、個人的な連絡先を聞かない。
              これらはどの店舗でも共通のルールです。
              キャストの同意なく行為を要求することはハラスメントであり、退店処分の対象になります。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          よくあるNG行動と改善ポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">時間オーバー：</span>コース時間を超えて居座るのはマナー違反です。時計を確認し、時間内で切り上げましょう。</li>
          <li><span className="font-semibold">値切り行為：</span>サービス提供後に料金を値切る行為は店舗との信頼関係を壊します。料金は事前に確認し、納得の上で利用しましょう。</li>
          <li><span className="font-semibold">撮影行為：</span>キャストの写真や動画の撮影は固く禁じられています。見つかった場合は法的措置を取られることもあります。</li>
          <li><span className="font-semibold">酔いすぎ：</span>泥酔状態での利用はキャストの負担になり、トラブルの原因にもなります。適量の飲酒にとどめましょう。</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
