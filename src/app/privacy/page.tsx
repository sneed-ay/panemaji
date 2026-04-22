import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "パネマジ掲示板のプライバシーポリシー。アクセス解析・広告配信におけるCookie・ID5等の第三者識別子の利用とオプトアウト方法を説明します。",
  alternates: {
    canonical: "https://panemaji.com/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">プライバシーポリシー</span>
      </nav>

      <div className="bg-white rounded-lg shadow p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">プライバシーポリシー</h1>
        <p className="text-sm text-gray-500 mb-8">最終更新日: 2026年4月22日</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">1. 基本方針</h2>
            <p>
              パネマジ掲示板（以下「当サイト」、URL: https://panemaji.com）は、
              ユーザーのプライバシーを尊重し、個人情報の適切な管理に努めます。
              本ポリシーでは、当サイトがアクセス解析・広告配信のために取得・利用する情報と、
              ユーザーが拒否（オプトアウト）する方法について説明します。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">2. 取得する情報</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>アクセスログ（IPアドレス、ブラウザ種別、OS種別、リファラ、閲覧ページ、アクセス日時）</li>
              <li>Cookie・類似技術によるセッション識別子、匿名のブラウザ識別子</li>
              <li>口コミ投稿時のブラウザ指紋（重複投稿防止のため、個人を特定しない形で保存）</li>
            </ol>
            <p className="mt-3">
              氏名・住所・電話番号・メールアドレス等の直接的な個人情報は取得しません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">3. Google Analytics</h2>
            <p>
              当サイトはアクセス解析のために Google Analytics（GA4、計測ID: G-CM0CD47KFB）を使用しています。
              Google Analytics は Cookie を使用してユーザーの利用状況を匿名で収集します。
              詳細は{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-600 hover:underline"
              >
                Google プライバシーポリシー
              </a>
              をご確認ください。Google Analytics の計測を拒否したい場合は、{" "}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-600 hover:underline"
              >
                Google Analytics オプトアウト アドオン
              </a>
              をインストールしてください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">4. 広告配信</h2>
            <p className="mb-3">
              当サイトでは、以下の広告配信事業者により、ユーザーの興味に応じた広告が配信される場合があります。
              これらの事業者は Cookie・類似技術を使用してユーザーの閲覧履歴を収集することがあります。
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>株式会社ユナイテッド（adstir）</strong> —{" "}
                <a
                  href="https://mt.united.jp/rule.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:underline"
                >
                  プライバシーポリシー
                </a>
                {" / "}
                <a
                  href="https://ja.ad-stir.com/sp/optout.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:underline"
                >
                  オプトアウト
                </a>
              </li>
              <li>
                <strong>DMMアフィリエイト（FANZA）</strong> — DMM.com が配信する商品広告。商品画像クリック時に DMM のサイトへ遷移します。
              </li>
              <li>
                <strong>Adsterra / AdMaven</strong> — 一部ページで表示される第三者広告配信。各社のプライバシーポリシーに従います。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">5. ID5 クロスデバイス識別</h2>
            <p className="mb-3">
              広告配信の最適化のため、当サイトでは ID5 Technology Ltd. が提供する匿名のブラウザ/デバイス識別子（ID5 ID）を使用する場合があります。
              ID5 ID は直接の個人情報を含まない匿名識別子ですが、他サービスと連携して広告のターゲティングに利用される可能性があります。
            </p>
            <p className="mb-3">
              ID5 の利用を拒否（オプトアウト）したい場合は、以下のリンクから設定できます。
            </p>
            <p>
              <a
                href="https://id5.io/jp/platform-privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors no-underline"
              >
                ID5 プライバシーポリシー / オプトアウト
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">6. 情報の開示・第三者提供</h2>
            <p>
              当サイトは、法令に基づく場合を除き、ユーザーから取得した情報を第三者に開示・提供することはありません。
              広告配信事業者への情報提供は、前項に記載した広告配信の目的に限られます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">7. Cookie の管理について</h2>
            <p>
              ユーザーはブラウザの設定により、Cookie の受け入れを拒否することができます。
              ただし、Cookie を無効にした場合、一部の機能（24時間のコンテンツアンロック状態など）が
              正常に動作しないことがあります。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">8. プライバシーポリシーの変更</h2>
            <p>
              当サイトは、必要に応じて本ポリシーを改定することがあります。
              重要な変更がある場合は、当ページにて告知します。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">9. お問い合わせ</h2>
            <p>
              本ポリシーに関するお問い合わせは、
              <a href="/contact" className="text-pink-600 hover:underline">お問い合わせフォーム</a>
              よりご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
