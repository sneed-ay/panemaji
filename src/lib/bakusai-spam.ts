/**
 * 爆サイ自己言及スパム検出 (single source of truth)
 *
 * 自動化ジョブ/bakusai-panemaji-posting/master-v6.mjs のボットが
 * BASE_KEYWORD='パネマジ掲示板'(7字) の "1字だけ" をマスク文字 (◯●○◎★☆♥… 等) に
 * 置換して投稿する。1字しかマスクしないため 'パネマジ' か '掲示板' のどちらかは必ず無傷。
 * これを panemaji の口コミに replay した「自己言及スパム」を検出する。
 *
 * 用途:
 *   - POST /api/reviews の ingestion ブロック (再流入の恒久阻止)
 *   - /api/admin/purge-bot-by-content の検出ロジックと一致させる
 *
 * 一般の嬢レビューが自サイト名 (パネマジ/掲示板) を書くことはまず無いため
 * 誤検出は限りなく低い (万一の誤検出も purge 対象と同等で許容範囲)。
 */
export function isBakusaiSpam(comment: string | null | undefined): boolean {
  if (!comment || typeof comment !== 'string') return false;
  const c = comment;

  // 1. ブランド名そのまま (無傷)
  if (c.includes('パネマジ')) return true;
  if (c.includes('掲示板')) return true;

  // 2. minimal-texts.json のブランド変種 (Latin / 半角カナ / 区切り)
  if (/panemaji/i.test(c)) return true;            // brand_latin
  if (c.includes('ﾊﾟﾈﾏｼﾞ')) return true;            // brand_kana_half
  if (/パ.ネ.マ.ジ/u.test(c)) return true;          // brand_punctuated: パ・ネ・マ・ジ / パ.ネ.マ.ジ / パ ネ マ ジ

  // 3. 'パネマジ' 部の文字伏せ + '掲示板'/'示板' (パ◯マジ掲示板 等)
  const hasPanemajiPartial = c.includes('パネマ') || c.includes('ネマジ');
  const hasBbs = c.includes('掲') && c.includes('板');
  if (hasPanemajiPartial && hasBbs) return true;

  // 4. パ◯マジ / パネ◯ジ / パネマ◯ / ◯ネマジ のような中1文字置換 + 掲示板の痕跡
  if (/パ.マジ|パネ.ジ|パネマ.|.ネマジ/u.test(c) && (c.includes('板') || c.includes('示'))) return true;

  // 5. 短文 (60字以下) で「掲」「板」両方 = bot 寄り (掲示板部マスク '掲◯板' 等を捕捉)
  if (c.length <= 60 && c.includes('掲') && c.includes('板')) return true;

  return false;
}
