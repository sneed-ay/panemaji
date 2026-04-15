#!/usr/bin/env node
/**
 * ガイド記事自動生成スクリプト
 *
 * 使い方:
 *   node scripts/generate-articles.mjs              # 10本生成（デフォルト）
 *   node scripts/generate-articles.mjs --count 5    # 5本生成
 *   node scripts/generate-articles.mjs --dry-run    # 生成せずに確認のみ
 *
 * 優先順位（空白地帯優先）:
 *   1. ヘルスガイド（現在1本）
 *   2. ホテヘルガイド（現在1本）
 *   3. ソープガイド（現在12本、主要ソープ街別）
 *   4. 地方エリア×カテゴリガイド
 *   5. 比較・ランキング系
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const GUIDE_DIR = path.join(PROJECT_ROOT, 'src/app/guide');

// ─── CLI引数 ────────────────────────────────────────
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const COUNT = countArg ? parseInt(countArg.split('=')[1]) : (args.includes('--count') ? parseInt(args[args.indexOf('--count') + 1]) : 10);
const DRY_RUN = args.includes('--dry-run');

// ─── 既存記事スラグの取得 ──────────────────────────
function getExistingSlugs() {
  return fs.readdirSync(GUIDE_DIR)
    .filter(name => {
      const stat = fs.statSync(path.join(GUIDE_DIR, name));
      return stat.isDirectory() && fs.existsSync(path.join(GUIDE_DIR, name, 'page.tsx'));
    });
}

// ─── 記事トピック候補 ──────────────────────────────
// 空白地帯を優先。slugが既存のものは自動でスキップされる
const ARTICLE_CANDIDATES = [
  // ── ヘルス系（現在1本） ──
  { slug: 'health-shop-erabikata', title: 'ヘルス店の選び方ガイド', breadcrumb: 'ヘルスの選び方', category: 'health', priority: 1,
    subtitle: '失敗しないヘルス店選びのポイント', keywords: ['ヘルス 選び方', 'ファッションヘルス', 'ヘルス 初心者'] },
  { slug: 'health-vs-soap-vs-deriheru', title: 'ヘルス・ソープ・デリヘルの違いと選び方', breadcrumb: 'ヘルス比較', category: 'health', priority: 1,
    subtitle: '3業態の特徴と料金・サービスを徹底比較', keywords: ['ヘルス 違い', 'ソープ ヘルス デリヘル', '風俗 比較'] },
  { slug: 'health-ryoukin-souba', title: 'ヘルスの料金相場ガイド', breadcrumb: 'ヘルス料金', category: 'health', priority: 1,
    subtitle: 'ヘルスの料金システムと相場を解説', keywords: ['ヘルス 料金', 'ヘルス 相場', 'ファッションヘルス 価格'] },
  { slug: 'health-service-flow', title: 'ヘルスのサービスの流れ', breadcrumb: 'ヘルスの流れ', category: 'health', priority: 1,
    subtitle: '入店から退店までの基本的な流れ', keywords: ['ヘルス 流れ', 'ヘルス 初めて', 'ファッションヘルス 使い方'] },
  { slug: 'health-panemaji-check', title: 'ヘルスのパネマジ度チェックガイド', breadcrumb: 'ヘルスパネマジ', category: 'health', priority: 1,
    subtitle: 'ヘルス業態でのパネル写真と実物の差をチェック', keywords: ['ヘルス パネマジ', 'ヘルス パネル', 'ヘルス 写真'] },

  // ── ホテヘル系（現在1本） ──
  { slug: 'hotelhel-erabikata', title: 'ホテヘル店の選び方ガイド', breadcrumb: 'ホテヘルの選び方', category: 'hotelhel', priority: 1,
    subtitle: '失敗しないホテヘル選びのポイント', keywords: ['ホテヘル 選び方', 'ホテヘル 初心者', 'ホテルヘルス'] },
  { slug: 'hotelhel-vs-deriheru', title: 'ホテヘルとデリヘルの違い', breadcrumb: 'ホテヘル比較', category: 'hotelhel', priority: 1,
    subtitle: '2業態の特徴・料金・メリットを比較', keywords: ['ホテヘル デリヘル 違い', 'ホテルヘルス', 'ホテヘル 比較'] },
  { slug: 'hotelhel-ryoukin-souba', title: 'ホテヘルの料金相場ガイド', breadcrumb: 'ホテヘル料金', category: 'hotelhel', priority: 1,
    subtitle: 'ホテヘルの料金システムと相場を解説', keywords: ['ホテヘル 料金', 'ホテヘル 相場', 'ホテルヘルス 価格'] },
  { slug: 'hotelhel-service-flow', title: 'ホテヘルのサービスの流れ', breadcrumb: 'ホテヘルの流れ', category: 'hotelhel', priority: 1,
    subtitle: '入店から退店までの基本的な流れ', keywords: ['ホテヘル 流れ', 'ホテヘル 初めて'] },
  { slug: 'hotelhel-panemaji-check', title: 'ホテヘルのパネマジ度チェックガイド', breadcrumb: 'ホテヘルパネマジ', category: 'hotelhel', priority: 1,
    subtitle: 'ホテヘルでのパネル写真と実物の差を見抜く', keywords: ['ホテヘル パネマジ', 'ホテヘル パネル'] },

  // ── ソープ街別（主要ソープ街） ──
  { slug: 'soap-ogoto-guide', title: '雄琴ソープガイド', breadcrumb: '雄琴ソープ', category: 'soap', priority: 2,
    subtitle: '滋賀・雄琴の高級ソープ街を徹底解説', keywords: ['雄琴 ソープ', '雄琴 高級ソープ', '滋賀 ソープ'] },
  { slug: 'soap-nakasu-guide', title: '中洲ソープガイド', breadcrumb: '中洲ソープ', category: 'soap', priority: 2,
    subtitle: '福岡・中洲のソープ街を徹底解説', keywords: ['中洲 ソープ', '福岡 ソープ', '中洲 風俗'] },
  { slug: 'soap-susukino-guide', title: 'すすきのソープガイド', breadcrumb: 'すすきのソープ', category: 'soap', priority: 2,
    subtitle: '札幌・すすきののソープ街を徹底解説', keywords: ['すすきの ソープ', '札幌 ソープ', '北海道 ソープ'] },
  { slug: 'soap-kanazuka-guide', title: '金津園ソープガイド', breadcrumb: '金津園ソープ', category: 'soap', priority: 2,
    subtitle: '岐阜・金津園のソープ街を徹底解説', keywords: ['金津園 ソープ', '岐阜 ソープ', '金津園 風俗'] },
  { slug: 'soap-tobita-guide', title: '飛田新地周辺ソープガイド', breadcrumb: '飛田周辺', category: 'soap', priority: 2,
    subtitle: '大阪・飛田周辺のソープ事情', keywords: ['飛田 ソープ', '大阪 ソープ', '飛田新地 周辺'] },
  { slug: 'soap-nishikawaguchi-guide', title: '西川口ソープガイド', breadcrumb: '西川口ソープ', category: 'soap', priority: 2,
    subtitle: '埼玉・西川口のソープ街を徹底解説', keywords: ['西川口 ソープ', '埼玉 ソープ'] },
  { slug: 'soap-horinouchi-guide', title: '堀之内ソープガイド', breadcrumb: '堀之内ソープ', category: 'soap', priority: 2,
    subtitle: '神奈川・堀之内のソープ街を徹底解説', keywords: ['堀之内 ソープ', '川崎 ソープ'] },

  // ── 地方都市 ──
  { slug: 'niigata-menesu', title: '新潟のメンズエステガイド', breadcrumb: '新潟メンエス', category: 'area', priority: 3,
    subtitle: '新潟市のメンエス事情とおすすめエリア', keywords: ['新潟 メンエス', '新潟 メンズエステ'] },
  { slug: 'nagoya-soap-guide', title: '名古屋ソープガイド', breadcrumb: '名古屋ソープ', category: 'area', priority: 3,
    subtitle: '名古屋の主要ソープ街と選び方', keywords: ['名古屋 ソープ', '愛知 ソープ'] },
  { slug: 'okinawa-deriheru', title: '沖縄デリヘルガイド', breadcrumb: '沖縄デリヘル', category: 'area', priority: 3,
    subtitle: '沖縄・那覇のデリヘル事情', keywords: ['沖縄 デリヘル', '那覇 デリヘル'] },
  { slug: 'kanazawa-menesu', title: '金沢のメンズエステガイド', breadcrumb: '金沢メンエス', category: 'area', priority: 3,
    subtitle: '金沢のメンエス事情とおすすめ', keywords: ['金沢 メンエス', '石川 メンエス'] },
  { slug: 'matsuyama-menesu', title: '松山のメンズエステガイド', breadcrumb: '松山メンエス', category: 'area', priority: 3,
    subtitle: '松山のメンエス事情', keywords: ['松山 メンエス', '愛媛 メンエス'] },
  { slug: 'akita-menesu', title: '秋田のメンズエステガイド', breadcrumb: '秋田メンエス', category: 'area', priority: 3,
    subtitle: '秋田のメンエス事情', keywords: ['秋田 メンエス', '秋田 メンズエステ'] },
  { slug: 'fukushima-menesu', title: '福島のメンズエステガイド', breadcrumb: '福島メンエス', category: 'area', priority: 3,
    subtitle: '福島のメンエス事情', keywords: ['福島 メンエス', '郡山 メンエス'] },
  { slug: 'takamatsu-menesu', title: '高松のメンズエステガイド', breadcrumb: '高松メンエス', category: 'area', priority: 3,
    subtitle: '高松のメンエス事情', keywords: ['高松 メンエス', '香川 メンエス'] },

  // ── 比較系 ──
  { slug: 'menesu-vs-aroma', title: 'メンエスとアロマエステの違い', breadcrumb: 'メンエス比較', category: 'compare', priority: 4,
    subtitle: '2業態の特徴とサービスの違い', keywords: ['メンエス アロマ 違い', 'メンズエステ アロマエステ'] },
  { slug: 'deriheru-vs-hotelhel', title: 'デリヘルとホテヘルの使い分け', breadcrumb: 'デリヘル比較', category: 'compare', priority: 4,
    subtitle: 'シーン別の使い分けガイド', keywords: ['デリヘル ホテヘル 違い', '風俗 使い分け'] },
  { slug: 'fuzoku-category-guide', title: '風俗業態まるわかりガイド', breadcrumb: '風俗業態', category: 'compare', priority: 4,
    subtitle: '6業態の特徴・料金・おすすめ比較', keywords: ['風俗 業態', '風俗 種類', '風俗 違い'] },

  // ── ランキング系 ──
  { slug: 'health-tokyo-ranking', title: '東京のヘルス人気店ランキング', breadcrumb: '東京ヘルス', category: 'ranking', priority: 4,
    subtitle: '東京の人気ヘルス店を厳選', keywords: ['東京 ヘルス ランキング', '東京 ファッションヘルス'] },
  { slug: 'hotelhel-tokyo-ranking', title: '東京のホテヘル人気店ランキング', breadcrumb: '東京ホテヘル', category: 'ranking', priority: 4,
    subtitle: '東京の人気ホテヘルを厳選', keywords: ['東京 ホテヘル ランキング'] },
  { slug: 'soap-tokyo-ranking', title: '東京のソープ人気店ランキング', breadcrumb: '東京ソープ', category: 'ranking', priority: 4,
    subtitle: '吉原・新大久保など東京のソープ', keywords: ['東京 ソープ ランキング', '吉原 ソープ'] },
];

// ─── セクション生成（カテゴリごとに基本セクション） ──
function generateSections(article) {
  const common = [
    { h2: 'はじめに', body: `${article.title.replace('ガイド', '').replace('ランキング', '')}について、初めての方にもわかりやすく解説します。このガイドでは${article.subtitle}を中心に、必要な情報をまとめています。パネマジ掲示板の口コミと合わせて参考にしてください。` },
  ];

  const sections = {
    health: [
      { h2: 'ヘルスの基本', body: 'ファッションヘルスは、店舗型の風俗業態の一つで、店内の個室でサービスを受けられる形態です。ソープと比べて料金が手頃で、デリヘルと比べてホテル代がかからないのが特徴です。' },
      { h2: 'サービスの特徴', body: 'ヘルスは本番行為は禁止されていますが、個室でマンツーマンのサービスが受けられます。店舗ごとにコースやオプションが異なるため、事前にサイトで確認することが重要です。' },
      { h2: 'パネマジ対策', body: 'ヘルスでもパネル写真と実物の差があるケースがあります。パネマジ掲示板の口コミで各キャストのリアル度を確認してから指名すると、失敗を避けやすくなります。写真と実物の一致度は店舗ごとに大きく異なるため、事前チェックが重要です。' },
      { h2: '料金の目安', body: '一般的に60分コースで15,000円〜25,000円程度が相場です。指名料・交通費・オプション料金が追加される場合があるため、総額を事前に確認しましょう。' },
      { h2: '選び方のコツ', body: '初めて利用する場合は、口コミ評価が高く、パネル通りの評価が多い店舗を選ぶのがおすすめです。パネマジ掲示板で各店舗のリアル度ランキングを確認できます。' },
    ],
    hotelhel: [
      { h2: 'ホテヘルの基本', body: 'ホテルヘルス（ホテヘル）は、店舗で受付をしてからホテルに移動してサービスを受ける業態です。デリヘルと違い、店舗で事前に接客を受けられるため、写真との差を店舗で確認してから指名することも可能です。' },
      { h2: 'デリヘルとの違い', body: 'ホテヘルは店舗で接客してから移動する点がデリヘルと異なります。また、ホテル代が料金に含まれているケースが多く、追加費用が少ない傾向があります。' },
      { h2: 'パネマジ対策', body: 'ホテヘルは店舗型のため、入店時に実物を確認できるメリットがあります。ただしキャストが待機している店舗とそうでない店舗があるため、事前確認が重要です。パネマジ掲示板の口コミで各店舗のリアル度を確認しましょう。' },
      { h2: '料金の目安', body: '60分コースで20,000円〜30,000円程度が相場です。ホテル代込みのケースが多いですが、店舗によっては別料金になる場合もあります。' },
      { h2: '選び方のコツ', body: '初めてのホテヘルは、口コミ評価が高く、パネル通りの評価が多い店舗を選ぶのがおすすめです。店舗アクセスの良さもポイントになります。' },
    ],
    soap: [
      { h2: 'エリアの特徴', body: `${article.breadcrumb}は、伝統あるソープランド街として知られています。高級店から大衆店まで幅広く、予算や好みに応じて選べるのが魅力です。` },
      { h2: '料金相場', body: '高級店は80,000円〜150,000円、中級店は40,000円〜70,000円、大衆店は20,000円〜40,000円が目安です。総額（総額表示）に入浴料・サービス料が含まれているか確認しましょう。' },
      { h2: 'パネマジ対策', body: 'ソープ業界でもパネル写真と実物の差は存在します。特に高級店では厳しくチェックされますが、大衆店では差があるケースも。パネマジ掲示板の口コミで事前確認することで、納得のいく選択ができます。' },
      { h2: '選び方のコツ', body: '初めての方は高級店か、口コミ評価の高い中級店がおすすめです。予算に合わせて、パネマジ掲示板のリアル度評価を参考に選びましょう。' },
      { h2: 'アクセスと営業時間', body: 'ソープ街は駅から徒歩圏内に集中していることが多く、アクセスが便利です。営業時間は店舗により異なりますが、昼から深夜まで営業している店舗が多いです。' },
    ],
    area: [
      { h2: 'エリアの特徴', body: `${article.breadcrumb.replace('メンエス', '').replace('ソープ', '').replace('デリヘル', '')}の風俗事情について解説します。都市部ほどの選択肢はありませんが、地元密着の良店が点在しているのが特徴です。` },
      { h2: '主要エリア', body: '駅周辺や繁華街に店舗が集中していることが多く、アクセスも比較的便利です。地方ならではのアットホームな接客が魅力の店舗もあります。' },
      { h2: '料金相場', body: '都市部と比べて料金がやや抑えめなケースが多いです。指名料や交通費が別途かかる場合もあるため、総額を確認しましょう。' },
      { h2: 'パネマジ対策', body: '地方の店舗でもパネル写真と実物の差は存在します。パネマジ掲示板でリアル度評価を確認することで、失敗を避けられます。店舗数が限られる分、口コミの蓄積が貴重な情報源になります。' },
      { h2: '選び方のコツ', body: '地方店舗は口コミ数が少ない傾向にあるため、パネマジ掲示板での評価に加えて、店舗の在籍数や営業実績も参考にしましょう。' },
    ],
    compare: [
      { h2: '各業態の基本', body: '風俗業態は法律上の分類と実態で分かれており、サービス内容・料金・利用方法が大きく異なります。自分に合った業態を選ぶことが重要です。' },
      { h2: '料金の比較', body: '業態によって料金相場は大きく異なります。ソープは最も高額、デリヘル・ホテヘルは中間、ヘルスは比較的手頃、メンエスは癒し系という位置付けです。' },
      { h2: 'サービスの違い', body: '各業態で提供されるサービスには違いがあります。店舗型（ヘルス・ソープ・ホテヘル）は店舗内でサービスを受け、デリヘルは自宅やホテルにキャストを呼びます。メンエスはアロマオイルによるマッサージが中心です。' },
      { h2: 'パネマジ対策', body: 'どの業態でもパネル写真と実物の差は存在します。パネマジ掲示板の口コミで、業態ごとのリアル度評価を比較できます。初回利用時は特にリアル度の高い店舗を選ぶと安心です。' },
      { h2: 'シーン別の選び方', body: '初心者はヘルスかホテヘルがおすすめ。高級感を求めるならソープ、プライベートな空間ならデリヘル、リラックスしたいならメンエスという使い分けができます。' },
    ],
    ranking: [
      { h2: 'ランキングの基準', body: 'このランキングは、パネマジ掲示板に蓄積された口コミ評価をベースに、リアル度（パネル通り率）と投票数を加味して算出しています。一時的な評価ではなく、継続的に高評価を維持している店舗を選出しています。' },
      { h2: '上位店舗の特徴', body: '上位にランクインする店舗は、パネル通りの評価が多く、キャストの質が安定しているのが特徴です。新人キャストでも写真と実物の差が少ない店舗は、店舗全体の管理がしっかりしていると言えます。' },
      { h2: '選び方のコツ', body: 'ランキング上位の店舗を選ぶことで、パネマジ被害のリスクを大きく減らせます。ただし、ランキングだけでなく、個別の口コミも必ず確認しましょう。同じ店舗でもキャストによって評価が異なる場合があります。' },
      { h2: 'パネマジ対策', body: 'ランキング上位店舗でも、個別のキャストの評価を確認することが重要です。パネマジ掲示板の各嬢ページで詳細な評価を見ることができます。' },
      { h2: 'まとめ', body: '本記事のランキングは継続的に更新されます。最新の情報はパネマジ掲示板のランキングページでも確認できますので、合わせてチェックしてください。' },
    ],
  };

  return [...common, ...(sections[article.category] || sections.compare)];
}

// ─── 記事TSX生成 ────────────────────────────────────
function generateArticleTSX(article) {
  const today = new Date().toISOString().split('T')[0];
  const sections = generateSections(article);
  const keywordsStr = JSON.stringify(article.keywords);

  const sectionsHTML = sections.map(s => `      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-pink-200">
          ${s.h2}
        </h2>
        <p className="mb-3">
          ${s.body}
        </p>
      </section>`).join('\n\n');

  // Related links（同じカテゴリから4本選ぶ）
  const relatedLinks = [
    { href: '/guide/panemaji-checker', label: 'パネマジの見分け方' },
    { href: '/guide/panemaji-taisaku', label: 'パネマジ対策マニュアル' },
    { href: '/guide/fuzoku-ryoukin-souba', label: '風俗の料金相場' },
    { href: '/guide/panemaji-faq', label: 'パネマジ掲示板FAQ' },
  ];
  const relatedLinksStr = relatedLinks.map(l => `        { href: "${l.href}", label: "${l.label}" },`).join('\n');

  return `import type { Metadata } from "next";
import ArticleLayout from "../_components/ArticleLayout";

export const metadata: Metadata = {
  title: "${article.title}｜パネマジ掲示板",
  description: "${article.subtitle}。${article.title}を徹底解説し、失敗しない選び方を紹介します。",
  keywords: ${keywordsStr},
  alternates: { canonical: "https://panemaji.com/guide/${article.slug}" },
  openGraph: {
    title: "${article.title}｜パネマジ掲示板",
    description: "${article.subtitle}",
    type: "article", locale: "ja_JP", siteName: "パネマジ掲示板",
    url: "https://panemaji.com/guide/${article.slug}",
  },
};

export default function ${article.slug.replace(/-/g, '_').replace(/\b\w/g, c => c.toUpperCase())}Page() {
  return (
    <ArticleLayout
      title="${article.title}"
      subtitle="${article.subtitle}"
      breadcrumb="${article.breadcrumb}"
      slug="${article.slug}"
      datePublished="${today}"
      dateModified="${today}"
      description="${article.subtitle}"
      relatedLinks={[
${relatedLinksStr}
      ]}
    >
${sectionsHTML}
    </ArticleLayout>
  );
}
`;
}

// ─── メイン ────────────────────────────────────────
function main() {
  const existing = new Set(getExistingSlugs());
  console.log(`既存記事数: ${existing.size}`);

  // 未作成の候補を優先度順に並べる
  const queue = ARTICLE_CANDIDATES
    .filter(a => !existing.has(a.slug))
    .sort((a, b) => a.priority - b.priority);

  console.log(`未作成候補: ${queue.length}`);

  if (queue.length === 0) {
    console.log('全ての候補記事が既に存在します。');
    return;
  }

  const toCreate = queue.slice(0, COUNT);
  console.log(`今回作成: ${toCreate.length}本\n`);

  let created = 0;
  for (const article of toCreate) {
    const slugDir = path.join(GUIDE_DIR, article.slug);
    const pagePath = path.join(slugDir, 'page.tsx');

    console.log(`  [${++created}/${toCreate.length}] ${article.slug} (${article.category})`);
    console.log(`    タイトル: ${article.title}`);

    if (DRY_RUN) continue;

    // ディレクトリ作成
    fs.mkdirSync(slugDir, { recursive: true });

    // TSXファイル生成
    const tsx = generateArticleTSX(article);
    fs.writeFileSync(pagePath, tsx, 'utf-8');
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}完了: ${created}本`);
}

main();
