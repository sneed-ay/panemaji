'use client';

import { useEffect, useState } from 'react';

interface Review {
  id: number; girl_id: number; visit_date: string; panel_rating: string; comment: string | null;
  created_at: string; girl_name: string; girl_image_url: string | null;
  shop_id: number; shop_name: string;
}
interface Favorite {
  girl_id: number; girl_name: string; girl_image_url: string | null;
  shop_id: number; shop_name: string; area_name: string;
  favorited_at: string;
}
interface User { id: number; email: string; created_at: string; }

export default function MyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [favorites, setFavorites] = useState<Favorite[] | null>(null);
  const [tab, setTab] = useState<'reviews' | 'favorites'>('reviews');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/me');
      const d = await r.json();
      if (!d.user) {
        window.location.href = '/login?next=/mypage';
        return;
      }
      setUser(d.user);
      const [revR, favR] = await Promise.all([
        fetch('/api/mypage/reviews').then((x) => x.json()),
        fetch('/api/mypage/favorites').then((x) => x.json()),
      ]);
      setReviews(revR.reviews || []);
      setFavorites(favR.favorites || []);
      setLoading(false);
    })();
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  async function removeFavorite(girlId: number) {
    if (!confirm('「気になる」から外しますか?')) return;
    const r = await fetch('/api/favorites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ girl_id: girlId }),
    });
    if (r.ok) setFavorites((prev) => (prev || []).filter((f) => f.girl_id !== girlId));
  }

  if (loading) {
    return <main className="min-h-screen p-6 text-center text-gray-500">読み込み中…</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-4">
          <h1 className="text-lg font-bold mb-1">マイページ</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
          <div className="flex gap-3 mt-3 text-xs text-gray-600">
            <span>口コミ: {reviews?.length ?? 0}</span>
            <span>気になる: {favorites?.length ?? 0}</span>
          </div>
          <button onClick={handleLogout} className="mt-3 text-xs text-gray-500 hover:text-pink-600 underline">
            ログアウト
          </button>
        </div>

        <div className="flex gap-1 mb-3 bg-white rounded-lg p-1 border border-gray-200">
          <button
            onClick={() => setTab('reviews')}
            className={`flex-1 text-sm py-2 rounded ${tab === 'reviews' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            自分の口コミ
          </button>
          <button
            onClick={() => setTab('favorites')}
            className={`flex-1 text-sm py-2 rounded ${tab === 'favorites' ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            気になる嬢
          </button>
        </div>

        {tab === 'reviews' ? (
          <div className="space-y-2">
            {reviews?.length === 0 && (
              <div className="text-center text-sm text-gray-500 p-8 bg-white rounded-lg">
                まだ口コミ投稿はありません
              </div>
            )}
            {reviews?.map((r) => (
              <a key={r.id} href={`/girl/${r.girl_id}`} className="block bg-white rounded-lg p-3 border border-gray-200 hover:border-pink-300 no-underline">
                <div className="flex gap-3">
                  {r.girl_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.girl_image_url} alt="" className="w-12 h-16 object-cover rounded" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.girl_name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.shop_name}</div>
                    <div className="text-[11px] mt-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded ${
                        r.panel_rating === 'panel_match' ? 'bg-green-100 text-green-800'
                        : r.panel_rating === 'panel_diff' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'}`}>
                        {r.panel_rating === 'panel_match' ? 'パネ通り' : r.panel_rating === 'panel_diff' ? '盛りすぎ' : '地雷'}
                      </span>
                      <span className="ml-2 text-gray-400">{r.created_at.slice(0, 10)}</span>
                    </div>
                    {r.comment && <div className="text-xs text-gray-700 mt-1 line-clamp-2">{r.comment}</div>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {favorites?.length === 0 && (
              <div className="text-center text-sm text-gray-500 p-8 bg-white rounded-lg">
                嬢の詳細ページで「気になる」ボタンを押すと、ここに保存されます
              </div>
            )}
            {favorites?.map((f) => (
              <div key={f.girl_id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-pink-300">
                <a href={`/girl/${f.girl_id}`} className="flex gap-3 no-underline">
                  {f.girl_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.girl_image_url} alt="" className="w-12 h-16 object-cover rounded" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{f.girl_name}</div>
                    <div className="text-xs text-gray-500 truncate">{f.shop_name}</div>
                    <div className="text-[11px] text-gray-400 mt-1">{f.area_name} · ★ {f.favorited_at.slice(0, 10)}</div>
                  </div>
                </a>
                <button
                  onClick={() => removeFavorite(f.girl_id)}
                  className="mt-2 text-[11px] text-gray-400 hover:text-red-500 underline"
                >
                  気になるを外す
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
