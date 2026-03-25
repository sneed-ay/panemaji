import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "初めてのメンエス完全ガイド｜流れ・マナー・店選びのコツ",
  description:
    "メンズエステ初心者向けの完全ガイド。施術の流れ、セラピストの選び方、パネマジの実態、料金相場まで徹底解説します。",
  keywords: [
    "メンエス 初めて",
    "メンズエステ 初心者",
    "メンエス 流れ",
    "メンエス マナー",
    "メンズエステ 選び方",
  ],
  alternates: { canonical: "https://panemaji.com/guide/hajimete-menesu" },
  openGraph: {
    title: "初めてのメンエス完全ガイド｜流れ・マナー・店選びのコツ",
    description:
      "メンズエステ初心者向けの完全ガイド。施術の流れからパネマジの実態まで解説。",
    type: "article",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/hajimete-menesu",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "初めてのメンエス完全ガイド｜流れ・マナー・店選びのコツ",
  description:
    "メンズエステ初心者向けの完全ガイド。施術の流れからパネマジの実態まで解説。",
  author: { "@type": "Organization", name: "パネマジ掲示板" },
  publisher: { "@type": "Organization", name: "パネマジ掲示板" },
  datePublished: "2026-03-26",
  dateModified: "2026-03-26",
  mainEntityOfPage: "https://panemaji.com/guide/hajimete-menesu",
};

