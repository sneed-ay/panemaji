/**
 * 店舗名の重複判定用 正規化関数
 *
 * 目的: 表記ゆれを徹底的に削って、別表記の同一店舗を「同じキー」に寄せる。
 * 用途:
 *   - 取込時の重複チェック（INSERT前のSELECTで使用）
 *   - 既存DBの重複統合（merge-duplicate-shops.mjs）
 *
 * 設計:
 *   - 攻撃的に削る（「ハニーコレクション」「ハニー・コレクション」「Honey Collection」を全部同じキーに）
 *   - 同名異店舗の見落としは prefecture / area で別途区別する前提
 *
 * cleanShopName() (clean-shop-name.mjs) との違い:
 *   - cleanShopName は表示用に「読める形」を残す（広告ノイズだけ削除）
 *   - normalizeShopName は判定キー専用（全部削って小文字、表示には使わない）
 */

const HIRAGANA_TO_KATAKANA = (s) =>
  s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

// ローマ字→カナ簡易変換は精度が悪いので入れない。代わりに「全角ローマ字も半角化」して比較する。

export function normalizeShopName(raw) {
  if (!raw) return '';
  let n = String(raw).normalize('NFKC').trim();

  // 1. 装飾記号・記号類を全削除（cleanShopNameより攻撃的）
  n = n.replace(/[★☆♡♥♦♢♪♬◆◇●○■□▲▽△▼※#＃@＠＊*&＆+＋=＝/／\\￥]/g, '');
  // 2. 中黒・ハイフン・波線・引用符類を削除
  n = n.replace(/[・･\-―—‐ーｰ~～〜!！?？.,，、。'"`’‘“”]/g, '');
  // 3. 括弧と中身を削除
  n = n.replace(/[（(\[【〔『「].*?[）)\]】〕』」]/g, '');
  // 4. スペース全削除
  n = n.replace(/[\s　]/g, '');
  // 5. ひらがな→カタカナ（ヘップバーンよりは原音重視）
  n = HIRAGANA_TO_KATAKANA(n);
  // 6. 「店」「本店」「支店」「号店」「別館」「本館」「分店」を末尾から削除
  for (let i = 0; i < 3; i++) {
    const before = n;
    n = n.replace(/(本店|支店|号店|新店|別館|本館|分店|店)$/, '');
    if (n === before) break;
  }
  // 7. 大小文字統一
  n = n.toLowerCase();
  return n;
}

/**
 * SQLで使うため、SQLite UDF として登録する関数
 * better-sqlite3 の db.function() で登録すると、SELECT/WHERE 内で normalize_shop(name) として使える
 */
export function registerNormalizeUdf(db) {
  db.function('normalize_shop', { deterministic: true }, (s) => normalizeShopName(s || ''));
}

/**
 * 呼び側テンプレ（取込時）:
 *   const key = normalizeShopName(rawName);
 *   const exists = db.prepare('SELECT id FROM shops WHERE normalize_shop(name) = ? AND area_id IN (SELECT id FROM areas WHERE prefecture=?)').get(key, pref);
 *   if (exists) skip;
 */
