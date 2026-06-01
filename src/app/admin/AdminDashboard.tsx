'use client';

import { useEffect, useState, useCallback } from 'react';

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

export default function AdminDashboard() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'ok'>('loading');
  const [tab, setTab] = useState<'members' | 'feedback'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [openCount, setOpenCount] = useState(0);

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
      try {
        const d = await (await fetch('/api/admin/members')).json();
        setMembers((d.members as Member[]) || []);
        setTotals((d.totals as Totals) || null);
      } catch {}
      await loadFeedback();
      setState('ok');
    })();
  }, [loadFeedback]);

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
        { label: 'アクティブsession', value: totals.sessions_active },
        { label: '会員口コミ', value: totals.member_reviews },
        { label: '気になる', value: totals.favorites },
      ]
    : [];

  function targetLink(f: Feedback) {
    if (f.target_type === 'shop' && f.shop_id) return { href: `/shop/${f.shop_id}`, label: f.shop_name || `店 #${f.shop_id}` };
    if (f.target_type === 'girl' && f.girl_id) return { href: `/girl/${f.girl_id}`, label: f.girl_name || `嬢 #${f.girl_id}` };
    return { href: '#', label: '—' };
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-lg font-bold mb-3 text-gray-800">管理画面</h1>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="text-xl font-bold text-gray-800">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* タブ */}
        <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 border border-gray-200 w-fit">
          <button onClick={() => setTab('members')} className={`text-sm px-4 py-1.5 rounded ${tab === 'members' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            会員リスト ({members.length})
          </button>
          <button onClick={() => setTab('feedback')} className={`text-sm px-4 py-1.5 rounded ${tab === 'feedback' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            フィードバック{openCount > 0 ? ` (未対応${openCount})` : ''}
          </button>
        </div>

        {tab === 'members' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">メール</th>
                  <th className="text-left p-2">登録日時</th>
                  <th className="text-left p-2">最終ログイン</th>
                  <th className="text-right p-2">口コミ</th>
                  <th className="text-right p-2">気になる</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="p-2 text-gray-400">{i + 1}</td>
                    <td className="p-2 text-gray-800 break-all">{m.email}</td>
                    <td className="p-2 text-gray-500 whitespace-nowrap">{(m.created_at || '').slice(0, 16)}</td>
                    <td className="p-2 text-gray-500 whitespace-nowrap">{m.last_login_at ? m.last_login_at.slice(0, 16) : '—'}</td>
                    <td className="p-2 text-right">{m.review_count}</td>
                    <td className="p-2 text-right">{m.favorite_count}</td>
                  </tr>
                ))}
                {members.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">会員がいません</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'feedback' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
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
                {feedback.map((f) => {
                  const t = targetLink(f);
                  return (
                    <tr key={f.id} className={`border-t border-gray-100 ${f.status === 'resolved' ? 'opacity-50' : ''}`}>
                      <td className="p-2 text-gray-500 whitespace-nowrap">{(f.created_at || '').slice(0, 16)}</td>
                      <td className="p-2"><span className="inline-block bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded">{REASON_LABEL[f.reason] || f.reason}</span></td>
                      <td className="p-2"><a href={t.href} className="text-blue-600 hover:underline break-all">{f.target_type === 'shop' ? '🏬' : '👤'} {t.label}</a></td>
                      <td className="p-2 text-gray-700 break-all">{f.detail || '—'}</td>
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
                {feedback.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">フィードバックはありません</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
