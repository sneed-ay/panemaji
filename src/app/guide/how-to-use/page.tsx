import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "パネマジ掲示板の使い方ガイド",
  description:
    "パネマジ掲示板の使い方を解説。女性の検索方法、口コミの見方・投稿方法、ランキングの活用法までわかりやすく紹介します。",
  keywords: [
    "パネマジ掲示板 使い方",
    "パネマジ 口コミ",
    "パネマジ ランキング",
    "デリヘル 口コミ 投稿",
    "パネル一致度",
  ],
  alternates: {
    canonical: "https://panemaji.com/guide/how-to-use",
  },
  openGraph: {
    title: "パネマジ掲示板の使い方ガイド",
    description:
      "パネマジ掲示板の使い方を解説。検索・口コミ・ランキングの活用法を紹介。",
    type: "article",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/how-to-use",
  },
};

export default function HowToUsePage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* パンくずリスト */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">使い方ガイド</span>
      </nav>

      <article className="bg-white rounded-lg shadow p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          パネマジ掲示板の使い方ガイド
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          検索・口コミ・ランキングの活用法をわかりやすく解説
        </p>

        <div className="space-y-10 text-gray-700 text-sm sm:text-base leading-relaxed">
          {/* パネマジ掲示板とは */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              パネマジ掲示板とは
            </h2>
            <p className="mb-3">
              パネマジ掲示板は、デリヘルをはじめとする風俗店のパネル写真と
              実物の一致度を口コミで共有するサイトです。
            </p>
            <p className="mb-3">
              全国46都道府県のデリヘル3,000店舗以上、14万人以上の女性情報を掲載しており、
              実際に利用した人の口コミをもとに、パネル写真の信頼性を確認できます。
            </p>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="font-semibold text-purple-800 mb-2">パネマジ掲示板の特徴</p>
              <ul className="space-y-1 list-disc list-inside text-purple-700">
                <li>会員登録不要で口コミの閲覧・投稿が可能</li>
                <li>ワンタップで投票できるかんたん操作</li>
                <li>完全匿名で安心して利用できる</li>
                <li>パネル一致度のランキング機能</li>
              </ul>
            </div>
          </section>

          {/* 女性の検索方法 */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              女性の検索方法
            </h2>
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h3 className="font-bold mb-1">都道府県を選ぶ</h3>
                  <p>
                    トップページに表示されている都道府県一覧から、探したいエリアを選択します。
                    エリア名で絞り込み検索もできます。
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h3 className="font-bold mb-1">店舗を選ぶ</h3>
                  <p>
                    都道府県を選ぶとエリア一覧が表示されます。
                    エリアを選ぶと、そのエリアの店舗一覧が表示されます。
                    口コミ数や在籍数も確認できます。
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h3 className="font-bold mb-1">女性を選ぶ</h3>
                  <p>
                    店舗ページでは在籍している女性の一覧が表示されます。
                    パネル写真と一緒に口コミ数やパネル一致度の評価が確認できるので、
                    気になる女性をタップして詳細を見ましょう。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 口コミの見方 */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              口コミの見方
            </h2>
            <p className="mb-4">
              パネマジ掲示板では、パネル写真と実物の一致度を3段階で評価しています。
            </p>

            <div className="space-y-3">
              <div className="border rounded-lg p-4 border-green-200 bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">😊</span>
                  <span className="font-bold text-green-700 text-lg">パネル通り</span>
                </div>
                <p className="text-green-800">
                  パネル写真と実物がほぼ一致している状態。
                  写真を見て期待した通り、またはそれ以上だったという評価です。
                  この評価が多い女性は安心して指名できます。
                </p>
              </div>

              <div className="border rounded-lg p-4 border-yellow-200 bg-yellow-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">😐</span>
                  <span className="font-bold text-yellow-700 text-lg">許せる</span>
                </div>
                <p className="text-yellow-800">
                  パネル写真と多少の差はあるものの、許容範囲内という評価です。
                  軽い加工や照明の違い程度で、大きなギャップはなかった状態を指します。
                </p>
              </div>

              <div className="border rounded-lg p-4 border-red-200 bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">😡</span>
                  <span className="font-bold text-red-700 text-lg">パネル詐欺</span>
                </div>
                <p className="text-red-800">
                  パネル写真と実物に大きな差があったという評価です。
                  体型や顔の印象が大きく異なるなど、期待を裏切られた場合につけられます。
                  この評価が多い場合は注意が必要です。
                </p>
              </div>
            </div>
          </section>

          {/* 口コミの投稿方法 */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              口コミの投稿方法（ワンタップ投票）
            </h2>
            <p className="mb-4">
              パネマジ掲示板では、面倒な文章入力なしでワンタップ投票ができます。
            </p>

            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h3 className="font-bold mb-1">女性の詳細ページを開く</h3>
                  <p>
                    口コミを投稿したい女性のページにアクセスします。
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h3 className="font-bold mb-1">投票ボタンをタップ</h3>
                  <p>
                    ページに表示されている「パネル通り」「許せる」「パネル詐欺」の
                    3つのボタンから、あなたの感想に合ったものをタップするだけで投票完了です。
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h3 className="font-bold mb-1">投票完了</h3>
                  <p>
                    会員登録不要、完全匿名で投票できます。
                    あなたの投票が反映され、他のユーザーの参考になります。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mt-4">
              <p className="text-blue-800 text-sm">
                <span className="font-bold">ポイント：</span>
                投票は同じ女性に対して何度でもできます。
                リピートした際にパネル写真が変わっていた場合も、その時の印象で投票してください。
              </p>
            </div>
          </section>

          {/* ランキングの見方 */}
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
              ランキングの見方
            </h2>
            <p className="mb-4">
              パネマジ掲示板では、口コミをもとにしたパネル一致度ランキングを公開しています。
            </p>
            <ul className="space-y-3 list-disc list-inside">
              <li>
                <span className="font-semibold">パネル一致度ランキング：</span>
                「パネル通り」の投票率が高い女性を上位に表示。
                口コミ数が一定以上ある女性のみがランキング対象です。
              </li>
              <li>
                <span className="font-semibold">都道府県別のランキング：</span>
                全国ランキングのほか、都道府県やエリアでの絞り込みも可能です。
              </li>
              <li>
                <span className="font-semibold">口コミ数も参考に：</span>
                パネル一致度が高くても、口コミ数が少ない場合は信頼性が低い可能性があります。
                なるべく口コミ数が多い女性を参考にしましょう。
              </li>
            </ul>
            <div className="mt-6 text-center">
              <a
                href="/ranking"
                className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
              >
                ランキングを見る →
              </a>
            </div>
          </section>

          {/* 関連ページリンク */}
          <section className="bg-gray-50 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3">関連ページ</h2>
            <ul className="space-y-2">
              <li>
                <a href="/guide/panemaji-checker" className="text-pink-600 hover:text-pink-800 hover:underline">
                  → パネマジの見分け方ガイド
                </a>
              </li>
              <li>
                <a href="/ranking" className="text-pink-600 hover:text-pink-800 hover:underline">
                  → パネル一致度ランキング
                </a>
              </li>
              <li>
                <a href="/" className="text-pink-600 hover:text-pink-800 hover:underline">
                  → トップページに戻る
                </a>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </div>
  );
}
