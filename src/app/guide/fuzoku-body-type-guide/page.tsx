import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗の体型表記ガイド｜スリーサイズの見方と実態",
  description: "風俗の体型表記とスリーサイズの見方を徹底解説。プロフィールの体型情報の読み解き方、サバ読みの傾向、実態との乖離を紹介します。",
  keywords: ["風俗 スリーサイズ", "風俗 体型", "デリヘル スリーサイズ", "風俗 サイズ 嘘", "風俗 体型表記"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-body-type-guide" },
  openGraph: {
    title: "風俗の体型表記ガイド｜スリーサイズの見方と実態",
    description: "風俗の体型表記とスリーサイズの見方を徹底解説。実態との乖離。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-body-type-guide",
  },
};

export default function FuzokuBodyTypeGuidePage() {
  return (
    <ArticleLayout
      title="風俗の体型表記ガイド"
      subtitle="スリーサイズの見方と実態を徹底解説"
      breadcrumb="体型表記ガイド"
      slug="fuzoku-body-type-guide"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗の体型表記とスリーサイズの見方を徹底解説。実態との乖離。"
      relatedLinks={[
        { href: "/guide/panel-photo-mitiwake", label: "パネル写真の見分け方" },
        { href: "/guide/panemaji-taisaku", label: "パネマジ対策の完全ガイド" },
        { href: "/guide/fuzoku-mature-guide", label: "人妻・熟女デリヘルガイド" },
        { href: "/guide/deriheru-erabikata", label: "デリヘル店の賢い選び方" },
        { href: "/guide/kuchikomi-katsuyou", label: "口コミ活用術" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          風俗のスリーサイズ表記について
        </h2>
        <p className="mb-3">
          風俗店のキャストプロフィールには身長、スリーサイズ（バスト・ウエスト・ヒップ）、
          カップサイズが記載されているのが一般的です。
          しかし、これらの数値は自己申告に基づいていることが多く、
          実際の体型とは乖離があることが珍しくありません。
        </p>
        <p>
          スリーサイズを鵜呑みにせず、他の情報と合わせて
          総合的に判断することが重要です。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          サバ読みの傾向
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">バスト・カップサイズ</h3>
            <p>
              最もサバ読みが多い項目です。1〜2カップ上乗せして表記するケースが非常に多く、
              「Eカップ」表記で実際はCカップということもあります。
              補正下着やパッドの使用でパネル写真では大きく見せている場合もあるため、
              カップサイズだけを基準にキャストを選ぶのはリスクが高いです。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">ウエスト</h3>
            <p>
              ウエストも細めに申告される傾向があります。
              表記で58cmの場合、実際は62〜65cm程度であることが多いです。
              ウエストが55cm以下の表記は特に疑わしいと考えてよいでしょう。
              全身写真でのウエストラインを参考にするのが現実的です。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">身長・体重</h3>
            <p>
              身長はヒールを履いた状態の数値が記載されているケースがあり、
              2〜5cm程度サバ読みされることがあります。
              体重の記載がある場合は比較的信頼できますが、
              体重を公開していないキャストが大半です。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          実物の体型を見極める方法
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">口コミの体型評価：</span>口コミに「スリム」「ぽっちゃり」「写真通り」などの体型に関する記載があれば参考になります。複数の口コミで一致した評価があれば信頼度が高いです。</li>
          <li><span className="font-semibold">全身写真の確認：</span>顔写真だけでなく全身写真を必ず確認しましょう。腕や脚の太さ、ウエストラインなどが体型を把握する手がかりになります。</li>
          <li><span className="font-semibold">動画コンテンツ：</span>SNSや写メ日記に動画がある場合は最も参考になります。動画では体型の加工が難しいため、実物に近い情報が得られます。</li>
          <li><span className="font-semibold">複数の写真を比較：</span>パネル写真1枚だけでなく、異なる日時に撮影された複数の写真を比較しましょう。一貫した体型であれば信頼度が高まります。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          体型表記との付き合い方
        </h2>
        <div className="bg-pink-50 rounded-lg p-4">
          <h3 className="font-bold text-pink-700 mb-2">数値に振り回されないコツ</h3>
          <p className="mb-2">
            スリーサイズの数値はあくまで参考程度に捉えるのが正解です。
            同じ「B86 W58 H85」でも、骨格や体脂肪率、筋肉量によって
            見た目の印象は大きく異なります。
          </p>
          <p>
            数値よりも写真の全体的な印象、口コミでの体型評価、
            動画での雰囲気を総合的に判断する方が実態に近い情報が得られます。
            特にパネマジ掲示板の口コミは体型に関する率直な評価が多いため活用しましょう。
          </p>
        </div>
      </section>
    </ArticleLayout>
  );
}
