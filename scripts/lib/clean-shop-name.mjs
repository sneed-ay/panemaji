/**
 * 店舗名から「の超割引クーポン」などスクレイプで混入する営業用サフィックスを除去する共通ユーティリティ。
 * すべてのスクレイパー（scrape-menesu.mjs 等）が insert 直前に必ず通すこと。
 *
 * 方針: 「名前の末尾についているとほぼ間違いなく営業ノイズ」なパターンのみ列挙する。
 * 「キャンペーン」「フェア」「セール」等は正規の店名（例: フェアリー大宮）とぶつかるので**扱わない**。
 */

const SUFFIX_PATTERNS = [
  /の超割引クーポン$/,
  /の割引クーポン$/,
  /のクーポン$/,
  /超割引クーポン$/,
  /割引クーポン$/,
  /のお得な?クーポン$/,
  /のお得な?情報$/,
];

/** タイトル区切り文字で残っているノイズを最終的に切り落とす */
const TRAILING_SEPARATOR_RE = /\s*[｜|：:]\s*[^｜|：:]{0,30}$/;

/**
 * @param {string|null|undefined} raw 生の店舗名
 * @returns {string} クリーニング後の店舗名（空になったら空文字を返すので呼び側で長さチェック推奨）
 */
export function cleanShopName(raw) {
  if (!raw) return '';
  let name = String(raw).trim();

  // 先頭の「-」やスペース除去
  name = name.replace(/^[-\s]+/, '');

  // サフィックス除去（ループで多段剥がし: 例 "店名のクーポン" → "店名"）
  for (let i = 0; i < 3; i++) {
    const before = name;
    for (const p of SUFFIX_PATTERNS) name = name.replace(p, '');
    name = name.replace(/\s+$/, '');
    if (name === before) break;
  }

  // まだタイトル由来の「｜○○」が残っていたら剥がす
  // ただし過度な切り詰めを避けるため、残る部分が 2 文字以上の場合のみ
  const m = name.match(TRAILING_SEPARATOR_RE);
  if (m) {
    const head = name.slice(0, -m[0].length).trim();
    const tail = m[0].replace(/^[\s｜|：:]+/, '');
    // 末尾側が「クーポン」「割引」等の営業語を含む場合のみ切る
    if (head.length >= 2 && /クーポン|割引|セール|お得|特典|期間限定|予約/.test(tail)) {
      name = head;
    }
  }

  // 末尾にセパレータだけ残っている場合（例: "SHOP｜"）は剥がす
  name = name.replace(/[\s｜|：:]+$/, '');

  return name.trim();
}

/**
 * 呼び側テンプレ:
 *   const cleaned = cleanShopName(rawName);
 *   if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
 */
