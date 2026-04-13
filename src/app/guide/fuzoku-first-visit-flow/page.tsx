import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "風俗初来店の流れ完全ガイド｜予約から退店まで",
  description: "風俗を初めて利用する方のための完全ガイド。予約の仕方から受付、サービス中のマナー、退店までの一連の流れを詳しく解説します。",
  keywords: ["風俗 初めて 流れ", "風俗 初来店", "風俗 予約 方法", "風俗 受付 流れ", "風俗 退店"],
  alternates: { canonical: "https://panemaji.com/guide/fuzoku-first-visit-flow" },
  openGraph: {
    title: "風俗初来店の流れ完全ガイド｜予約から退店まで",
    description: "風俗初来店の流れを予約から退店まで詳しく解説。初心者でも安心の完全ガイド。",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/fuzoku-first-visit-flow",
  },
};

export default function FuzokuFirstVisitFlowPage() {
  return (
    <ArticleLayout
      title="風俗初来店の流れ完全ガイド"
      subtitle="予約から退店まで初心者でも安心のステップ解説"
      breadcrumb="初来店の流れ"
      slug="fuzoku-first-visit-flow"
      datePublished="2026-04-13"
      dateModified="2026-04-13"
      description="風俗初来店の流れを予約から退店まで詳しく解説。初心者でも安心の完全ガイド。"
      relatedLinks={[
        { href: "/guide/fuzoku-type-guide", label: "風俗の業態ガイド" },
        { href: "/guide/fuzoku-manner-guide", label: "風俗のマナーガイド" },
        { href: "/guide/fuzoku-reservation-guide", label: "風俗の予約ガイド" },
        { href: "/guide/fuzoku-beginner-checklist", label: "初心者チェックリスト" },
        { href: "/guide/fuzoku-ryoukin-souba", label: "風俗の料金相場" },
      ]}
    >
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          STEP1：お店選びと予約
        </h2>
        <p className="mb-3">
          まずはポータルサイトや口コミサイトで希望エリアのお店を探します。
          業態・料金・在籍キャストを比較し、気になるお店が見つかったら電話またはWeb予約で申し込みましょう。
          初めての場合は「初めてです」と伝えると、スタッフが丁寧に案内してくれます。
        </p>
        <p>
          予約時には希望のコース・時間・キャストを伝えます。
          指名料が別途かかる場合もあるため、総額を確認しておくと安心です。
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          STEP2：来店・受付の流れ
        </h2>
        <div className="space-y-4">
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">店舗型の場合</h3>
            <p>
              指定された時間にお店に到着し、受付で予約名を伝えます。
              料金の支払いは前払いが一般的です。待合室でキャストの準備が整うまで待機します。
              身分証の提示を求められる場合もあるので、持参しておきましょう。
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-bold text-pink-700 mb-2">デリヘルの場合</h3>
            <p>
              ホテルまたは自宅で待機し、到着連絡を待ちます。
              キャストが到着したらお部屋に招き入れ、料金を支払います。
              ホテル利用の場合は事前にチェックインを済ませておきましょう。
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          STEP3：サービス中のマナー
        </h2>
        <ul className="space-y-3 list-disc list-inside">
          <li><span className="font-semibold">清潔な状態で臨む：</span>シャワーを浴びて身体を清潔にしてからサービスを受けるのが基本マナーです。</li>
          <li><span className="font-semibold">キャストへの配慮：</span>無理な要求や禁止事項の強要は厳禁。お互いが気持ちよく過ごせるよう配慮しましょう。</li>
          <li><span className="font-semibold">時間を守る：</span>コースの時間内で楽しむのがルールです。延長したい場合はキャストに相談しましょう。</li>
          <li><span className="font-semibold">撮影禁止：</span>キャストの撮影や録音は絶対にNGです。スマートフォンはカバンにしまっておきましょう。</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          STEP4：退店とアフターケア
        </h2>
        <div className="bg-pink-50 rounded-lg p-4">
          <h3 className="font-bold text-pink-700 mb-2">気持ちの良い退店のために</h3>
          <p className="mb-2">
            サービス終了後はシャワーを浴びて身支度を整えます。
            キャストにお礼を伝え、忘れ物がないか確認してから退室しましょう。
            オプション料金の追加がある場合は退店前に精算します。
          </p>
          <p>
            良いキャストに出会えたら、パネマジ掲示板に口コミを投稿して他のユーザーの参考にしましょう。
            次回の指名予約も、良い体験を繰り返すための有効な手段です。
          </p>
        </div>
      </section>
    </ArticleLayout>
  );
}
