import type { Metadata } from "next";
import { getTopShopsForArticles } from "@/lib/queries";

export const revalidate = 86400; // ISR: 24 hours

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
    "メンエス ガイド",
    "メンエス 選び方",
    "メンエス 料金 相場",
    "メンエス パネマジ",
    "風俗 料金 相場",
    "デリヘル ソープ 違い",
    "吉原 ソープ",
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
  category: "area" | "howto" | "column" | "shop" | "special" | "compare" | "menesu";
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
  { href: "/guide/kyoto-deriheru", title: "京都デリヘルのパネマジ事情と河原町・木屋町エリア解説", summary: "観光地・京都の風俗街の特徴とパネマジ傾向を解説。", category: "area" },
  { href: "/guide/kobe-deriheru", title: "神戸デリヘル完全ガイド｜三宮・福原エリアのパネマジ事情", summary: "三宮・福原ソープ街を中心とした神戸の風俗事情。", category: "area" },
  { href: "/guide/sendai-deriheru", title: "仙台デリヘルのパネマジ度｜国分町エリアの実態", summary: "東北最大の歓楽街・国分町のパネル事情を徹底解説。", category: "area" },
  { href: "/guide/hiroshima-deriheru", title: "広島デリヘルのパネマジ事情｜流川・薬研堀エリア解説", summary: "中国地方最大の風俗街・流川と薬研堀の実態。", category: "area" },
  // ハウツー系
  { href: "/guide/panemaji-checker", title: "パネマジの見分け方ガイド｜7つのチェックポイント", summary: "パネル写真と実物が違うかどうかを見抜くための7つのポイント。", category: "howto" },
  { href: "/guide/how-to-use", title: "パネマジ掲示板の使い方ガイド", summary: "検索・口コミ・ランキングの活用法をわかりやすく解説。", category: "howto" },
  { href: "/guide/panemaji-taisaku", title: "パネマジ対策完全マニュアル", summary: "写真詐欺を100%回避するための実践テクニック。", category: "howto" },
  { href: "/guide/panel-photo-check", title: "パネル写真のチェックポイント5選", summary: "加工を見破るための具体的なテクニックを解説。", category: "howto" },
  { href: "/guide/first-deriheru", title: "初めてのデリヘル利用ガイド", summary: "失敗しないための店舗選びから当日の流れまで。", category: "howto" },
  { href: "/guide/kuchikomi-katsuyou", title: "口コミの正しい読み方", summary: "信頼できる口コミの見分け方と活用テクニック。", category: "howto" },
  { href: "/guide/real-do-ranking", title: "リアル度ランキングの見方", summary: "パネル通り率とは？ランキングを活用した賢い選び方。", category: "howto" },
  { href: "/guide/deriheru-erabikata", title: "デリヘル店の賢い選び方", summary: "失敗しない5つのポイントで満足度を最大化。", category: "howto" },
  { href: "/guide/ns-nn-toha", title: "NS/NNとは？意味と注意点を初心者向けに解説", summary: "ソープ用語NS・NNの意味、リスク、優良店での扱い方。", category: "howto" },
  { href: "/guide/shame-nikki-mikata", title: "写メ日記の見方ガイド｜パネマジを見抜くコツ", summary: "写メ日記から実物との差を見抜くためのチェックポイント。", category: "howto" },
  // コラム系
  { href: "/guide/panemaji-trend-2026", title: "2026年のパネマジ事情", summary: "業界トレンドと最新の対策方法を徹底解説。", category: "column" },
  { href: "/guide/panel-kaishu-sagasu", title: "パネル写真の加工修正事情", summary: "店舗の裏側を知ってパネマジを理解する。", category: "column" },
  { href: "/guide/kuchikomi-tokou", title: "口コミ投稿のススメ", summary: "みんなで作るパネマジデータベースに参加しよう。", category: "column" },
  // 特集系
  { href: "/guide/av-joyuu-zaiseki", title: "元AV女優が在籍するデリヘル店まとめ｜見つけ方と注意点", summary: "元AV女優が風俗に在籍する理由、探し方のコツ、パネマジリスクを解説。", category: "special" },
  { href: "/guide/hajimete-menesu", title: "初めてのメンエス完全ガイド｜流れ・マナー・店選びのコツ", summary: "メンエス初心者向けに施術の流れ、セラピスト選び、パネマジの実態を解説。", category: "special" },
  { href: "/guide/panemaji-kaishuu-gihou", title: "パネル写真の加工テクニック完全解説｜店側の手口を知って騙されない", summary: "写真加工の手法と見破るポイントを徹底解説。", category: "special" },
  { href: "/guide/kuchikomi-shinjitsu", title: "風俗口コミの真実｜サクラの見分け方と信頼できる口コミの特徴", summary: "サクラ口コミの特徴、ステマの手口、本物の口コミの見分け方。", category: "special" },
  { href: "/guide/nenmatsu-nenshi-fuzoku", title: "年末年始の風俗事情｜繁忙期のパネマジ率と賢い利用法", summary: "季節による風俗業界の変化、繁忙期のリスクと対策。", category: "special" },
  { href: "/guide/yoshiwara-soap-guide", title: "吉原ソープ完全攻略ガイド｜初心者からリピーターまで", summary: "吉原の歴史、店のランク分け、料金相場、パネマジ事情を解説。", category: "special" },
  { href: "/guide/gotanda-menesu", title: "五反田メンエス激戦区の歩き方｜おすすめの探し方", summary: "五反田のメンエス事情と失敗しない選び方のコツ。", category: "special" },
  // メンエス特集
  { href: "/guide/menesu-nagare", title: "メンズエステの施術の流れ完全解説｜入店から退店まで", summary: "予約方法、入店の流れ、施術内容、マナー、チップ事情まで網羅。", category: "menesu" },
  { href: "/guide/menesu-kiwadoi", title: "メンエスの際どいサービスとは？｜初心者が知るべきNG行為", summary: "グレーゾーンの解説、やってはいけないこと、店選びの重要性。", category: "menesu" },
  { href: "/guide/menesu-erabikata", title: "失敗しないメンエスの選び方｜口コミ・写真の見方", summary: "セラピスト選びのコツ、パネマジの見分け方、口コミの読み方。", category: "menesu" },
  { href: "/guide/shinjuku-menesu", title: "新宿メンエス完全ガイド｜エリア別の特徴と人気店の探し方", summary: "新宿のメンエス事情、エリア分類、料金相場を解説。", category: "menesu" },
  { href: "/guide/ikebukuro-menesu", title: "池袋メンエスガイド｜初心者におすすめの探し方", summary: "池袋のメンエス事情とコスパの良い探し方。", category: "menesu" },
  { href: "/guide/ginza-menesu", title: "銀座・新橋メンエスの特徴｜ビジネスマン御用達エリア解説", summary: "高級店が多い銀座・新橋エリアの特徴と料金相場。", category: "menesu" },
  { href: "/guide/menesu-ryoukin-souba", title: "メンエスの料金相場まとめ｜コース別・エリア別の価格帯", summary: "60分/90分/120分の相場、エリアによる違い、オプション料金。", category: "menesu" },
  { href: "/guide/menesu-panemaji", title: "メンエスのパネマジ事情｜セラピスト写真の実態と対策", summary: "メンエス特有のパネマジ傾向、デリヘルとの違い。", category: "menesu" },
  { href: "/guide/osaka-menesu", title: "大阪メンエス完全ガイド｜梅田・難波エリアの特徴と選び方", summary: "梅田・北新地・難波・心斎橋の関西メンエス事情を解説。", category: "menesu" },
  { href: "/guide/nagoya-menesu", title: "名古屋メンエス完全ガイド｜栄・名駅エリアの特徴", summary: "栄・名駅・錦エリアの東海メンエス事情と料金相場。", category: "menesu" },
  { href: "/guide/fukuoka-menesu", title: "福岡メンエス完全ガイド｜博多・天神エリアの特徴", summary: "博多・天神・中洲を中心とした九州最大のメンエス街。", category: "menesu" },
  { href: "/guide/yokohama-menesu", title: "横浜メンエス完全ガイド｜横浜駅・関内エリアの特徴", summary: "横浜駅・関内・桜木町エリアのメンエス事情と選び方。", category: "menesu" },
  // 比較・ランキング系
  { href: "/guide/deriheru-vs-soap", title: "デリヘルとソープの違い完全比較｜料金・サービス・パネマジ率", summary: "各業態の特徴を料金・サービス・パネマジ率で比較。", category: "compare" },
  { href: "/guide/menesu-vs-esthe", title: "メンエスとエステの違い｜初心者が知るべき業態別の特徴", summary: "業態の違い、サービス内容、パネマジの傾向を解説。", category: "compare" },
  { href: "/guide/fuzoku-ryoukin-souba", title: "風俗の料金相場まとめ｜業態別・エリア別の価格帯", summary: "各業態の料金相場とエリアによる違いを徹底解説。", category: "compare" },
  // 追加エリアガイド
  { href: "/guide/chiba-deriheru", title: "千葉デリヘルのパネマジ事情｜船橋・柏・千葉駅エリア解説", summary: "首都圏ベッドタウンのパネル事情を徹底分析。", category: "area" },
  { href: "/guide/saitama-deriheru", title: "埼玉デリヘルのパネマジ度｜大宮・川口・川越エリアガイド", summary: "首都圏北部の風俗事情とパネル通り率を分析。", category: "area" },
  { href: "/guide/kawasaki-deriheru", title: "川崎デリヘル完全ガイド｜堀之内・南町エリアのパネマジ事情", summary: "関東有数の風俗街・川崎のリアルを徹底分析。", category: "area" },
  { href: "/guide/niigata-deriheru", title: "新潟デリヘルのパネマジ事情｜古町・万代エリア解説", summary: "日本海側最大の歓楽街・古町の風俗事情。", category: "area" },
  { href: "/guide/okayama-deriheru", title: "岡山デリヘルのパネマジ事情｜岡山駅・倉敷エリア解説", summary: "中国地方の交通要衝・岡山の風俗事情を分析。", category: "area" },
  { href: "/guide/kumamoto-deriheru", title: "熊本デリヘルのパネマジ事情｜中央街・下通エリア解説", summary: "九州第3の都市・熊本の風俗事情を分析。", category: "area" },
  { href: "/guide/kagoshima-deriheru", title: "鹿児島デリヘルのパネマジ事情｜天文館エリア解説", summary: "九州南部の歓楽街・天文館の風俗事情。", category: "area" },
  { href: "/guide/kanazawa-deriheru", title: "金沢デリヘルのパネマジ事情｜片町・香林坊エリア解説", summary: "北陸の中心都市・金沢の風俗事情を分析。", category: "area" },
  { href: "/guide/matsuyama-deriheru", title: "松山デリヘルのパネマジ事情｜大街道・二番町エリア解説", summary: "四国最大の都市・松山の風俗事情を分析。", category: "area" },
  { href: "/guide/naha-deriheru", title: "那覇デリヘルのパネマジ事情｜松山・久茂地エリア解説", summary: "リゾート地・沖縄の風俗事情を徹底分析。", category: "area" },
  { href: "/guide/hamamatsu-deriheru", title: "浜松デリヘルのパネマジ事情｜浜松駅・有楽街エリア解説", summary: "静岡県西部の中心都市・浜松の風俗事情。", category: "area" },
  { href: "/guide/kitakyushu-deriheru", title: "北九州デリヘルのパネマジ事情｜小倉・黒崎エリア解説", summary: "九州第2の都市・北九州の風俗事情を分析。", category: "area" },
  { href: "/guide/utsunomiya-deriheru", title: "宇都宮デリヘルのパネマジ事情｜駅東・オリオン通り解説", summary: "北関東最大の都市・宇都宮の風俗事情。", category: "area" },
  { href: "/guide/mito-deriheru", title: "水戸デリヘルのパネマジ事情｜駅南・大工町エリア解説", summary: "茨城県の県庁所在地・水戸の風俗事情。", category: "area" },
  { href: "/guide/takasaki-deriheru", title: "高崎デリヘルのパネマジ事情｜駅西口・あら町エリア解説", summary: "群馬県最大の都市・高崎の風俗事情。", category: "area" },
  // 追加ハウツー・FAQ系
  { href: "/guide/panemaji-faq", title: "パネマジに関するよくある質問まとめ｜FAQ", summary: "パネマジの意味から見分け方まで初心者の疑問を解決。", category: "howto" },
  { href: "/guide/menesu-faq", title: "メンエスのよくある質問｜初心者が気になる疑問を解説", summary: "メンエスの料金・流れ・マナーまで徹底FAQ。", category: "menesu" },
  { href: "/guide/fuzoku-yougo", title: "風俗用語集｜初心者向け基本用語50選", summary: "パネマジ、NS、NNなど風俗の基本用語を解説。", category: "howto" },
  { href: "/guide/deriheru-hajimete-faq", title: "デリヘル初心者のよくある質問｜不安を解消するFAQ", summary: "初めてのデリヘル利用の疑問を全て解決。", category: "howto" },
  { href: "/guide/soap-hajimete-guide", title: "初めてのソープランド完全ガイド｜流れ・料金・選び方", summary: "ソープ初心者の不安を全て解消する完全マニュアル。", category: "howto" },
  { href: "/guide/fuzoku-trouble-taisaku", title: "風俗トラブル対策ガイド｜よくあるトラブルと回避方法", summary: "ぼったくり、パネマジ、時間トラブルの回避方法。", category: "howto" },
  { href: "/guide/fuzoku-eisei-guide", title: "風俗利用時の衛生管理ガイド｜安全に楽しむための知識", summary: "性病予防、清潔マナー、安全な利用方法を解説。", category: "howto" },
  { href: "/guide/fuzoku-manner-guide", title: "風俗マナー完全ガイド｜好印象を与える利用者になるコツ", summary: "マナーの良い客はサービスの質も上がる。", category: "howto" },
  { href: "/guide/panel-photo-kako-rekishi", title: "パネル写真の加工の歴史｜アナログ時代からAI加工まで", summary: "パネマジの進化と見分け方の変遷。", category: "column" },
  // 追加メンエス地方ガイド
  { href: "/guide/sapporo-menesu", title: "札幌メンエス完全ガイド｜すすきのエリアの特徴と選び方", summary: "北海道最大の歓楽街で楽しむメンエスガイド。", category: "menesu" },
  { href: "/guide/sendai-menesu", title: "仙台メンエス完全ガイド｜国分町エリアの特徴と選び方", summary: "東北最大の歓楽街のメンエス事情を分析。", category: "menesu" },
  { href: "/guide/hiroshima-menesu", title: "広島メンエス完全ガイド｜流川・八丁堀エリアの特徴", summary: "中国地方最大の歓楽街のメンエス事情。", category: "menesu" },
  { href: "/guide/kobe-menesu", title: "神戸メンエス完全ガイド｜三宮・元町エリアの特徴", summary: "おしゃれな港町・神戸のメンエス事情を分析。", category: "menesu" },
  // 追加エリアガイド（地方都市）
  { href: "/guide/nagano-deriheru", title: "長野デリヘルのパネマジ事情｜善光寺周辺・長野駅エリア解説", summary: "信州の中心都市・長野の風俗事情を分析。", category: "area" },
  { href: "/guide/gifu-deriheru", title: "岐阜デリヘルのパネマジ事情｜岐阜駅・柳ケ瀬エリア解説", summary: "東海地方の中核都市・岐阜の風俗事情。", category: "area" },
  { href: "/guide/toyama-deriheru", title: "富山デリヘルのパネマジ事情｜富山駅周辺エリア解説", summary: "北陸の工業都市・富山の風俗事情を分析。", category: "area" },
  { href: "/guide/shizuoka-deriheru", title: "静岡デリヘルのパネマジ事情｜両替町・呉服町エリア解説", summary: "静岡県中部の中心地・静岡市の風俗事情。", category: "area" },
  { href: "/guide/tokushima-deriheru", title: "徳島デリヘルのパネマジ事情｜秋田町エリア解説", summary: "四国東部の県庁所在地・徳島の風俗事情。", category: "area" },
  { href: "/guide/oita-deriheru", title: "大分デリヘルのパネマジ事情｜都町エリア解説", summary: "温泉県・大分の繁華街の風俗事情を分析。", category: "area" },
  { href: "/guide/nagasaki-deriheru", title: "長崎デリヘルのパネマジ事情｜思案橋エリア解説", summary: "異国情緒あふれる長崎の風俗事情を分析。", category: "area" },
  { href: "/guide/miyazaki-deriheru", title: "宮崎デリヘルのパネマジ事情｜ニシタチエリア解説", summary: "南国・宮崎の繁華街の風俗事情を分析。", category: "area" },
  { href: "/guide/nara-deriheru", title: "奈良デリヘルのパネマジ事情｜三条通り周辺解説", summary: "古都・奈良の風俗事情を分析。", category: "area" },
  { href: "/guide/wakayama-deriheru", title: "和歌山デリヘルのパネマジ事情｜ぶらくり丁エリア解説", summary: "紀州・和歌山の風俗事情を分析。", category: "area" },
  { href: "/guide/akita-deriheru", title: "秋田デリヘルのパネマジ事情｜川反エリア解説", summary: "秋田の繁華街・川反の風俗事情を分析。", category: "area" },
  { href: "/guide/yamagata-deriheru", title: "山形デリヘルのパネマジ事情｜七日町エリア解説", summary: "山形の繁華街・七日町の風俗事情を分析。", category: "area" },
  { href: "/guide/fukushima-deriheru", title: "福島デリヘルのパネマジ事情｜郡山・福島駅エリア解説", summary: "福島県の2大都市の風俗事情を分析。", category: "area" },
  { href: "/guide/mie-deriheru", title: "三重デリヘルのパネマジ事情｜四日市・津エリア解説", summary: "東海地方の三重県の風俗事情を分析。", category: "area" },
  { href: "/guide/saga-deriheru", title: "佐賀デリヘルのパネマジ事情｜佐賀駅周辺解説", summary: "九州・佐賀の風俗事情を分析。", category: "area" },
  { href: "/guide/kochi-deriheru", title: "高知デリヘルのパネマジ事情｜帯屋町エリア解説", summary: "四国南部・高知の風俗事情を分析。", category: "area" },
  { href: "/guide/aomori-deriheru", title: "青森デリヘルのパネマジ事情｜本町エリア解説", summary: "本州最北の県庁所在地・青森の風俗事情。", category: "area" },
  { href: "/guide/iwate-deriheru", title: "岩手デリヘルのパネマジ事情｜盛岡・大通エリア解説", summary: "東北の中核都市・盛岡の風俗事情を分析。", category: "area" },
  { href: "/guide/takamatsu-deriheru", title: "高松デリヘルのパネマジ事情｜瓦町・ライオン通り解説", summary: "四国北部・高松の風俗事情を分析。", category: "area" },
  { href: "/guide/fukui-deriheru", title: "福井デリヘルのパネマジ事情｜片町エリア解説", summary: "北陸・福井の風俗事情を分析。", category: "area" },
  // 追加ハウツー・コラム記事 (2026-04-13)
  { href: "/guide/deriheru-ryoukin-guide", title: "デリヘルの料金ガイド｜コース・オプション・交通費の仕組み", summary: "デリヘルの料金体系を徹底解説。", category: "howto" },
  { href: "/guide/soap-vs-health", title: "ソープとヘルスの違い完全比較｜サービス・料金・パネマジ率", summary: "ソープとヘルスの違いを料金・サービスで比較。", category: "compare" },
  { href: "/guide/fuzoku-season-guide", title: "風俗の季節別ガイド｜繁忙期・閑散期の特徴と賢い利用法", summary: "季節ごとの風俗業界の特徴と対策。", category: "column" },
  { href: "/guide/fuzoku-hotel-guide", title: "デリヘル利用のホテル選びガイド｜ラブホ vs ビジネスホテル", summary: "デリヘル利用に最適なホテルの選び方。", category: "howto" },
  { href: "/guide/panel-photo-mitiwake", title: "パネル写真の加工を見分ける10のテクニック", summary: "写真加工を見破るための実践テクニック。", category: "howto" },
  { href: "/guide/fuzoku-repeat-guide", title: "風俗リピーターの賢い活用術｜本指名・常連割引のコツ", summary: "リピーターならではのお得な活用法。", category: "howto" },
  { href: "/guide/fuzoku-reservation-guide", title: "デリヘルの予約方法完全ガイド｜電話・LINE・Web予約のコツ", summary: "スムーズな予約のための完全マニュアル。", category: "howto" },
  { href: "/guide/fuzoku-beginner-checklist", title: "風俗初心者の持ち物チェックリスト｜忘れがちな準備まとめ", summary: "初めての風俗利用で必要な持ち物と準備。", category: "howto" },
  // 追加メンエス地域記事 (2026-04-13)
  { href: "/guide/chiba-menesu", title: "千葉メンエス完全ガイド｜船橋・柏エリアの特徴と選び方", summary: "千葉のメンエス事情と選び方。", category: "menesu" },
  { href: "/guide/saitama-menesu", title: "埼玉メンエス完全ガイド｜大宮・川口エリアの特徴", summary: "埼玉のメンエス事情を分析。", category: "menesu" },
  { href: "/guide/kyoto-menesu", title: "京都メンエス完全ガイド｜河原町・祇園エリアの特徴", summary: "古都・京都のメンエス事情を分析。", category: "menesu" },
  { href: "/guide/kawasaki-menesu", title: "川崎メンエス完全ガイド｜川崎駅周辺エリアの特徴", summary: "川崎のメンエス事情を分析。", category: "menesu" },
  { href: "/guide/nagoya-menesu-area", title: "名古屋メンエスエリア別ガイド｜栄・名駅・大須の特徴比較", summary: "名古屋のメンエスをエリア別に比較。", category: "menesu" },
  { href: "/guide/menesu-oil-guide", title: "メンエスのオイル施術ガイド｜種類・効果・楽しみ方", summary: "オイルの種類と効果を解説。", category: "menesu" },
  { href: "/guide/fuzoku-age-guide", title: "風俗嬢の年齢表記ガイド｜サバ読みの見分け方と実態", summary: "年齢サバ読みの実態と見分け方。", category: "column" },
  // 追加ハウツー記事 (2026-04-13 第2弾)
  { href: "/guide/deriheru-time-guide", title: "デリヘルの時間配分ガイド｜60分・90分・120分コースの過ごし方", summary: "各コースの時間配分と賢い過ごし方。", category: "howto" },
  { href: "/guide/fuzoku-discount-guide", title: "風俗の割引テクニック｜新規割・早朝割・イベントの活用法", summary: "お得に利用するための割引テクニック。", category: "howto" },
  { href: "/guide/fuzoku-free-guide", title: "フリー（指名なし）利用ガイド｜メリット・デメリットと活用法", summary: "フリー利用のメリットと注意点。", category: "howto" },
  { href: "/guide/fuzoku-option-guide", title: "風俗のオプション完全ガイド｜人気オプションと相場まとめ", summary: "オプションの種類と相場を解説。", category: "howto" },
  { href: "/guide/fuzoku-after-guide", title: "風俗利用後のアフターケア完全ガイド｜体調管理と注意点", summary: "利用後のケアと注意点を解説。", category: "howto" },
  { href: "/guide/deriheru-change-guide", title: "デリヘルのチェンジ・キャンセル完全ガイド｜ルールと注意点", summary: "チェンジのルールとマナーを解説。", category: "howto" },
  { href: "/guide/menesu-difference-guide", title: "メンエスの店舗型と出張型の違い｜それぞれのメリット比較", summary: "店舗型と出張型メンエスの違い。", category: "menesu" },
  { href: "/guide/fuzoku-review-guide", title: "風俗口コミの書き方ガイド｜参考になる口コミを投稿するコツ", summary: "口コミの効果的な書き方を解説。", category: "howto" },
  { href: "/guide/fuzoku-photo-diary-guide", title: "写メ日記でパネマジを見抜く上級テクニック10選", summary: "写メ日記からパネマジを見抜く技術。", category: "howto" },
  { href: "/guide/deriheru-area-guide", title: "デリヘルのエリア選びガイド｜繁華街 vs 郊外の違い", summary: "エリア選びのポイントを比較解説。", category: "howto" },
];

