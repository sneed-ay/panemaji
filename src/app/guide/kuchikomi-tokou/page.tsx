import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "口コミ投稿のススメ｜みんなで作るパネマジデータベース",
  description:
    "パネマジ掲示板への口コミ投稿のメリットと方法を解説。あなたの一票が他の利用者の参考になります。",
  keywords: ["パネマジ 口コミ 投稿", "デリヘル 口コミ 書き方", "パネマジ掲示板 投票", "口コミ 投稿 方法"],
  alternates: { canonical: "https://panemaji.com/guide/kuchikomi-tokou" },
  openGraph: {
    title: "口コミ投稿のススメ｜みんなで作るパネマジデータベース",
    description: "パネマジ掲示板への口コミ投稿のメリットと方法を解説。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/kuchikomi-tokou",
  },
};

export default function KuchikomiTokouPage() {
  return (
    <ArticleLayout
      title="口コミ投稿のススメ"
      subtitle="みんなで作るパネマジデータベースに参加しよう"
      breadcrumb="口コミ投稿"
      ctaHref="/"
      ctaLabel="パネマジ掲示板で口コミを投稿する →"
      relatedLinks={[
        { href: "/guide/how-to-use", label: "パネマジ掲示板の使い方ガイド" },
        { href: "/guide/kuchikomi-katsuyou", label: "口コミの正しい読み方" },
        { href: "/guide/real-do-ranking", label: "リアル度ランキングの見方" },
        { href: "/guide/panemaji-taisaku", label: "パネマジ対策完全マニュアル" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          なぜ口コミ投稿が大切なのか
        </h2>
        <p className="mb-3">
          パネマジ掲示板は、利用者一人ひとりの口コミによって成り立っているサービスです。
          口コミが増えるほど情報の精度が上がり、みんなが安心して店舗選びができるようになります。
        </p>
        <p>
          あなたが口コミを投稿することで、次にその女性を指名しようとしている人の判断材料になります。
          「パネル通り」だった場合も「パネル詐欺」だった場合も、どちらの情報も等しく価値があります。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          口コミ投稿のメリット
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">他の利用者の役に立つ</h3>
            <p>
              あなたの一票が、他の利用者のパネマジ回避に役立ちます。
              特に口コミが少ない女性への投票は、情報の希少価値が高く、
              多くの利用者にとって貴重な判断材料となります。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">業界の健全化に貢献</h3>
            <p>
              口コミが増えることで、パネマジの度合いが高い店舗は淘汰され、
              写真の信頼性が高い店舗が正当に評価されるようになります。
              口コミの蓄積が、業界全体の透明性向上につながります。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">データベースの精度向上</h3>
            <p>
              口コミデータが増えるほど、パネル一致度の評価が正確になります。
              ランキングの信頼性も向上し、より使いやすいサービスに成長していきます。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          投稿方法はとてもかんたん
        </h2>
        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
            <div>
              <h3 className="font-bold mb-1">利用した女性のページにアクセス</h3>
              <p>パネマジ掲示板で利用した女性のページを開きます。店舗名や名前で検索できます。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
            <div>
              <h3 className="font-bold mb-1">3つのボタンから選んでタップ</h3>
              <p>「パネル通り」「許せる」「パネル詐欺」の中から、あなたの感想に合ったものを選ぶだけ。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
            <div>
              <h3 className="font-bold mb-1">投稿完了（数秒で終わります）</h3>
              <p>会員登録不要、完全匿名。面倒な文章入力もありません。ワンタップで投稿完了です。</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          投稿時のポイント
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li>
            <span className="font-semibold">正直な感想で投票する：</span>
            実際の印象を正直に投票することが、データベースの信頼性を保つために大切です。
          </li>
          <li>
            <span className="font-semibold">「パネル通り」も積極的に投票：</span>
            良い体験こそ共有しましょう。「パネル通り」の情報は、他の利用者にとって安心材料になります。
          </li>
          <li>
            <span className="font-semibold">リピート時も投票する：</span>
            同じ女性を再度利用した際も投票しましょう。パネル写真が更新されている場合もあるため、最新の評価が参考になります。
          </li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
