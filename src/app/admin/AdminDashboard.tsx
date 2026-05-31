'use client';

import { useEffect, useState } from 'react';

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
interface MeResponse {
  user?: { id: number; email: string; is_admin?: boolean } | null;
}

export default function AdminDashboard() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'ok'>('loading');
  const [members, setMembers] = useState<Member[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

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
      setState('ok');
    })();
  }, []);

  if (state === 'loading') {
    return <main className="min-h-screen p-6 text-center text-gray-500">読み込み中…</main>;
  }
  if (state === 'forbidden') {
    return <main className="min-h-screen p-6 text-center text-red-600 font-medium">このページは管理者専用です</main>;
  }

  const stats: { label: string; value: number }[] = totals
    ? [
        { label: '会員数', value: totals.users },
        { label: 'アクティブsession', value: totals.sessions_active },
        { label: '会員口コミ', value: totals.member_reviews },
        { label: '気になる', value: totals.favorites },
      ]
    : [];

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-lg font-bold mb-3 text-gray-800">管理画面 — 会員リスト</h1>

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

        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">メール</th>
                <th className="text-left p-2">登録日</th>
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
                  <td className="p-2 text-gray-500 whitespace-nowrap">{(m.created_at || '').slice(0, 10)}</td>
                  <td className="p-2 text-gray-500 whitespace-nowrap">{m.last_login_at ? m.last_login_at.slice(0, 10) : '—'}</td>
                  <td className="p-2 text-right">{m.review_count}</td>
                  <td className="p-2 text-right">{m.favorite_count}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">会員がいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
