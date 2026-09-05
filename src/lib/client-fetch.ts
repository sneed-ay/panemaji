'use client';

/**
 * 同一ページ内で複数の client コンポーネントが同じ GET API を叩くのを 1 本にまとめる。
 *
 * 背景 (2026-09-05):
 *   嬢ページを 1 回開くと API が 8 本飛んでいた。
 *     /api/me           x4  (FavoriteButton / FeedbackButton / OneTabVote / ReviewForm / ContentLocker)
 *     /api/fanza?n=12   x3  (AdBanner が 1 ページに 3 枠)
 *     /api/favorites    x1
 *   GSC のクロール統計では、この JSON がクロールリクエスト全体の 38% (90日で 35.5万) を占めていた。
 *   本番は Render Starter (0.5CPU) + better-sqlite3 (同期実行) なので、
 *   1 リクエストごとに event loop が止まる。無駄な重複は素直にコストになる。
 *
 * 安全性:
 *   ログイン (AuthForm) もログアウト (mypage) も window.location.href による完全リロードなので、
 *   認証状態が変わるときは必ずモジュールごと破棄される。つまりこのキャッシュが
 *   古いログイン状態を持ち越すことはない。保険として TTL も入れてある。
 *   HTTP レスポンス自体は /api/me が Cache-Control: private, no-store のままで、
 *   ブラウザ/CDN にキャッシュさせる話ではない (2026-05-31 のキャッシュ汚染事故とは別物)。
 */

const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

/** 既定 TTL。ページ滞在中の重複呼び出しを潰すのが目的なので短くてよい。 */
const DEFAULT_TTL_MS = 30_000;

/**
 * 同じ URL の GET を共有する。失敗時は null を返す (呼び出し側で握り潰せるように)。
 * 失敗したレスポンスはキャッシュに残さず、次の呼び出しで再試行する。
 */
export function sharedGet<T>(url: string, ttlMs: number = DEFAULT_TTL_MS): Promise<T | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T | null>;

  const promise = fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null)
    .then((v) => {
      if (v === null) cache.delete(url); // 失敗は覚えない
      return v;
    });

  cache.set(url, { at: Date.now(), promise });
  return promise;
}

/** 認証状態を変えたあとなど、明示的に捨てたいとき。 */
export function invalidateShared(url?: string): void {
  if (url) cache.delete(url);
  else cache.clear();
}

/** GET /api/me のレスポンス (src/app/api/me/route.ts と対応) */
export interface MeResponse {
  user: { id: number; email: string; is_admin?: boolean } | null;
  stats: { reviews_count: number; favorites_count: number } | null;
  reviewed_recently?: boolean;
}

/** ログイン状態の取得。1 ページ内で何回呼んでも実際の fetch は 1 回。 */
export function getMe(): Promise<MeResponse | null> {
  return sharedGet<MeResponse>('/api/me');
}
