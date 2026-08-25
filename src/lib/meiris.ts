/**
 * メール配信システム (meiris / mail.merokano.jp) 連携クライアント
 *
 * 仕様書: メーリスシステム/docs/パネマジ連携の指示書.md
 *
 * 🚨 同意状況の扱い (2026-08-25 ユーザー判断):
 *    未同意 (ad_opt_in=0) の会員も配信システムへ送る。誰に配信するかは配信システム側で
 *    目視管理する方針。リストとタグは指示書どおり「パネマジ」1種類のみで増やさない。
 *    同意状況は consent_source の文言にだけ載せる (リスト・タグは作らない)。
 *    → 配信システム側で広告メールを送る際は、同意者だけに送ること。
 *
 * 設計方針:
 * - この API の成否を会員登録の成否に波及させない (仕様書 6章)。例外は投げず結果オブジェクトを返す。
 * - suppressed (配信停止済み) は正常系。エラー扱いして再送しないこと (仕様書 3章)。
 * - 同一アドレスの再送は安全 (updated が返るだけ)。
 */

const ENDPOINT = 'https://mail.merokano.jp/api/contacts';
const PING_ENDPOINT = 'https://mail.merokano.jp/api/ping';
const TIMEOUT_MS = 10_000;

/** 1リクエストあたりの上限 (仕様書 2章: 501件以上は 400) */
export const MEIRIS_MAX_BATCH = 500;

/** パネマジ由来の連絡先。同意状況でリスト・タグ・同意元を出し分ける。 */
export interface MeirisContact {
  email: string;
  /** users.ad_opt_in = 1 (登録画面で広告メール受信に同意した) か */
  optedIn: boolean;
}

/** タグ・リストは指示書どおり「パネマジ」のみ (増やさない)。 */
const TAGS = ['パネマジ'];
const LIST = 'パネマジ';

function toPayload(c: MeirisContact) {
  return {
    email: c.email,
    tags: TAGS,
    list: LIST,
    // 同意状況はここにだけ載せる。新しいリスト・タグは作らない。
    consent_source: c.optedIn ? 'パネマジ会員登録（広告メール同意あり）' : 'パネマジ会員登録（広告メール同意なし）',
  };
}

export type MeirisStatus = 'created' | 'updated' | 'suppressed' | 'invalid';

export interface MeirisResult {
  email: string;
  status: MeirisStatus;
  message?: string;
}

export interface MeirisSummary {
  created: number;
  updated: number;
  suppressed: number;
  invalid: number;
}

export interface MeirisResponse {
  ok: boolean;
  summary: MeirisSummary;
  results: MeirisResult[];
}

export type MeirisOutcome =
  | { ok: true; response: MeirisResponse }
  /** retriable: 5xx / 接続失敗 = 時間をおいて再送してよい (仕様書 4章) */
  | { ok: false; retriable: boolean; status?: number; error: string };

export function isMeirisConfigured(): boolean {
  return !!process.env.MEIRIS_API_KEY;
}

async function post(body: unknown): Promise<MeirisOutcome> {
  const key = process.env.MEIRIS_API_KEY;
  if (!key) {
    return { ok: false, retriable: false, error: 'MEIRIS_API_KEY 未設定' };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (err) {
    // 接続失敗・タイムアウト = 相手側の一時障害。再送してよい。
    return { ok: false, retriable: true, error: err instanceof Error ? err.message : String(err) };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // 400 (JSON不正/501件以上) と 401 (キー不正) は再送しても直らない
    return { ok: false, retriable: res.status >= 500, status: res.status, error: text.slice(0, 300) };
  }

  try {
    return { ok: true, response: (await res.json()) as MeirisResponse };
  } catch (err) {
    return { ok: false, retriable: false, error: `レスポンスのJSON解析に失敗: ${String(err)}` };
  }
}

/** 1件登録 */
export function sendContact(contact: MeirisContact): Promise<MeirisOutcome> {
  return post(toPayload(contact));
}

/** まとめて登録。呼び出し側で MEIRIS_MAX_BATCH 以下に分割しておくこと。 */
export function sendContacts(contacts: MeirisContact[]): Promise<MeirisOutcome> {
  return post({ contacts: contacts.map(toPayload) });
}

/** 疎通確認 (副作用なし / 仕様書 5章) */
export async function ping(): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> {
  const key = process.env.MEIRIS_API_KEY;
  if (!key) return { ok: false, error: 'MEIRIS_API_KEY 未設定' };
  try {
    const res = await fetch(PING_ENDPOINT, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 200) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 1件の結果を「同期済とみなしてよいか」判定。
 * suppressed も「こちらから再送する必要がない」ため同期済扱いにする (再送すると停止済の人に届く)。
 */
export function isSettled(status: MeirisStatus): boolean {
  return status === 'created' || status === 'updated' || status === 'suppressed';
}
