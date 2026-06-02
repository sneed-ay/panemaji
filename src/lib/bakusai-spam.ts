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

  // 🚨 爆サイbotの正体は「パネマジ掲示板」(掲示板の宣伝) の1字マスク変種。
  //    「パネマジ」単独はサイトの核心用語(パネル写真と実物の差)で、本物口コミが多用するため
  //    判定基準にしない。旧実装は「パネマジ」単独で爆サイ判定し、本物口コミを誤ブロック/破棄していた。
  //    → 「掲示板」(掲示板の宣伝) の文脈でのみ判定する。
  //    口コミ投稿は会員限定化済みなので、これは defense-in-depth (主防御は member-gating)。

  // 1. 「掲示板」そのまま + 1字マスク変種 (掲◯板 / ◯示板 / 掲示◯)
  if (/掲示板|掲.板|.示板|掲示./u.test(c)) return true;

  // 2. ブランド変種 (Latin / 半角カナ / 区切り) かつ 掲示板の文脈があるもの
  const brand = /panemaji/i.test(c) || c.includes('ﾊﾟﾈﾏｼﾞ') || /パ.?ネ.?マ.?ジ/u.test(c);
  if (brand && /(bbs|board|掲|板|示)/i.test(c)) return true;

  return false;
}
