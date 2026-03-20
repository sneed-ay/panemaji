import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約",
  description: "パネマジ掲示板の利用規約です。当サイトをご利用いただく前に、必ずお読みください。",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* パンくずリスト */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">利用規約</span>
      </nav>

      <div className="bg-white rounded-lg shadow p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">利用規約</h1>
        <p className="text-sm text-gray-500 mb-8">最終更新日: 2026年3月21日</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第1条（サービスの概要）</h2>
            <p>
              パネマジ掲示板（以下「当サイト」といいます。URL: https://panemaji.com）は、
              ユーザーが風俗店に関する口コミや評価を投稿・閲覧できるサービスです。
              当サイトの利用者（以下「ユーザー」といいます）は、本規約に同意の上、当サイトをご利用ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第2条（投稿コンテンツに関する免責）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>当サイトに投稿されたコンテンツ（口コミ、評価等）は、すべて投稿者個人の主観的な意見・感想であり、投稿者自身の責任において投稿されたものです。</li>
              <li>運営者は、投稿コンテンツの正確性、信頼性、完全性、有用性、適法性等について一切保証いたしません。</li>
              <li>投稿コンテンツに起因して生じたいかなるトラブル・損害についても、運営者は一切の責任を負いません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第3条（掲載情報の正確性について）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>当サイトに掲載されている店舗情報、在籍情報等のデータは、外部の公開ウェブサイトから収集した情報に基づいています。</li>
              <li>これらの情報の正確性、最新性、完全性について、運営者は一切保証いたしません。</li>
              <li>掲載情報と実際の情報との間に差異がある場合がありますので、最新の情報は各店舗の公式サイト等でご確認ください。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第4条（禁止事項）</h2>
            <p className="mb-2">ユーザーは、当サイトの利用にあたり、以下の行為を行ってはなりません。</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>特定の個人を誹謗中傷する行為、または名誉・信用を毀損する行為</li>
              <li>個人情報（本名、住所、電話番号、メールアドレス等）を投稿する行為</li>
              <li>虚偽の情報を故意に投稿する行為</li>
              <li>特定の店舗・個人に対する営業妨害となる行為</li>
              <li>わいせつな画像・動画等を投稿する行為</li>
              <li>法令または公序良俗に違反する行為</li>
              <li>当サイトの運営を妨害する行為</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第5条（投稿の削除・編集権限）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>運営者は、以下の場合を含むがこれに限らず、独自の判断により、事前の通知なく投稿コンテンツを削除または編集することができます。</li>
              <li>本規約に違反する投稿、法令に違反する投稿、第三者の権利を侵害する投稿、その他運営者が不適切と判断した投稿</li>
              <li>投稿の削除・編集について、運営者はその理由を開示する義務を負いません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第6条（知的財産権）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>ユーザーが投稿したコンテンツの著作権その他の知的財産権は、投稿者に帰属します。</li>
              <li>ユーザーは、投稿を行った時点で、運営者に対し、当該コンテンツを当サイト上で表示、複製、配布、翻案する非独占的かつ無償の利用許諾を行ったものとみなします。</li>
              <li>当サイトのデザイン、ロゴ、プログラム等の著作権は運営者に帰属します。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第7条（免責事項）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>当サイトの利用により生じた一切の損害（直接損害、間接損害、逸失利益、データの喪失等を含むがこれに限らない）について、運営者は一切の責任を負いません。</li>
              <li>当サイトの利用に関してユーザーと第三者との間に生じたトラブルについて、運営者は一切の責任を負わず、関与いたしません。</li>
              <li>運営者は、当サイトの動作の中断、停止、終了、利用不能、データの消失等について、いかなる責任も負いません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第8条（外部リンクの免責）</h2>
            <p>
              当サイトには外部ウェブサイトへのリンクが含まれる場合がありますが、
              運営者は外部サイトの内容、安全性、適法性等について一切の責任を負いません。
              外部サイトのご利用は、ユーザーの自己責任において行ってください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第9条（サービスの変更・終了）</h2>
            <p>
              運営者は、ユーザーへの事前の通知なく、当サイトのサービス内容を変更し、
              または提供を終了することができるものとします。
              これによりユーザーに生じた損害について、運営者は一切の責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第10条（準拠法・管轄裁判所）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
              <li>当サイトに関して紛争が生じた場合には、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">第11条（規約の変更）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>運営者は、必要と判断した場合には、ユーザーに通知することなく本規約を随時変更できるものとします。</li>
              <li>変更後の利用規約は、当サイトに掲載した時点で効力を生じるものとします。</li>
              <li>本規約の変更後に当サイトを利用した場合、ユーザーは変更後の規約に同意したものとみなします。</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
