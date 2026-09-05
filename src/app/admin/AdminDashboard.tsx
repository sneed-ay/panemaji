'use client';

/**
 * 管理画面ダッシュボード
 *
 * 2026-09-06: スマホで実用にならなかったのを作り直した。
 *   - 会員/フィードバックとも6列の <table> を w-full で描いていたため、
 *     幅の狭い端末では各セルが1文字ずつ縦に折り返され判読不能だった
 *     (overflow-x-auto は w-full のテーブルでは発動しない)。
 *     → スマホはカード表示、sm 以上でテーブル、と切り替える。
 *   - 会員は3,344件を一度に描いていた。→ 検索 + 「もっと読む」に変更
 *     (API 側も LIMIT/OFFSET/q を受けるようにした)。
 *   - フィードバックは未対応が埋もれるので既定で「未対応のみ」に絞る。
 */

import { useEffect, useState, useCallback, useRef } from 'react';

interface Member {
  id: number;
  email: string;
  created_at: string;
  last_login_at: string | null;
  review_count: number;
  favorite_count: number;
}
interface Totals {
  users: number;
  sessions_active: number;
  total_reviews: number;
  member_reviews: number;
  favorites: number;
}
interface Feedback {
  id: number;
  target_type: 'shop' | 'girl';
  shop_id: number | null;
  girl_id: number | null;
  girl_shop_id: number | null;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
  user_email: string | null;
  shop_name: string | null;
  girl_name: string | null;
}
interface MeResponse {
  user?: { id: number; email: string; is_admin?: boolean } | null;
}

const REASON_LABEL: Record<string, string> = {
  closed: '閉店', departed: '退店', not_exist: '存在しない', wrong_info: '情報誤り', other: 'その他',
};
const REASON_CLASS: Record<string, string> = {
  closed: 'bg-red-100 text-red-700',
  departed: 'bg-amber-100 text-amber-700',
  not_exist: 'bg-red-100 text-red-700',
  wrong_info: 'bg-orange-100 text-orange-700',
  other: 'bg-sky-100 text-sky-700',
};

const PAGE = 100;

