/**
 * メール配信システムへの連絡先同期 (未送信ぶんの送信 / 取りこぼし回収)
 *
 * 対象は meiris_synced_at IS NULL の会員 (同意の有無を問わず全員)。
 * 2026-08-25 ユーザー判断で未同意者も送る方針。ただし ad_opt_in の値は
 * リスト・タグに反映するので、配信システム側で同意者だけに配信できる。
 *
 * 会員登録時 (api/auth/register) と管理エンドポイント (api/admin/meiris-sync) の両方から呼ぶ。
 * 登録フックは sinceDays=7 を付けて呼ぶため、新規会員に加えて「直近7日ぶんの取りこぼし」だけを
 * 自動回収する (仕様書 7章の再送の代わり)。過去の同意会員へのまとめ送りは、管理エンドポイントを
 * 明示的に叩いたときだけ行う。重複送信は updated が返るだけで安全。
 */
import db from '@/lib/db';
import {
  sendContacts,
  type MeirisContact,
  isSettled,
  isMeirisConfigured,
  MEIRIS_MAX_BATCH,
  type MeirisSummary,
  type MeirisStatus,
} from '@/lib/meiris';

export interface PendingCounts {
  users: number;
  opted_in: number;
  not_opted_in: number;
  already_synced: number;
  pending: number;
  pending_opted_in: number;
  pending_not_opted_in: number;
}

export interface FlushReport {
  skipped?: 'not_configured' | 'nothing_to_send';
  attempted: number;
  marked_synced: number;
  summary: MeirisSummary;
  failures: { email: string; status?: MeirisStatus; message?: string }[];
  batch_errors: { batch: number; retriable: boolean; status?: number; error: string }[];
}

export function countPending(): PendingCounts {
  return db
    .prepare(
      `SELECT
         COUNT(*) AS users,
         SUM(CASE WHEN ad_opt_in = 1 THEN 1 ELSE 0 END) AS opted_in,
         SUM(CASE WHEN ad_opt_in = 0 THEN 1 ELSE 0 END) AS not_opted_in,
         SUM(CASE WHEN meiris_synced_at IS NOT NULL THEN 1 ELSE 0 END) AS already_synced,
         SUM(CASE WHEN meiris_synced_at IS NULL THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN ad_opt_in = 1 AND meiris_synced_at IS NULL THEN 1 ELSE 0 END) AS pending_opted_in,
         SUM(CASE WHEN ad_opt_in = 0 AND meiris_synced_at IS NULL THEN 1 ELSE 0 END) AS pending_not_opted_in
       FROM users`
    )
    .get() as PendingCounts;
}

/**
 * 送信対象を選ぶ。
 * @param sinceDays 指定すると「直近N日に登録した会員」に限定する。
 *   会員登録フックはこれを付けて呼ぶ。付けないと初回実行時に過去の同意会員を
 *   一括送信してしまい、意図しないまとめ送りになるため (まとめ送りは管理画面から明示的に行う)。
 */
export interface SyncTarget {
  id: number;
  email: string;
  ad_opt_in: number;
}

export function selectTargets(limit: number, resend = false, sinceDays?: number): SyncTarget[] {
  const conds: string[] = [];
  if (!resend) conds.push('meiris_synced_at IS NULL');
  if (sinceDays != null) conds.push(`created_at >= datetime('now', '-${Math.floor(sinceDays)} days')`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db
    .prepare(
      `SELECT id, email, ad_opt_in FROM users
        ${where}
        ORDER BY created_at ASC
        LIMIT ?`
    )
    .all(limit) as SyncTarget[];
}

function toContact(t: SyncTarget): MeirisContact {
  return { email: t.email, optedIn: t.ad_opt_in === 1 };
}

export async function flushPending(
  opts: { limit?: number; resend?: boolean; sinceDays?: number } = {}
): Promise<FlushReport> {
  const empty: FlushReport = {
    attempted: 0,
    marked_synced: 0,
    summary: { created: 0, updated: 0, suppressed: 0, invalid: 0 },
    failures: [],
    batch_errors: [],
  };
  if (!isMeirisConfigured()) return { ...empty, skipped: 'not_configured' };

  const limit = Math.min(Math.max(opts.limit ?? MEIRIS_MAX_BATCH, 1), 20000);
  const targets = selectTargets(limit, opts.resend, opts.sinceDays);
  if (targets.length === 0) return { ...empty, skipped: 'nothing_to_send' };

  const markSynced = db.prepare('UPDATE users SET meiris_synced_at = ? WHERE id = ?');
  const report: FlushReport = { ...empty, attempted: targets.length };

  for (let i = 0; i < targets.length; i += MEIRIS_MAX_BATCH) {
    const chunk = targets.slice(i, i + MEIRIS_MAX_BATCH);
    const outcome = await sendContacts(chunk.map(toContact));

    if (!outcome.ok) {
      // meiris_synced_at は NULL のまま残す → 次回の呼び出しで再送される
      report.batch_errors.push({
        batch: i / MEIRIS_MAX_BATCH + 1,
        retriable: outcome.retriable,
        status: outcome.status,
        error: outcome.error,
      });
      if (!outcome.retriable) break; // 400/401 は繰り返しても直らない
      continue;
    }

    const byEmail = new Map(outcome.response.results?.map((r) => [r.email.toLowerCase(), r]) ?? []);
    const now = new Date().toISOString();
    const tx = db.transaction((rows: SyncTarget[]) => {
      for (const row of rows) {
        const r = byEmail.get(row.email.toLowerCase());
        if (!r) continue;
        report.summary[r.status] = (report.summary[r.status] ?? 0) + 1;
        // suppressed(配信停止済) も同期済に倒す。再送すると停止した人へまた届く。
        if (isSettled(r.status)) {
          markSynced.run(now, row.id);
          report.marked_synced++;
        } else {
          report.failures.push({ email: row.email, status: r.status, message: r.message });
        }
      }
    });
    tx(chunk);
  }

  return report;
}
