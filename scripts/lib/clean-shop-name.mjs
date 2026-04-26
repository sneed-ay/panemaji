/**
 * 店舗名から営業ノイズを除去する共通ユーティリティ。
 * すべてのスクレイパー（scrape-menesu.mjs / scrape-cityheaven.mjs 等）が insert 直前に必ず通すこと。
 *
 * 方針: 「ほぼ間違いなく営業ノイズ」なパターンのみ削除する。判定が曖昧なら触らない。
 *  - 残す: 「○○店」「【宮崎店】」「【○○グループ】」「GAL☆PARADISE」等の正規店名
 *  - 削除: 「激安クーポン！」「【NEW OPEN】」「★★★装飾★★★」「-福岡で評判-」「、博多で人気」等
 */

// ─── 末尾サフィックス（販促語） ───
const SUFFIX_PATTERNS = [
  /の超割引クーポン$/,
  /の割引クーポン$/,
  /のクーポン$/,
  /超割引クーポン$/,
  /割引クーポン$/,
  /激安クーポン[！!]?$/,
  /激安割引[！!]?$/,
  /クーポン[！!]+$/,
  /のお得な?クーポン$/,
  /のお得な?情報$/,
  /Webで予約[！!]?$/i,
  /ネット予約[！!]?$/,
  /(?:絶賛)?営業中[！!]+$/,
  /24[H時]+営業[！!]?$/i,
];

// ─── 販促【】（位置問わず） ───
// 「【宮崎店】」「【○○グループ】」等の支店・グループ名は残す。
// 以下の販促キーワードを含む【】のみ削除。
const PROMO_BRACKET_RE =
  /【[^】]*?(激安|クーポン|NEW\s*OPEN|オープニング|オープン記念|期間限定|割引|セール|キャンペーン|フェア|ご新規|ご予約|お得|特典|無料体験|地域最安|超特価|大特価|当店人気|24[H時]+|24時間|今すぐ|急募|本日)[^】]*?】/gi;

// ─── 装飾の連続記号 ───
// 2個以上連続する★/☆/♡/♥/◆/◇/♪/♬ を空白に置換。
// 単独の ★/☆ は店名内装飾として残す。
const DECOR_REPEAT_RE = /[★☆♡♥◆◇♪♬◇◆]{2,}/g;

// ─── 先頭の販促タグ（「@群馬」「@東京」など、@ + 都道府県/エリア） ───
const LEADING_AT_TAG_RE = /^@[぀-ヿ一-鿿]{2,8}[\s☆★・]/;

// ─── 末尾の販促コピー（dash/dash付きキャッチコピー） ───
const TRAILING_AD_DASH_RE =
  /\s*[-―—]\s*[^-―—]*(評判|人気|デリヘル|ソープ|ヘルス|無料|予約|クーポン|割引|激安|キャンペーン|オススメ|おすすめ|当店|新人|大特価|早朝|営業中|オープン|急募|24時間|24[H]+|地域最安)[^-―—]*\s*[-―—]?$/;

// ─── 末尾のキャッチコピー（句読点 + 〇〇で〇〇 / 〇〇です！等） ───
const TRAILING_COPY_RE =
  /[、,]\s*[^、,]{2,40}(です[!！]?|ます[!！]?|ません[!！]?|ココです[!！]?|お店はココ[!！]?|あります[!！]?|オススメ[!！]?|おすすめ[!！]?|オープン[!！]?|営業中[!！]?|の風俗|で評判|で人気|で大人気|の輝き|の極み|の世界)[!！]?$/;

