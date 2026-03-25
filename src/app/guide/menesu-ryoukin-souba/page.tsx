import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "メンエスの料金相場まとめ｜コース別・エリア別の価格帯",
  description:
    "メンズエステの料金相場をコース別・エリア別に徹底解説。60分/90分/120分の価格帯、指名料、オプション料金、エリアによる違いを詳しく紹介します。",
  keywords: [
    "メンエス 料金",
    "メンエス 相場",
    "メンズエステ 料金",
    "メンズエステ 相場",
    "メンエス 値段",
    "メンエス 60分 料金",
    "メンエス オプション 料金",
    "メンエス 指名料",
  ],
  alternates: { canonical: "https://panemaji.com/guide/menesu-ryoukin-souba" },
  openGraph: {
    title: "メンエスの料金相場まとめ｜コース別・エリア別の価格帯",
    description:
      "メンエスの料金相場をコース別・エリア別に解説。指名料・オプション料金も網羅。",
    type: "article",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/menesu-ryoukin-souba",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "メンエスの料金相場まとめ｜コース別・エリア別の価格帯",
  description:
    "メンエスの料金相場をコース別・エリア別に解説。指名料・オプション料金も網羅。",
  author: { "@type": "Organization", name: "パネマジ掲示板" },
  publisher: { "@type": "Organization", name: "パネマジ掲示板" },
  datePublished: "2026-03-26",
  dateModified: "2026-03-26",
  mainEntityOfPage: "https://panemaji.com/guide/menesu-ryoukin-souba",
};

export default function MenesuRyoukinSoubaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleLayout
        title="メンエスの料金相場まとめ"
        subtitle="コース別・エリア別の価格帯を徹底比較"
        breadcrumb="メンエスの料金相場"
        ctaHref="/"
        ctaLabel="パネマジ掲示板でメンエスの口コミをチェック →"
        relatedLinks={[
          { href: "/guide/menesu-erabikata", label: "失敗しないメンエスの選び方" },
          { href: "/guide/menesu-nagare", label: "メンエスの施術の流れ完全解説" },
          { href: "/guide/fuzoku-ryoukin-souba", label: "風俗の料金相場まとめ（業態別）" },
          { href: "/guide/menesu-panemaji", label: "メンエスのパネマジ事情" },
        ]}
      >
        {/* 目次 */}
        <nav className="bg-gray-50 rounded-lg p-4 sm:p-5">
          <h2 className="font-bold text-gray-800 mb-2">目次</h2>
          <ul className="space-y-1 text-sm text-pink-600">
            <li><a href="#course" className="hover:underline">1. コース別の料金相場（60分/90分/120分）</a></li>
            <li><a href="#area" className="hover:underline">2. エリア別の料金比較</a></li>
            <li><a href="#option" className="hover:underline">3. 指名料・オプション料金の内訳</a></li>
            <li><a href="#cospa" className="hover:underline">4. コスパの良い利用方法</a></li>
            <li><a href="#caution" className="hover:underline">5. 料金に関する注意点</a></li>
          </ul>
        </nav>

        <section id="course">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            コース別の料金相場（60分/90分/120分）
          </h2>
          <p className="mb-3">
            メンエスのコース料金は施術時間によって決まります。
            以下は都内主要エリアの平均的な相場です。
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-pink-50">
                  <th className="border border-pink-200 px-3 py-2 text-left">コース</th>
                  <th className="border border-pink-200 px-3 py-2 text-left">相場（都内平均）</th>
                  <th className="border border-pink-200 px-3 py-2 text-left">おすすめ度</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-pink-200 px-3 py-2 font-medium">60分</td>
                  <td className="border border-pink-200 px-3 py-2">10,000〜18,000円</td>
                  <td className="border border-pink-200 px-3 py-2">初回お試しに最適</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-pink-200 px-3 py-2 font-medium">90分</td>
                  <td className="border border-pink-200 px-3 py-2">14,000〜25,000円</td>
                  <td className="border border-pink-200 px-3 py-2">最もコスパが良い</td>
                </tr>
                <tr>
                  <td className="border border-pink-200 px-3 py-2 font-medium">120分</td>
                  <td className="border border-pink-200 px-3 py-2">18,000〜35,000円</td>
                  <td className="border border-pink-200 px-3 py-2">じっくり楽しみたい方向け</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-pink-200 px-3 py-2 font-medium">150分以上</td>
                  <td className="border border-pink-200 px-3 py-2">25,000〜50,000円</td>
                  <td className="border border-pink-200 px-3 py-2">特別な日・リピーター向け</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-blue-800 font-medium mb-1">コース選びのポイント</p>
            <p className="text-blue-800">
              初回利用なら60分コースでお試し、気に入ったら次回は90分コースがおすすめです。
              90分コースは施術時間に余裕があり、セラピストとのコミュニケーションも取れるため
              最も満足度が高くなりやすいコースです。
              シャワーの時間がコース時間に含まれるかどうかで実質的な施術時間が変わるため、
              予約時に確認しておきましょう。
            </p>
          </div>
        </section>

        <section id="area">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            エリア別の料金比較
          </h2>
          <p className="mb-3">
            メンエスの料金はエリアによって大きく異なります。
            同じ60分コースでもエリアによって数千円の差があります。
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-pink-50">
                  <th className="border border-pink-200 px-3 py-2 text-left">エリア</th>
                  <th className="border border-pink-200 px-3 py-2 text-left">60分相場</th>
                  <th className="border border-pink-200 px-3 py-2 text-left">特徴</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-pink-200 px-3 py-2 font-medium">銀座</td>
                  <td className="border border-pink-200 px-3 py-2">15,000〜25,000円</td>
                  <td className="border border-pink-200 px-3 py-2">最高級エリア</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-pink-200 px-3 py-2 font-medium">新宿</td>
                  <td className="border border-pink-200 px-3 py-2">10,000〜16,000円</td>
                  <td className="border border-pink-200 px-3 py-2">選択肢が豊富</td>
                </tr>
                <tr>
                  <td className="border border-pink-200 px-3 py-2 font-medium">五反田</td>
                  <td className="border border-pink-200 px-3 py-2">10,000〜16,000円</td>
                  <td className="border border-pink-200 px-3 py-2">激戦区・競争価格</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-pink-200 px-3 py-2 font-medium">池袋</td>
                  <td className="border border-pink-200 px-3 py-2">9,000〜14,000円</td>
                  <td className="border border-pink-200 px-3 py-2">コスパ重視</td>
                </tr>
                <tr>
                  <td className="border border-pink-200 px-3 py-2 font-medium">新橋</td>
                  <td className="border border-pink-200 px-3 py-2">11,000〜16,000円</td>
                  <td className="border border-pink-200 px-3 py-2">ビジネスマン向け</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-pink-200 px-3 py-2 font-medium">大阪（梅田）</td>
                  <td className="border border-pink-200 px-3 py-2">8,000〜14,000円</td>
                  <td className="border border-pink-200 px-3 py-2">東京より安め</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            ※上記は一般的な店舗の目安です。高級店・人気セラピストの指名により大きく変動します。
          </p>
        </section>

        <section id="option">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            指名料・オプション料金の内訳
          </h2>
          <p className="mb-3">
            コース料金以外にかかる可能性のある費用を把握しておきましょう。
          </p>
          <div className="space-y-4">
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">指名料</h3>
              <p>
                特定のセラピストを指名する場合、1,000〜3,000円の指名料がかかるのが一般的です。
                本指名（リピート指名）の場合は1,000〜2,000円、
                写真指名（初回指名）の場合は2,000〜3,000円が相場です。
                人気セラピストや上位ランクのセラピストは指名料が高く設定されていることもあります。
                フリー（指名なし）なら指名料はかかりませんが、
                セラピストの選択は店舗に任せることになります。
              </p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">オプション料金</h3>
              <p className="mb-2">
                店舗によってさまざまなオプションが用意されています。
                代表的なオプションと料金の目安は以下の通りです。
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>ディープリンパ：1,000〜3,000円</li>
                <li>衣装チェンジ（コスプレ）：1,000〜2,000円</li>
                <li>延長（30分）：5,000〜10,000円</li>
                <li>アロマオイルのグレードアップ：500〜1,500円</li>
                <li>ホットストーン：2,000〜3,000円</li>
              </ul>
            </div>
            <div className="bg-pink-50 rounded-lg p-4">
              <h3 className="font-bold text-pink-700 mb-2">交通費（ルーム型の場合）</h3>
              <p>
                ルーム型店舗ではセラピストの出張が発生しないため、
                基本的に交通費はかかりません。
                ただし、出張メンエスの場合は出張先までの交通費が別途かかることがあります。
                出張料金は1,000〜3,000円が一般的です。
              </p>
            </div>
          </div>
        </section>

        <section id="cospa">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            コスパの良い利用方法
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div>
                <h3 className="font-bold mb-1">新規割引を活用する</h3>
                <p>
                  ほとんどのメンエスが初回利用者向けの割引を実施しています。
                  1,000〜3,000円の割引が一般的で、中には5,000円引きの店舗も。
                  複数の店舗を新規割引で試して、お気に入りを見つけるのが賢い方法です。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div>
                <h3 className="font-bold mb-1">平日昼間の割引を狙う</h3>
                <p>
                  平日の昼間は利用者が少ないため、
                  多くの店舗が「平日昼割」「早割」を実施しています。
                  2,000〜3,000円程度お得に利用できるケースが多いです。
                  スケジュールの融通が利く方は積極的に活用しましょう。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <div>
                <h3 className="font-bold mb-1">LINE公式のクーポンを活用</h3>
                <p>
                  店舗のLINE公式アカウントを友だち追加すると、
                  不定期でクーポンが配信されることがあります。
                  1,000〜2,000円割引のクーポンが多く、
                  定期的に利用する方にはお得です。
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
              <div>
                <h3 className="font-bold mb-1">90分コースを選ぶ</h3>
                <p>
                  1分あたりの単価で計算すると、90分コースが最もコスパが良い場合が多いです。
                  60分コースでは施術が駆け足になりがちですが、
                  90分なら余裕のある施術が受けられ、満足度も高くなります。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="caution">
          <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
            料金に関する注意点
          </h2>
          <div className="bg-red-50 rounded-lg p-4">
            <ul className="space-y-2 list-disc list-inside text-red-800">
              <li>
                <span className="font-semibold">支払い方法：</span>
                現金のみの店舗がまだ多いですが、最近はクレジットカードや電子マネー対応店も増加中です。事前に確認しておきましょう
              </li>
              <li>
                <span className="font-semibold">シャワー時間の扱い：</span>
                シャワー時間がコース時間に含まれる店舗と含まれない店舗があります。含まれる場合、実質の施術時間は10〜15分短くなります
              </li>
              <li>
                <span className="font-semibold">相場より極端に安い店舗：</span>
                60分で8,000円を大きく下回る店舗は、オプション営業が激しいか、サービスの質に問題がある可能性があります
              </li>
              <li>
                <span className="font-semibold">追加料金の確認：</span>
                入店後に想定外の追加料金を請求されるケースを避けるため、コース料金の総額を予約時に確認しましょう
              </li>
              <li>
                <span className="font-semibold">キャンセル料：</span>
                当日キャンセルや無断キャンセルはキャンセル料が発生する店舗がほとんどです。キャンセルポリシーを事前に確認しておきましょう
              </li>
            </ul>
          </div>
        </section>
      </ArticleLayout>
    </>
  );
}
