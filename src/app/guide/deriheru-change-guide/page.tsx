import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "デリヘルのチェンジ・キャンセル完全ガイド｜ルールと注意点",
  description: "デリヘルのチェンジ・キャンセルのルールと注意点を徹底解説。チェンジの手順、キャンセル料の相場、トラブルを避けるためのポイントを紹介します。",
  keywords: ["デリヘル チェンジ", "デリヘル キャンセル", "風俗 チェンジ", "デリヘル チェンジ料", "風俗 キャンセル料"],
  alternates: { canonical: "https://panemaji.com/guide/deriheru-change-guide" },
  openGraph: {
    title: "デリヘルのチェンジ・キャンセル完全ガイド｜ルールと注意点",
    description: "デリヘルのチェンジ・キャンセルのルールと注意点を徹底解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/deriheru-change-guide",
  },
};

export default function DeriheruChangeGuidePage() {
  return (
    <ArticleLayout
      title="デリヘルのチェンジ・キャンセル完全ガイド"
      subtitle="ルールと注意点を知ってトラブルを未然に防ぐ"
      breadcrumb="チェンジ・キャンセルガイド"
      slug="deriheru-change-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="デリヘルのチェンジ・キャンセルのルールと注意点を解説。手順と料金相場。"
      relatedLinks={[
        { href: "/guide/panemaji-taisaku", label: "パネマジ対策ガイド" },
        { href: "/guide/fuzoku-trouble-taisaku", label: "風俗トラブル対策" },
        { href: "/guide/fuzoku-manner-guide", label: "風俗マナー完全ガイド" },
        { href: "/guide/fuzoku-free-guide", label: "フリー利用ガイド" },
        { href: "/guide/deriheru-erabikata", label: "デリヘル店の賢い選び方" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          チェンジとは何か
        </h2>
        <p className="mb-3">
          チェンジとは、到着したキャストを見て「写真と違う」「イメージと異なる」と感じた場合に、
          別のキャストに交代してもらう制度です。多くのデリヘル店で用意されている制度ですが、
          店舗によってルールが大きく異なります。
        </p>
        <p>
          チェンジは客側の正当な権利ですが、キャストの精神的な負担にもなるため、
          頻繁に利用するのは避けるべきです。パネマジ対策として写真やプロフィールを
          事前にしっかり確認することが最も重要です。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          チェンジの手順と料金
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">チェンジの基本的な流れ</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li><span className="font-semibold">入室時に判断：</span>チェンジを希望する場合は、キャストが部屋に入った直後に伝えるのが基本です。プレイ開始後のチェンジは原則としてできません。</li>
              <li><span className="font-semibold">店舗に電話：</span>キャストに直接「チェンジしたい」と伝えるのではなく、店舗に電話して申し出るのがマナーです。</li>
              <li><span className="font-semibold">代わりのキャストを待つ：</span>チェンジが成立した場合、新しいキャストの到着まで追加で待つ必要があります。</li>
            </ul>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">チェンジ料金の相場</h3>
            <p>
              チェンジ無料を謳う店舗もありますが、交通費として1,000〜3,000円が発生するのが一般的です。
              また、チェンジ後のキャストに対しても交通費が発生するため、
              合計で2,000〜5,000円程度の追加出費を見込んでおく必要があります。
              プレイ開始後のチェンジは全額負担となるケースがほとんどです。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          キャンセルのルールと料金
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">予約後のキャンセル：</span>キャスト出発前であれば無料でキャンセルできる店舗が多いです。ただし、出発後は交通費として2,000〜5,000円のキャンセル料が発生します。</li>
          <li><span className="font-semibold">到着後のキャンセル：</span>キャストが到着した後のキャンセルは、コース料金の50〜100%がキャンセル料として請求されるケースがほとんどです。</li>
          <li><span className="font-semibold">無断キャンセル（飛び）：</span>連絡なしにキャンセルする行為は最も重いペナルティの対象です。店舗のブラックリストに登録され、以降の利用を断られることがあります。</li>
          <li><span className="font-semibold">体調不良の場合：</span>急な体調不良の場合は正直に電話で伝えましょう。誠実に対応すればキャンセル料を減額してもらえることもあります。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          トラブルを防ぐためのポイント
        </h2>
        <div className="bg-pink-50 rounded-lg p-4">
          <h3 className="font-bold text-pink-700 mb-2">事前の確認が最大の対策</h3>
          <p className="mb-2">
            チェンジやキャンセルのトラブルを避けるためには、予約前の情報収集が不可欠です。
            パネマジ掲示板で実際の口コミを確認し、キャストの写真と実物の一致度をチェックしておきましょう。
            口コミで「写真通り」と評価されているキャストを指名すれば、チェンジの必要性は大幅に減ります。
          </p>
          <p>
            また、予約時に店舗のチェンジ・キャンセルポリシーを必ず確認しておくことが大切です。
            「チェンジ無料」「キャンセル料なし」と謳いつつ交通費は別途請求されるケースもあるため、
            細かい条件まで把握しておくと安心です。
          </p>
        </div>
      </section>
    </ArticleLayout>
  );
}