/** SQLite の UTC 文字列 ("YYYY-MM-DD HH:MM:SS") を日本時間で表示 */
function jst(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return (s || '').slice(0, 16);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
/** スマホ用の短い日付 (年を落とす) */
function jstShort(s: string | null | undefined): string {
  const full = jst(s);
  return full === '—' ? full : full.replace(/^\d{4}\//, '');
}

export default function AdminDashboard() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'ok'>('loading');
  const [tab, setTab] = useState<'members' | 'feedback'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [matched, setMatched] = useState(0);
  const [query, setQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const reqSeq = useRef(0);

  const loadMembers = useCallback(async (q: string, offset: number) => {
    const seq = ++reqSeq.current;
    const url = `/api/admin/members?limit=${PAGE}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    try {
      const d = await (await fetch(url)).json();
      if (seq !== reqSeq.current) return; // 古いリクエストの結果は捨てる
      const list = (d.members as Member[]) || [];
      setMembers((prev) => (offset === 0 ? list : [...prev, ...list]));
      setMatched(d.matched || 0);
      if (d.totals) setTotals(d.totals as Totals);
    } catch { /* noop */ }
  }, []);

  const loadFeedback = useCallback(async () => {
    try {
      const d = await (await fetch('/api/admin/feedback')).json();
      setFeedback((d.feedback as Feedback[]) || []);
      setOpenCount(d.open_count || 0);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    (async () => {
      let me: MeResponse = {};
      try { me = (await (await fetch('/api/me')).json()) as MeResponse; } catch {}
      if (!me.user) { window.location.href = '/login?next=/admin'; return; }
      if (!me.user.is_admin) { setState('forbidden'); return; }
      await loadMembers('', 0);
      await loadFeedback();
      setState('ok');
    })();
  }, [loadMembers, loadFeedback]);

  // 検索は入力が落ち着いてから投げる
  useEffect(() => {
    if (state !== 'ok') return;
    const t = setTimeout(() => { loadMembers(query, 0); }, 300);
    return () => clearTimeout(t);
  }, [query, state, loadMembers]);

  const resolve = useCallback(async (id: number, status: 'resolved' | 'open') => {
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    setOpenCount((c) => c + (status === 'resolved' ? -1 : 1));
    try {
      await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    } catch { /* noop */ }
  }, []);

  if (state === 'loading') return <main className="min-h-screen p-6 text-center text-gray-500">読み込み中…</main>;
  if (state === 'forbidden') return <main className="min-h-screen p-6 text-center text-red-600 font-medium">このページは管理者専用です</main>;

  const stats: { label: string; value: number }[] = totals
    ? [
        { label: '会員数', value: totals.users },
        { label: '累計口コミ', value: totals.total_reviews },
        { label: '会員口コミ', value: totals.member_reviews },
        { label: '気になる', value: totals.favorites },
        { label: 'アクティブsession', value: totals.sessions_active },
      ]
    : [];

  function targetLink(f: Feedback) {
    if (f.target_type === 'shop' && f.shop_id) return { href: `/shop/${f.shop_id}`, label: f.shop_name || `店 #${f.shop_id}` };
    if (f.target_type === 'girl' && f.girl_id) return { href: `/girl/${f.girl_id}`, label: f.girl_name || `嬢 #${f.girl_id}` };
    return { href: '#', label: '—' };
  }

  const shownFeedback = onlyOpen ? feedback.filter((f) => f.status === 'open') : feedback;

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-3xl mx-auto p-3 sm:p-4">
        <h1 className="text-lg font-bold mb-3 text-gray-800">管理画面</h1>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                <div className="text-[11px] leading-tight text-gray-500">{s.label}</div>
                <div className="text-xl font-bold text-gray-800">{s.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* タブ (スマホでは横幅いっぱいに) */}
        <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 border border-gray-200">
          <button
            onClick={() => setTab('members')}
            className={`flex-1 text-sm px-3 py-2 rounded ${tab === 'members' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            会員 ({totals?.users ?? 0})
          </button>
          <button
            onClick={() => setTab('feedback')}
            className={`flex-1 text-sm px-3 py-2 rounded ${tab === 'feedback' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            フィードバック{openCount > 0 ? ` (未${openCount})` : ''}
          </button>
        </div>

        {/* ───────────── 会員 ───────────── */}
        {tab === 'members' && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <input
                type="search"
                inputMode="email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="メールアドレスで検索"
                className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-xs text-gray-500 px-2 py-2 whitespace-nowrap">
                  クリア
                </button>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {matched.toLocaleString()} 件中 {members.length.toLocaleString()} 件を表示
            </div>

            {/* スマホ: カード */}
            <ul className="sm:hidden space-y-2">
              {members.map((m) => (
                <li key={m.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <a href={`/admin/member/${m.id}`} className="text-pink-700 font-medium underline break-all text-sm">
                    {m.email}
                  </a>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-gray-400">登録</dt>
                    <dd className="text-gray-600 text-right">{jstShort(m.created_at)}</dd>
                    <dt className="text-gray-400">最終ログイン</dt>
                    <dd className="text-gray-600 text-right">{jstShort(m.last_login_at)}</dd>
                    <dt className="text-gray-400">口コミ / 気になる</dt>
                    <dd className="text-gray-800 text-right font-medium">{m.review_count} / {m.favorite_count}</dd>
                  </dl>
                </li>
              ))}
              {members.length === 0 && (
                <li className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400 text-sm">
                  該当する会員がいません
                </li>
              )}
            </ul>

            {/* PC: テーブル */}
            <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left p-2">メール</th>
                    <th className="text-left p-2">登録日時(JST)</th>
                    <th className="text-left p-2">最終ログイン(JST)</th>
                    <th className="text-right p-2">口コミ</th>
                    <th className="text-right p-2">気になる</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-t border-gray-100 hover:bg-pink-50">
                      <td className="p-2 break-all">
                        <a href={`/admin/member/${m.id}`} className="text-pink-700 underline hover:text-pink-900">
                          {m.email}
                        </a>
                      </td>
                      <td className="p-2 text-gray-500 whitespace-nowrap">{jst(m.created_at)}</td>
                      <td className="p-2 text-gray-500 whitespace-nowrap">{jst(m.last_login_at)}</td>
                      <td className="p-2 text-right">{m.review_count}</td>
                      <td className="p-2 text-right">{m.favorite_count}</td>
                    </tr>
                  ))}
                  {members.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">該当する会員がいません</td></tr>}
                </tbody>
              </table>
            </div>

            {members.length < matched && (
              <button
                onClick={async () => { setLoadingMore(true); await loadMembers(query, members.length); setLoadingMore(false); }}
                disabled={loadingMore}
                className="mt-3 w-full text-sm bg-white border border-gray-300 rounded-lg py-2.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? '読み込み中…' : `さらに ${Math.min(PAGE, matched - members.length)} 件を読み込む`}
              </button>
            )}
          </>
        )}

        {/* ───────────── フィードバック ───────────── */}
        {tab === 'feedback' && (
          <>
            <div className="mb-2 flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setOnlyOpen(true)}
                className={`flex-1 text-xs px-3 py-2 rounded ${onlyOpen ? 'bg-gray-800 text-white' : 'text-gray-600'}`}
              >
                未対応 ({openCount})
              </button>
              <button
                onClick={() => setOnlyOpen(false)}
                className={`flex-1 text-xs px-3 py-2 rounded ${!onlyOpen ? 'bg-gray-800 text-white' : 'text-gray-600'}`}
              >
                すべて ({feedback.length})
              </button>
            </div>

            {/* スマホ: カード */}
            <ul className="sm:hidden space-y-2">
              {shownFeedback.map((f) => {
                const t = targetLink(f);
                return (
                  <li key={f.id} className={`bg-white rounded-lg border border-gray-200 p-3 ${f.status === 'resolved' ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded ${REASON_CLASS[f.reason] || 'bg-gray-100 text-gray-700'}`}>
                        {REASON_LABEL[f.reason] || f.reason}
                      </span>
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">{jstShort(f.created_at)}</span>
                    </div>
                    <a href={t.href} className="mt-2 block text-sm text-blue-600 underline break-words">
                      {f.target_type === 'shop' ? '🏬' : '👤'} {t.label}
                    </a>
                    {f.detail && <p className="mt-1.5 text-xs text-gray-700 whitespace-pre-wrap break-words">{f.detail}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-400 break-all min-w-0">{f.user_email || '—'}</span>
                      {f.status === 'open' ? (
                        <button onClick={() => resolve(f.id, 'resolved')} className="shrink-0 text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                          解決にする
                        </button>
                      ) : (
                        <button onClick={() => resolve(f.id, 'open')} className="shrink-0 text-xs text-gray-400 underline">未対応に戻す</button>
                      )}
                    </div>
                  </li>
                );
              })}
              {shownFeedback.length === 0 && (
                <li className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400 text-sm">
                  {onlyOpen ? '未対応のフィードバックはありません' : 'フィードバックはありません'}
                </li>
              )}
            </ul>

            {/* PC: テーブル */}
            <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left p-2">日時</th>
                    <th className="text-left p-2">種類</th>
                    <th className="text-left p-2">対象</th>
                    <th className="text-left p-2">詳細</th>
                    <th className="text-left p-2">報告者</th>
                    <th className="text-right p-2">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {shownFeedback.map((f) => {
                    const t = targetLink(f);
                    return (
                      <tr key={f.id} className={`border-t border-gray-100 ${f.status === 'resolved' ? 'opacity-50' : ''}`}>
                        <td className="p-2 text-gray-500 whitespace-nowrap">{jst(f.created_at)}</td>
                        <td className="p-2">
                          <span className={`inline-block text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${REASON_CLASS[f.reason] || 'bg-gray-100 text-gray-700'}`}>
                            {REASON_LABEL[f.reason] || f.reason}
                          </span>
                        </td>
                        <td className="p-2"><a href={t.href} className="text-blue-600 hover:underline break-words">{f.target_type === 'shop' ? '🏬' : '👤'} {t.label}</a></td>
                        <td className="p-2 text-gray-700 break-words">{f.detail || '—'}</td>
                        <td className="p-2 text-gray-400 break-all">{f.user_email || '—'}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {f.status === 'open' ? (
                            <button onClick={() => resolve(f.id, 'resolved')} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">解決にする</button>
                          ) : (
                            <button onClick={() => resolve(f.id, 'open')} className="text-xs text-gray-400 hover:text-gray-600 underline">戻す</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {shownFeedback.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">{onlyOpen ? '未対応のフィードバックはありません' : 'フィードバックはありません'}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