export default function HajiMeteMenesuPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleLayout
        title="初めてのメンエス完全ガイド"
        subtitle="流れ・マナー・店選びのコツを徹底解説"
        breadcrumb="初めてのメンエス"
        ctaHref="/"
        ctaLabel="パネマジ掲示板でメンエスの口コミをチェック →"
        relatedLinks={[
          { href: "/guide/menesu-vs-esthe", label: "メンエスとエステの違い" },
          { href: "/guide/gotanda-menesu", label: "五反田メンエス激戦区の歩き方" },
          { href: "/guide/kuchikomi-shinjitsu", label: "風俗口コミの真実｜サクラの見分け方" },
          { href: "/guide/fuzoku-ryoukin-souba", label: "風俗の料金相場まとめ" },
        ]}
      >
        {/* 目次 */}
        <nav className="bg-gray-50 rounded-lg p-4 sm:p-5">
          <h2 className="font-bold text-gray-800 mb-2">目次</h2>
          <ul className="space-y-1 text-sm text-pink-600">
            <li><a href="#what" className="hover:underline">1. メンエスとは？基本を理解しよう</a></li>
            <li><a href="#flow" className="hover:underline">2. メンエスの施術の流れ</a></li>
            <li><a href="#choose" className="hover:underline">3. 初心者のための店選び・セラピスト選び</a></li>
            <li><a href="#panemaji" className="hover:underline">4. メンエスのパネマジ事情</a></li>
            <li><a href="#manner" className="hover:underline">5. 知っておくべきマナーとNG行為</a></li>
          </ul>
        </nav>

        <section id="what">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            メンエスとは？基本を理解しよう
          </h2>
          <p className="mb-3">
            メンエス（メンズエステ）とは、男性向けのリラクゼーションマッサージサービスです。
            女性セラピストによるオイルマッサージが中心で、
            一般的なリラクゼーションサロンとは異なる独自のサービス形態を持っています。
          </p>
          <p className="mb-3">
            店舗型とルーム型の2種類があり、店舗型は専用のマッサージルームを複数持つ店舗形態、
            ルーム型はマンションの一室で営業する小規模な形態です。
            初心者には、受付スタッフがいて安心感のある店舗型がおすすめです。
          </p>
          <p>
            料金相場は60分で10,000〜18,000円程度が一般的です。
            エリアや店舗のランクによって幅がありますが、
            デリヘルに比べるとやや手頃な価格帯となっています。
          </p>
        </section>

        <section id="flow">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            メンエスの施術の流れ
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div>
                <h3 className="font-bold mb-1">予約・来店</h3>
                <p>
                  電話やWebで予約し、指定された時間に来店します。
                  受付でコースの確認と料金の支払いを済ませます。
                  初めての場合はアンケートシートへの記入を求められることもあります。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div>
                <h3 className="font-bold mb-1">シャワー・着替え</h3>
                <p>
                  個室に案内された後、シャワーを浴びて紙パンツに着替えます。
                  タオルやアメニティは用意されているのが一般的です。
                  清潔な状態で施術を受けることが基本マナーです。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <div>
                <h3 className="font-bold mb-1">オイルマッサージ</h3>
                <p>
                  セラピストがオイルを使った全身マッサージを行います。
                  うつ伏せから始まり、仰向けへと体位が変わるのが一般的な流れです。
                  施術時間はコースによって60分〜120分程度です。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
              <div>
                <h3 className="font-bold mb-1">アフターシャワー・退店</h3>
                <p>
                  施術後にシャワーを浴びてオイルを流し、着替えて退店します。
                  気に入ったセラピストがいれば、次回の予約を取ることもできます。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="choose">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            初心者のための店選び・セラピスト選び
          </h2>
          <p className="mb-3">
            メンエス初心者が失敗しないためのポイントを紹介します。
          </p>
          <div className="space-y-4">
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">口コミ評価の高い店舗を選ぶ</h3>
              <p>
                メンエスは店舗によってサービスの質に大きな差があります。
                口コミサイトやパネマジ掲示板で評判の良い店舗を選ぶことが最も確実です。
                特に「施術が丁寧」「接客が良い」という口コミが多い店舗は初心者にも安心です。
              </p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">セラピストのプロフィールを確認</h3>
              <p>
                経験年数やお客様からの評価、得意な施術などを確認しましょう。
                新人セラピストはフレッシュな対応が魅力ですが、
                技術面では経験者の方が安定しています。
                初めての方は中堅以上のセラピストを選ぶのが無難です。
              </p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">写メ日記をチェック</h3>
              <p>
                多くのメンエスではセラピストが写メ日記を更新しています。
                パネル写真だけでなく、日常的な写真も確認することで、
                実際のルックスに近いイメージをつかめます。
                加工が少ない自然な写真が多いセラピストは信頼度が高い傾向にあります。
              </p>
            </div>
          </div>
        </section>

        <section id="panemaji">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            メンエスのパネマジ事情
          </h2>
          <p className="mb-3">
            メンエスにもパネマジは存在します。
            デリヘルと比較すると、メンエスのパネマジにはいくつかの特徴があります。
          </p>
          <ul className="space-y-3 list-disc list-inside">
            <li>
              <span className="font-semibold">顔出しが少ないため判断しにくい：</span>
              メンエスでは顔の一部を隠した写真が多く、全体像がつかみにくいのが特徴です。
              口元だけ、目元だけといった写真では、実際のイメージとのギャップが生じやすくなります。
            </li>
            <li>
              <span className="font-semibold">体型の加工が多い傾向：</span>
              メンエスではスタイルが重視されるため、体型の加工が目立つ場合があります。
              特にウエストや脚のラインの加工には注意が必要です。
            </li>
            <li>
              <span className="font-semibold">デリヘルよりは実物に近い傾向：</span>
              メンエスは技術力も評価対象となるため、ルックスだけで集客する必要性が
              デリヘルよりも低い傾向にあります。
              そのため、全体的にはデリヘルよりもパネマジの程度は軽い傾向にあります。
            </li>
          </ul>
        </section>

        <section id="manner">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            知っておくべきマナーとNG行為
          </h2>
          <div className="bg-blue-50 rounded-lg p-4">
            <ul className="space-y-2 list-disc list-inside text-blue-800">
              <li>施術前のシャワーは必ず行いましょう。清潔さは最低限のマナーです</li>
              <li>セラピストへのボディタッチは基本的にNGです。店舗ルールに従いましょう</li>
              <li>性的サービスの要求は絶対にしないでください。メンエスはあくまでリラクゼーションです</li>
              <li>時間厳守で来店しましょう。遅刻は施術時間の短縮につながります</li>
              <li>気に入ったセラピストにはリピートの予約を。安定したサービスが受けられます</li>
              <li>施術後はパネマジ掲示板で口コミ投稿をして、他の利用者の参考にしましょう</li>
            </ul>
          </div>
        </section>
      </ArticleLayout>
    </>
  );
}
