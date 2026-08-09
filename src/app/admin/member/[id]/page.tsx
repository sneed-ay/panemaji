'use client';

import { useEffect, useState } from 'react';

interface Review {
  id: number; girl_id: number; visit_date: string; panel_rating: string; comment: string | null;
  created_at: string; girl_name: string; girl_image_url: string | null;
  shop_id: number; shop_name: string;
}
interface Favorite {
  girl_id: number; girl_name: string; girl_image_url: string | null;
  shop_id: number; shop_name: string; area_name: string; favorited_at: string;
}
interface Member { id: number; email: string; created_at: string; last_login_at: string | null; }

/** SQLite の UTC 文字列 ("YYYY-MM-DD HH:MM:SS") を日本時間で表示 */
function jst(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s.slice(0, 16);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminMemberPage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<'loading' | 'forbidden' | 'notfound' | 'ok'>('loading');
  const [member, setMember] = useState<Member | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [tab, setTab] = useState<'reviews' | 'favorites'>('reviews');

  useEffect(() => {
    (async () => {
      let me: { user?: { is_admin?: boolean } | null } = {};
      try { me = await (await fetch('/api/me')).json(); } catch {}
      if (!me.user) { window.location.href = `/login?next=/admin/member/${params.id}`; return; }
      if (!me.user.is_admin) { setState('forbidden'); return; }
      try {
        const res = await fetch(`/api/admin/member/${params.id}`);
        if (res.status === 404) { setState('notfound'); return; }
        if (!res.ok) { setState('forbidden'); return; }
        const d = await res.json();
        setMember(d.member);
        setReviews(d.reviews || []);
        setFavorites(d.favorites || []);
        setState('ok');
      } catch { setState('forbidden'); }
    })();
  }, [params.id]);

  if (state === 'loading') return <main className="min-h-screen p-6 text-center text-gray-500">読み込み中…</main>;
  if (state === 'forbidden') return <main className="min-h-screen p-6 text-center text-red-600 font-medium">このページは管理者専用です</main>;
  if (state === 'notfound') return <main className="min-h-screen p-6 text-center text-gray-500">会員が見つかりません</main>;

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <a href="/admin" className="text-xs text-pink-600 hover:underline">← 管理画面に戻る</a>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-4 mt-2">
          <div className="text-[11px] text-gray-400 mb-1">会員 #{member?.id}（管理者表示）</div>
          <h1 className="text-base font-bold mb-2 break-all">{member?.email}</h1>
          <div className="text-xs text-gray-500">登録日時(JST): {jst(member?.created_at)}</div>
          <div className="text-xs text-gray-500">最終ログイン(JST): {jst(member?.last_login_at)}</div>
          <div className="flex gap-3 mt-3 text-xs text-gray-600">
            <span>口コミ: {reviews.length}</span>
            <span>気になる: {favorites.length}</span>
          </div>
        </div>

        <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 border border-gray-200">
          <button onClick={() => setTab('reviews')} className={`flex-1 text-sm py-2 rounded ${tab === 'reviews' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            投稿した口コミ ({reviews.length})
          </button>
          <button onClick={() => setTab('favorites')} className={`flex-1 text-sm py-2 rounded ${tab === 'favorites' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            気になる嬢 ({favorites.length})
          </button>
        </div>

        {tab === 'reviews' ? (
          <div className="space-y-2">
            {reviews.length === 0 && (
              <div className="text-center text-sm text-gray-500 p-8 bg-white rounded-lg">口コミ投稿はありません</div>
            )}
            {reviews.map((r) => (
              <a key={r.id} href={`/girl/${r.girl_id}`} className="block bg-white rounded-lg p-3 border border-gray-200 hover:border-pink-300 no-underline">
                <div className="flex gap-3">
                  {/* 嬢画像の全面停止(肖像権・ホットリンク対応 2026-08) */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.girl_name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.shop_name}</div>
                    <div className="text-[11px] mt-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded ${
                        r.panel_rating === 'panel_match' ? 'bg-green-100 text-green-800'
                        : r.panel_rating === 'panel_diff' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'}`}>
                        {r.panel_rating === 'panel_match' ? 'パネル通り' : r.panel_rating === 'panel_diff' ? '許せる' : '盛りすぎ'}
                      </span>
                      <span className="ml-2 text-gray-400">{jst(r.created_at)}</span>
                    </div>
                    {r.comment && <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{r.comment}</div>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.length === 0 && (
              <div className="text-center text-sm text-gray-500 p-8 bg-white rounded-lg">気になる登録はありません</div>
            )}
            {favorites.map((f) => (
              <a key={f.girl_id} href={`/girl/${f.girl_id}`} className="block bg-white rounded-lg p-3 border border-gray-200 hover:border-pink-300 no-underline">
                <div className="flex gap-3">
                  {/* 嬢画像の全面停止(肖像権・ホットリンク対応 2026-08) */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{f.girl_name}</div>
                    <div className="text-xs text-gray-500 truncate">{f.shop_name}</div>
                    <div className="text-[11px] text-gray-400 mt-1">{f.area_name} · ★ {jst(f.favorited_at)}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
