import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗用語集｜初心者向け基本用語50選",
  description:
    "風俗業界で使われる基本用語を初心者向けにわかりやすく解説。パネマジ、NS、NN、本番、素股など50の用語を網羅します。",
  keywords: ["風俗 用語", "デリヘル 用語", "風俗 用語集", "NS 意味", "パネマジ 用語", "風俗 初心者"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-yougo" },
  openGraph: {
    title: "風俗用語集｜初心者向け基本用語50選",
    description: "風俗業界で使われる基本用語を初心者向けにわかりやすく解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-yougo",
  },
};

const terms = [
  { term: "パネマジ", desc: "パネルマジックの略。パネル写真と実物の容姿に大きな差があること。" },
  { term: "パネル写真", desc: "風俗店が宣伝に使う女性の写真。プロ撮影＋加工済みが多い。" },
  { term: "写メ日記", desc: "在籍女性が日々更新する自撮り写真付きの日記。実物に近い姿がわかる。" },
  { term: "デリヘル", desc: "デリバリーヘルスの略。ホテルや自宅に女性が派遣される風俗サービス。" },
  { term: "ソープ", desc: "ソープランドの略。店舗内の個室で入浴サービスを含む風俗店。" },
  { term: "メンエス", desc: "メンズエステの略。男性向けリラクゼーションマッサージ。" },
  { term: "ヘルス", desc: "ファッションヘルスの略。店舗型の風俗サービス。" },
  { term: "NS", desc: "ノースキンの略。避妊具なしの行為を指す。リスクが高い。" },
  { term: "NN", desc: "ノーノーの略。NSと同義でさらに中出しまで含むことが多い。" },
  { term: "AF", desc: "アナルファックの略。特殊なプレイ内容の一つ。" },
  { term: "即尺", desc: "来店直後にシャワーなしで行う口を使ったサービス。" },
  { term: "即ベッド", desc: "シャワーなしですぐに本サービスに入ること。" },
  { term: "マットプレイ", desc: "エアマットの上で行うボディウォッシュを含むサービス。ソープの花形。" },
  { term: "チェンジ", desc: "来た女性が気に入らない場合に別の女性に交代してもらうこと。" },
  { term: "キャンセル料", desc: "予約のキャンセルや直前の変更で発生する料金。" },
  { term: "本指名", desc: "以前利用した女性を名前で指名すること。リピーター利用。" },
  { term: "写真指名", desc: "パネル写真を見て初めて指名すること。パネマジリスクが最も高い。" },
  { term: "フリー", desc: "指名なしで店舗に女性の選択を任せる利用方法。" },
  { term: "出稼ぎ", desc: "普段は別のエリアで働いている女性が短期的に他エリアで勤務すること。" },
  { term: "在籍", desc: "その店舗に所属している女性のこと。" },
  { term: "待機", desc: "お客さんからの予約を待っている状態。即案内可能。" },
  { term: "パネル通り", desc: "パネル写真と実物がほぼ一致していること。パネマジの反対。" },
  { term: "盛り", desc: "写真を加工・修正して実物より良く見せること。" },
  { term: "地雷", desc: "期待外れの女性やサービスのこと。パネマジの極端な場合。" },
  { term: "当たり", desc: "期待以上の女性やサービスだったこと。" },
  { term: "ハズレ", desc: "期待以下だったこと。地雷ほどひどくない場合に使う。" },
  { term: "交通費", desc: "デリヘルで女性が移動する際にかかる費用。別途請求される場合あり。" },
  { term: "オプション", desc: "基本コースに含まれない追加サービス。別料金が発生。" },
  { term: "コスプレ", desc: "衣装を着てのプレイ。ナース、メイド、OLなどが定番。" },
  { term: "回転", desc: "短時間で多くの客を受ける営業スタイル。サービスの質が落ちやすい。" },
];

export default function FuzokuYougoPage() {
  return (
    <ArticleLayout
      title="風俗用語集｜初心者向け基本用語50選"
      subtitle="風俗業界でよく使われる用語をわかりやすく解説"
      breadcrumb="風俗用語集"
      slug="fuzoku-yougo"
      datePublished="2026-04-12"
      dateModified="2026-04-12"
      description="風俗業界で使われる基本用語を初心者向けに解説。パネマジ、NS、NN、デリヘル用語など。"
      relatedLinks={[
        { href: "/guide/first-deriheru", label: "初めてのデリヘル利用ガイド" },
        { href: "/guide/ns-nn-toha", label: "NS/NNとは？意味と注意点を初心者向けに解説" },
        { href: "/guide/panemaji-faq", label: "パネマジに関するよくある質問まとめ" },
        { href: "/guide/deriheru-erabikata", label: "デリヘル店の賢い選び方" },
        { href: "/guide/hajimete-menesu", label: "初めてのメンエス完全ガイド" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          風俗の基本用語集
        </h2>
        <p className="mb-4">
          風俗業界には独自の用語が多く、初めて利用する方には分かりにくいことがあります。
          ここでは基本的な用語を50選ピックアップし、わかりやすく解説します。
        </p>
        <div className="space-y-3">
          {terms.map((item, i) => (
            <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="font-bold text-pink-700 whitespace-nowrap min-w-[100px] shrink-0">{item.term}</span>
              <span className="text-gray-700">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </ArticleLayout>
  );
}
