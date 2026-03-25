import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "メンズエステの施術の流れ完全解説｜入店から退店まで",
  description:
    "メンエス（メンズエステ）の施術の流れを入店から退店まで完全解説。予約方法、受付の流れ、施術内容、マナー、チップ事情まで初心者にもわかりやすく紹介します。",
  keywords: [
    "メンエス 流れ",
    "メンズエステ 流れ",
    "メンエス 施術 流れ",
    "メンズエステ 入店",
    "メンエス 初めて 流れ",
    "メンエス マナー",
    "メンエス チップ",
  ],
  alternates: { canonical: "https://panemaji.com/guide/menesu-nagare" },
  openGraph: {
    title: "メンズエステの施術の流れ完全解説｜入店から退店まで",
    description:
      "メンエスの施術の流れを入店から退店まで完全解説。予約・受付・施術・マナーまで網羅。",
    type: "article",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/menesu-nagare",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "メンズエステの施術の流れ完全解説｜入店から退店まで",
  description:
    "メンエスの施術の流れを入店から退店まで完全解説。予約・受付・施術・マナーまで網羅。",
  author: { "@type": "Organization", name: "パネマジ掲示板" },
  publisher: { "@type": "Organization", name: "パネマジ掲示板" },
  datePublished: "2026-03-26",
  dateModified: "2026-03-26",
  mainEntityOfPage: "https://panemaji.com/guide/menesu-nagare",
};

