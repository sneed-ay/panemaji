/**
 * JSON-LD の dateModified 用: 「ページの内容が最後に変わった日」を求める。
 *
 * 🎯 2026-08-26 GSC/SERP 実測より:
 *   shop/girl ページは dateModified に last_seen_at (スクレイパーが最後に対象を見た日) を
 *   使っていた。取り込みが停滞しているため 店舗の72% / 嬢の93% が91日超となり、
 *   Google が SERP に数か月前の日付を表示して CTR を落としていた。
 *
 *   実例: /shop/6435 (ビギナーズ東京)
 *     SERP 表示  「2026/05/04 — ビギナーズ東京(池袋)の口コミ掲示板…」
 *     競合(爆サイ) 「2026/08/18 — …」
 *     しかし同ページには 2026-08-15 の口コミが載っていた。
 *
 *   「〜掲示板」「〜口コミ」は新しさが強く効くクエリなので、古い日付は直接クリックを削る。
 *
 * 口コミが1件増えればページの内容は実際に変わっているので、
 * max(last_seen_at, 最新口コミ日) を返すのは事実に即している。
 */

/** SQLite の "YYYY-MM-DD HH:MM:SS" と ISO 文字列の両方を受け付けて epoch ms にする */
function toTime(value: string | null | undefined): number {
  if (!value) return 0;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * 渡された日付候補のうち最も新しいものを ISO 8601 で返す。
 * 有効な候補が無ければ undefined（呼び出し側で dateModified を出さない）。
 */
export function latestContentDate(...candidates: (string | null | undefined)[]): string | undefined {
  const times = candidates.map(toTime).filter((t) => t > 0);
  if (times.length === 0) return undefined;
  return new Date(Math.max(...times)).toISOString();
}