// ─── 全角空白セパレートのキャッチコピー判定 ───
// "テレジア横浜　初めて出会う、純粋な輝き" のような「店名 + 全角空白 + キャッチコピー」を、
// 後半が "店"/"本店"/"支店"/カナ別名/括弧 のいずれでもなく、句読点や宣伝語を含む場合に削除。
// 「ぐっすり山田　池袋店」「LUXE　リュクス」等は残す。
// 確実にキャッチコピー判定できる強い hype 語のみ
const STRONG_HYPE_RE = /(S級|級素人|級美女|最高(?:レベル|峰)|日本一|超低価格|超激安|大人気|N[oO]\.?\s*1|NO1|史上(?:最強|最高)|歴代最高|高級店|完全予約制|当店一押し|出会えるお店|秘蔵)/;
function splitFullwidthSpaceCatch(name) {
  // 末尾の全角空白で分割（複数トークンの場合、末尾trailing部分のみ判定対象に）
  const idx = name.lastIndexOf('　');
  if (idx === -1) return null;
  const head = name.slice(0, idx).trim();
  const tail = name.slice(idx + 1).trim();
  if (head.length < 2 || tail.length < 2) return null;
  // tailが「○○店」「本店」「支店」「号店」「校」 → 残す（支店表記）
  if (/(本店|支店|号店|新店|別館|駅前店|店|校)$/.test(tail) && tail.length <= 16) return null;
  // tailが括弧 (例: "(東京ハレ系)") → 残す
  if (/^[（\(].{1,18}[）\)]$/.test(tail)) return null;
  // tailが略称・別名・読み仮名 (15文字以内、カナ・英・記号 + 「～」「・」のみ)
  if (/^[ァ-ヿーA-Za-z0-9\s\-～〜・&]{1,15}$/.test(tail)) return null;
  // tailが「～○○～」括り（読み別名） → 残す
  if (/^[～〜].+[～〜]$/.test(tail)) return null;
  // tailが「業態名×記号」「業態名+記号」 → キャッチコピー → 削除
  // 例: "洗体×ヘルス", "ヘルス×アロマ"
  if (/[×＋＆]/.test(tail) && /(?:ヘルス|ソープ|デリヘル|エステ|アロマ|メンエス|ピンサロ|ホテヘル|ファッション)/.test(tail)) {
    return head;
  }
  // tailに「店」が含まれる（末尾でない、内部に店名がある） → 多分支店表記 → 残す
  if (/店/.test(tail)) return null;
  // 強い hype 語を含む → キャッチコピー → 削除
  if (STRONG_HYPE_RE.test(tail)) return head;
  // 句読点が複数ある＝長い文 → キャッチコピー → 削除
  const punctCount = (tail.match(/[、,。！!]/g) || []).length;
  if (punctCount >= 2) return head;
  // tail が 8 文字以上で句読点が1個以上 → 文っぽい → ad copy → 削除
  if (punctCount >= 1 && tail.length >= 8) return head;
  // tail 末尾が典型的 ad copy ワード → 削除
  if (/(?:輝き|世界|極み|魅力|物語|誘惑|プレイ|快感|出会い|楽園|天国|頂点|至福|シンデレラグループ|系専門|専門デリヘル|専門ヘルス|専門ソープ|専門メンエス|専門エステ|当店一押し|新感覚)$/.test(tail) && tail.length >= 5) {
    return head;
  }
  // tail が「○○系」で終わり、長め → カテゴリキャッチ → 削除
  if (/系$/.test(tail) && tail.length >= 6) return head;
  // それ以外 → 残す（誤判定回避）
  return null;
}

// ─── 末尾のエリア羅列（複数地名を中黒等で連ねたもの） ───
// 例: 「-高崎・前橋・伊勢崎・本庄・藤岡-」「【高崎・前橋・伊勢崎】」
// 中黒 or 「・」で2区切り以上の地名らしき文字列のブロックを削除
const TRAILING_AREA_LIST_RE =
  /[\s\-―—【\[]?[぀-ヿ一-鿿]{2,8}(?:[・/／][぀-ヿ一-鿿]{2,8}){2,}[\]】\-―—]?\s*$/;

// ─── タイトル区切り由来のノイズ ───
const TRAILING_SEPARATOR_RE = /\s*[｜|：:]\s*[^｜|：:]{0,40}$/;

/**
 * @param {string|null|undefined} raw 生の店舗名
 * @returns {string} クリーニング後の店舗名（空・1文字なら呼び側で破棄推奨）
 */
export function cleanShopName(raw) {
  if (!raw) return '';
  let name = String(raw).trim();
  const original = name;

  // 先頭の「-」やスペース除去
  name = name.replace(/^[-\s]+/, '');

  // 多段剥がし
  for (let i = 0; i < 5; i++) {
    const before = name;

    // 1. 販促【】を除去
    name = name.replace(PROMO_BRACKET_RE, '');

    // 2. 装飾連続記号を空白化
    name = name.replace(DECOR_REPEAT_RE, ' ');

    // 3. 先頭の販促タグ
    name = name.replace(LEADING_AT_TAG_RE, '');

    // 4. 末尾サフィックス
    for (const p of SUFFIX_PATTERNS) name = name.replace(p, '');

    // 5. 末尾の販促コピー(dash含む)
    name = name.replace(TRAILING_AD_DASH_RE, '');

    // 6. 末尾の句読点キャッチコピー
    name = name.replace(TRAILING_COPY_RE, '');

    // 6b. 全角空白セパレートのキャッチコピー
    const splitResult = splitFullwidthSpaceCatch(name);
    if (splitResult) name = splitResult;

    // 7. 末尾のエリア羅列（過剰削除を避けるため、結果が4文字以上残る場合のみ適用）
    const areaMatch = name.match(TRAILING_AREA_LIST_RE);
    if (areaMatch) {
      const head = name.slice(0, -areaMatch[0].length).trim();
      if (head.length >= 4) name = head;
    }

    // 8. タイトル区切り由来のノイズ
    const sepMatch = name.match(TRAILING_SEPARATOR_RE);
    if (sepMatch) {
      const head = name.slice(0, -sepMatch[0].length).trim();
      const tail = sepMatch[0].replace(/^[\s｜|：:]+/, '');
      if (head.length >= 2 && /クーポン|割引|セール|お得|特典|期間限定|予約|激安|キャンペーン|評判|人気/.test(tail)) {
        name = head;
      }
    }

    // 連続スペース・前後トリム
    name = name.replace(/\s+/g, ' ').trim();
    name = name.replace(/[\s｜|：:、,!！]+$/, '').trim();
    name = name.replace(/^[\s｜|：:、,!！]+/, '').trim();

    if (name === before) break;
  }

  // 過度に削った結果が短すぎる/空 → 元に戻す（破壊回避）
  if (!name || name.length < 2) return original.trim();

  return name;
}

/**
 * 呼び側テンプレ:
 *   const cleaned = cleanShopName(rawName);
 *   if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
 */