const categoryLabels = {
  area: "エリア別ガイド",
  howto: "ハウツー",
  column: "コラム",
  shop: "店舗別",
  special: "特集",
  compare: "比較・まとめ",
  menesu: "メンエス特集",
} as const;

const categoryColors = {
  area: "bg-blue-100 text-blue-700",
  howto: "bg-green-100 text-green-700",
  column: "bg-purple-100 text-purple-700",
  shop: "bg-orange-100 text-orange-700",
  special: "bg-red-100 text-red-700",
  compare: "bg-cyan-100 text-cyan-700",
  menesu: "bg-pink-100 text-pink-700",
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
  const menesuArticles = articles.filter((a) => a.category === "menesu");
  const specialArticles = articles.filter((a) => a.category === "special");
  const compareArticles = articles.filter((a) => a.category === "compare");
  const areaArticles = articles.filter((a) => a.category === "area");
  const howtoArticles = articles.filter((a) => a.category === "howto");
  const columnArticles = articles.filter((a) => a.category === "column");

  // Dynamic shop articles from DB
  let shopArticles: Article[] = [];
  try {
    const topShops = getTopShopsForArticles(20);
    shopArticles = topShops.map((shop) => ({
      href: `/guide/shop/${shop.id}`,
      title: `${shop.name}のパネマジ度・口コミまとめ`,
      summary: `${shop.area_name || ''}エリア。在籍${shop.girl_count || 0}人、口コミ${shop.review_count || 0}件。`,
      category: "shop" as const,
    }));
  } catch {
    // DB not available during build - empty is fine
  }

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

      {/* 店舗別ガイド */}
      {shopArticles.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-orange-500 rounded"></span>
            人気店舗のパネマジ解説
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {shopArticles.map((article) => (
              <ArticleCard key={article.href} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* メンエス特集 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-pink-500 rounded"></span>
          メンエス特集
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {menesuArticles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </div>
      </section>

      {/* 特集記事 */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-red-500 rounded"></span>
          特集記事
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {specialArticles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </div>
      </section>

      {/* 比較・まとめ */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-cyan-500 rounded"></span>
          比較・まとめ
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {compareArticles.map((article) => (
            <ArticleCard key={article.href} article={article} />
          ))}
        </div>
      </section>

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
