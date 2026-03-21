import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "コラム・ガイド一覧｜パネマジ掲示板",
  description:
    "パネマジ掲示板のコラム・ガイド記事一覧。エリア別デリヘルガイド、パネマジ対策、デリヘルの選び方など、役立つ情報をお届けします。",
  keywords: [
    "パネマジ コラム",
    "デリヘル ガイド",
    "パネマジ 対策",
    "デリヘル エリア別",
    "風俗 ガイド",
  ],
  alternates: { canonical: "https://panemaji.com/guide" },
  openGraph: {
    title: "コラム・ガイド一覧｜パネマジ掲示板",
    description: "パネマジ掲示板のコラム・ガイド記事一覧。エリア別ガイド、パネマジ対策などの情報。",
    type: "website",
    locale: "ja_JP",
    siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide",
  },
};

type Article = {
  href: string;
  title: string;
  summary: string;
  category: "area" | "howto" | "column";
};

const articles: Article[] = [
  // エリア別ガイド
  { href: "/guide/shinjuku-deriheru", title: "新宿デリヘルのパネマジ事情と優良店の選び方", summary: "激戦区・新宿のパネル事情と写真通りの子を見つけるポイントを解説。", category: "area" },
  { href: "/guide/ikebukuro-deriheru", title: "池袋デリヘルのパネマジ度を徹底チェック", summary: "池袋エリアのパネル事情と信頼できる店舗の探し方を紹介。", category: "area" },
  { href: "/guide/shibuya-deriheru", title: "渋谷デリヘルでパネル通りの子を見つけるコツ", summary: "若い世代が集まる渋谷エリアのパネル事情と対策。", category: "area" },
  { href: "/guide/gotanda-deriheru", title: "五反田デリヘル パネマジ回避の完全ガイド", summary: "風俗の聖地・五反田エリアのパネル事情を徹底解説。", category: "area" },
  { href: "/guide/kinshicho-deriheru", title: "錦糸町デリヘルのパネル事情まとめ", summary: "下町情緒あふれる錦糸町エリアのデリヘル攻略法。", category: "area" },
  { href: "/guide/ueno-deriheru", title: "上野・鶯谷デリヘル パネマジチェックガイド", summary: "デリヘルの聖地・鶯谷と上野エリアのパネル事情。", category: "area" },
  { href: "/guide/osaka-deriheru", title: "大阪デリヘルのパネマジ度は？梅田・難波エリア解説", summary: "関西最大の風俗エリア・大阪のパネル事情を分析。", category: "area" },
  { href: "/guide/nagoya-deriheru", title: "名古屋デリヘルのパネル写真事情", summary: "栄・名駅エリアを中心とした名古屋のパネマジ実態。", category: "area" },
  { href: "/guide/fukuoka-deriheru", title: "福岡デリヘル パネマジの実態と口コミ", summary: "中洲・博多エリアを中心とした福岡のパネル事情。", category: "area" },
  { href: "/guide/sapporo-deriheru", title: "札幌デリヘルのパネル通り率をチェック", summary: "すすきのを中心とした北海道最大の風俗エリアを攻略。", category: "area" },
  { href: "/guide/yokohama-deriheru", title: "横浜デリヘルのパネル通り率は？エリア別解説", summary: "関内・曙町・横浜駅周辺のパネル事情を徹底分析。", category: "area" },
  // ハウツー系
  { href: "/guide/panemaji-checker", title: "パネマジの見分け方ガイド｜7つのチェックポイント", summary: "パネル写真と実物が違うかどうかを見抜くための7つのポイント。", category: "howto" },
  { href: "/guide/how-to-use", title: "パネマジ掲示板の使い方ガイド", summary: "検索・口コミ・ランキングの活用法をわかりやすく解説。", category: "howto" },
  { href: "/guide/panemaji-taisaku", title: "パネマジ対策完全マニュアル", summary: "写真詐欺を100%回避するための実践テクニック。", category: "howto" },
  { href: "/guide/panel-photo-check", title: "パネル写真のチェックポイント5選", summary: "加工を見破るための具体的なテクニックを解説。", category: "howto" },
  { href: "/guide/first-deriheru", title: "初めてのデリヘル利用ガイド", summary: "失敗しないための店舗選びから当日の流れまで。", category: "howto" },
  { href: "/guide/kuchikomi-katsuyou", title: "口コミの正しい読み方", summary: "信頼できる口コミの見分け方と活用テクニック。", category: "howto" },
  { href: "/guide/real-do-ranking", title: "リアル度ランキングの見方", summary: "パネル通り率とは？ランキングを活用した賢い選び方。", category: "howto" },
  { href: "/guide/deriheru-erabikata", title: "デリヘル店の賢い選び方", summary: "失敗しない5つのポイントで満足度を最大化。", category: "howto" },
  // コラム系
  { href: "/guide/panemaji-trend-2026", title: "2026年のパネマジ事情", summary: "業界トレンドと最新の対策方法を徹底解説。", category: "column" },
  { href: "/guide/panel-kaishu-sagasu", title: "パネル写真の加工修正事情", summary: "店舗の裏側を知ってパネマジを理解する。", category: "column" },
  { href: "/guide/kuchikomi-tokou", title: "口コミ投稿のススメ", summary: "みんなで作るパネマジデータベースに参加しよう。", category: "column" },
];

const categoryLabels = {
  area: "エリア別ガイド",
  howto: "ハウツー",
  column: "コラム",
} as const;

const categoryColors = {
  area: "bg-blue-100 text-blue-700",
  howto: "bg-green-100 text-green-700",
  column: "bg-purple-100 text-purple-700",
} as const;

function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={article.href}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 sm:p-5 group"
    >
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded mb-2 ${categoryColors[article.category]}`}>
        {categoryLabels[article.category]}
      </span>
      <h3 className="font-bold text-gray-800 group-hover:text-pink-600 transition-colors mb-1 text-sm sm:text-base">
        {article.title}
      </h3>
      <p className="text-gray-500 text-xs sm:text-sm">{article.summary}</p>
    </a>
  );
}

export default function GuidePage() {
  const areaArticles = articles.filter((a) => a.category === "area");
  const howtoArticles = articles.filter((a) => a.category === "howto");
  const columnArticles = articles.filter((a) => a.category === "column");

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-pink-600">トップ</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">コラム・ガイド</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
        コラム・ガイド一覧
      </h1>
      <p className="text-gray-500 text-sm mb-8">
        パネマジ対策やエリア別ガイドなど、デリヘル利用に役立つ情報をお届けします
      </p>

      {/* エリア別ガイド */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-blue-500 rounded"></span>
          エリア別ガイド
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {areaArticles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </div>
      </section>

      {/* ハウツー */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-green-500 rounded"></span>
          ハウツー・使い方
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {howtoArticles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </div>
      </section>

      {/* コラム */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-purple-500 rounded"></span>
          コラム・トレンド
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {columnArticles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </div>
      </section>

      {/* CTAリンク */}
      <div className="text-center mt-8">
        <a
          href="/"
          className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
        >
          パネマジ掲示板トップへ →
        </a>
      </div>
    </div>
  );
}