export default function MenesuNagarePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleLayout
        title="メンズエステの施術の流れ完全解説"
        subtitle="入店から退店まで、初心者でも安心のステップガイド"
        breadcrumb="メンエスの施術の流れ"
        ctaHref="/"
        ctaLabel="パネマジ掲示板でメンエスの口コミをチェック →"
        relatedLinks={[
          { href: "/guide/menesu-kiwadoi", label: "メンエスの際どいサービスとNG行為" },
          { href: "/guide/menesu-erabikata", label: "失敗しないメンエスの選び方" },
          { href: "/guide/menesu-ryoukin-souba", label: "メンエスの料金相場まとめ" },
          { href: "/guide/hajimete-menesu", label: "初めてのメンエス完全ガイド" },
        ]}
      >
        {/* 目次 */}
        <nav className="bg-gray-50 rounded-lg p-4 sm:p-5">
          <h2 className="font-bold text-gray-800 mb-2">目次</h2>
          <ul className="space-y-1 text-sm text-pink-600">
            <li><a href="#reservation" className="hover:underline">1. 予約方法と事前準備</a></li>
            <li><a href="#arrival" className="hover:underline">2. 入店から受付までの流れ</a></li>
            <li><a href="#treatment" className="hover:underline">3. 施術の流れ（シャワー〜オイルマッサージ）</a></li>
            <li><a href="#after" className="hover:underline">4. 施術後〜退店までの流れ</a></li>
            <li><a href="#manner" className="hover:underline">5. 知っておくべきマナーとチップ事情</a></li>
          </ul>
        </nav>

        <section id="reservation">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            予約方法と事前準備
          </h2>
          <p className="mb-3">
            メンズエステの利用は、まず予約から始まります。
            予約方法は大きく分けて3つあり、それぞれにメリットがあります。
          </p>
          <div className="space-y-4">
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">電話予約</h3>
              <p>
                最も確実な予約方法です。セラピストの空き状況をリアルタイムで確認でき、
                希望のコースや時間の相談もスムーズに行えます。
                初めての場合は「初めての利用です」と伝えると、丁寧に説明してもらえるケースが多いです。
                混雑時間帯（金曜夜・土曜日）は早めの予約がおすすめです。
              </p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">Web予約・LINE予約</h3>
              <p>
                近年はWeb予約フォームやLINE公式アカウントからの予約に対応する店舗が増えています。
                電話が苦手な方や、深夜に予約したい場合に便利です。
                ただし返信に時間がかかることもあるため、当日の直前予約は電話が確実です。
                LINE予約の場合、クーポンが配信されることもあるのでフォローしておくとお得です。
              </p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">飛び込み（予約なし）</h3>
              <p>
                一部の店舗では予約なしの飛び込みも可能ですが、
                希望のセラピストが空いていない場合も多く、基本的には事前予約を推奨します。
                特に人気セラピストは数日前から予約が埋まることもあるため、
                お気に入りのセラピストがいる場合は早めの予約を心がけましょう。
              </p>
            </div>
          </div>
        </section>

        <section id="arrival">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            入店から受付までの流れ
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div>
                <h3 className="font-bold mb-1">店舗に到着・入店</h3>
                <p>
                  予約時間の5分前を目安に到着しましょう。
                  店舗型の場合は受付カウンターがあり、スタッフが対応してくれます。
                  ルーム型（マンション型）の場合は、事前に伝えられた部屋番号のインターホンを押します。
                  初めての店舗は場所がわかりにくいこともあるため、少し余裕を持って出発するのがおすすめです。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div>
                <h3 className="font-bold mb-1">受付・料金の支払い</h3>
                <p>
                  受付でコースの確認と料金の支払いを行います。
                  支払いは前払いが基本で、現金のみの店舗が多い傾向にありますが、
                  最近はクレジットカードや電子マネーに対応する店舗も増えています。
                  初回利用時はアンケートシート（簡単な問診表）への記入を求められることがあります。
                  身体の気になる部位や、マッサージの強さの好みなどを記入します。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <div>
                <h3 className="font-bold mb-1">個室への案内</h3>
                <p>
                  受付後、施術を行う個室に案内されます。
                  店舗型では専用の施術ルームが用意されており、
                  シャワールームやアメニティが完備されています。
                  セラピストが来るまでの間にシャワーを浴びて準備をしましょう。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="treatment">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            施術の流れ（シャワー〜オイルマッサージ）
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div>
                <h3 className="font-bold mb-1">シャワー・着替え</h3>
                <p>
                  個室に入ったら、まずシャワーを浴びます。
                  ボディーソープやシャンプーは用意されているのが一般的です。
                  シャワー後は用意された紙パンツ（ペーパーショーツ）に着替えます。
                  清潔な状態で施術を受けることは最低限のマナーであり、
                  セラピストへの配慮としても非常に重要です。
                  シャワーの時間は施術時間に含まれる場合と含まれない場合があるので、
                  事前に確認しておくと安心です。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div>
                <h3 className="font-bold mb-1">セラピスト入室・カウンセリング</h3>
                <p>
                  シャワーを済ませた後、セラピストが入室します。
                  簡単な挨拶と自己紹介の後、体の状態や施術の好みについてヒアリングが行われます。
                  肩こりがひどい、腰が痛いなど気になる箇所があれば遠慮なく伝えましょう。
                  オイルの量やマッサージの強さの好みも伝えると、より満足度の高い施術が受けられます。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <div>
                <h3 className="font-bold mb-1">オイルマッサージ（うつ伏せ）</h3>
                <p>
                  施術はうつ伏せの状態からスタートするのが一般的です。
                  セラピストがアロマオイルを使って、背中・肩・腰・足を中心にマッサージを行います。
                  ストロークの長い全身を使ったマッサージが特徴で、
                  一般的なリラクゼーションサロンとは異なる密着感のある施術が魅力です。
                  施術中は力加減のフィードバックをこまめに伝えると、
                  セラピストも対応しやすくなります。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
              <div>
                <h3 className="font-bold mb-1">オイルマッサージ（仰向け）</h3>
                <p>
                  施術の後半では仰向けの体勢になります。
                  デコルテ（首回り・鎖骨周辺）、腕、胸部、脚のマッサージが行われます。
                  仰向けの施術はメンエスの醍醐味とも言える部分で、
                  セラピストの技術力が最も発揮される場面です。
                  施術時間はコースによって異なりますが、
                  60分コースの場合は全体で50分程度の施術が目安となります。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="after">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            施術後〜退店までの流れ
          </h2>
          <p className="mb-3">
            施術が終わった後の流れもスムーズに進めるために把握しておきましょう。
          </p>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div>
                <h3 className="font-bold mb-1">アフターシャワー</h3>
                <p>
                  施術後はシャワーでオイルを洗い流します。
                  タオルやアメニティは用意されているので、手ぶらで利用できます。
                  ドライヤーや基礎化粧品を置いている店舗も多いため、
                  仕事帰りの利用でも身だしなみを整えて退店できます。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div>
                <h3 className="font-bold mb-1">お見送り・次回予約</h3>
                <p>
                  着替えが終わったらセラピストにお礼を伝えて退室します。
                  気に入ったセラピストがいれば、この段階で次回の予約を取ることができます。
                  人気セラピストは予約が取りにくくなるため、
                  その場で次回予約を入れるのがスマートです。
                  店舗によっては次回予約割引があることもあります。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="manner">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            知っておくべきマナーとチップ事情
          </h2>
          <p className="mb-3">
            メンエスを気持ちよく利用するために、基本的なマナーを押さえておきましょう。
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-blue-800 mb-2">基本マナー</h3>
            <ul className="space-y-2 list-disc list-inside text-blue-800">
              <li>施術前のシャワーは必ず行い、清潔な状態で施術を受けましょう</li>
              <li>予約時間には5分前を目安に到着。遅刻は施術時間の短縮につながります</li>
              <li>セラピストへの過度なボディタッチは厳禁。店舗ルールを必ず守りましょう</li>
              <li>性的サービスの要求は絶対にNG。メンエスはリラクゼーションサービスです</li>
              <li>施術中の撮影や録音は禁止です</li>
              <li>酔った状態での来店はマナー違反。次回以降の利用を断られる場合もあります</li>
            </ul>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="font-bold text-yellow-800 mb-2">チップ事情</h3>
            <p className="text-yellow-800 mb-2">
              メンエスでのチップは基本的に不要です。
              コース料金に全てのサービスが含まれているため、追加料金を払う必要はありません。
            </p>
            <p className="text-yellow-800">
              ただし、特に満足度が高かった場合や、常連として感謝を伝えたい場合に
              任意でチップを渡す人もいます。
              金額の相場は1,000円〜3,000円程度で、渡す場合は封筒に入れてさりげなく渡すのがスマートです。
              チップの有無でサービスが変わることは基本的にありませんが、
              セラピストのモチベーション向上にはつながるでしょう。
            </p>
          </div>
        </section>
      </ArticleLayout>
    </>
  );
}
