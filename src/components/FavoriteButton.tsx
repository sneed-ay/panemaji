'use client';

/**
 * 嬢ページに置く「気になる」ボタン
 *
 * 動作:
 *   - 未ログイン: クリックで /login?next= にリダイレクト
 *   - ログイン済: トグル (POST/DELETE)
 */
import { useEffect, useState } from 'react';
import { getMe } from '@/lib/client-fetch';

interface Props {
  girlId: number;
}

export default function FavoriteButton({ girlId }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [pending, setPending] = useState(false);

  // 2026-09-05: 以前は /api/favorites と /api/me を必ず両方叩いていた。
  // 訪問者のほとんどは未ログインなので、まず (ページ内で共有される) /api/me を見て、
  // 会員のときだけ /api/favorites を取りに行く。未ログインなら API は実質 0 本になる
  // (/api/me は他コンポーネントと共有)。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await getMe();
      if (cancelled) return;
      if (!me?.user) {
        setIsAuthed(false);
        setIsFav(false);
        setLoading(false);
        return;
      }
      setIsAuthed(true);
      // トグル直後に古い値を掴まないよう、ここは共有キャッシュを使わない
      const d = await fetch(`/api/favorites?girl_id=${girlId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (cancelled) return;
      setIsFav(!!d?.is_favorite);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [girlId]);

  async function toggle() {
    if (!isAuthed) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setPending(true);
    const method = isFav ? 'DELETE' : 'POST';
    const r = await fetch('/api/favorites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ girl_id: girlId }),
    });
    if (r.ok) setIsFav(!isFav);
    setPending(false);
  }

  if (loading) {
    return (
      <button disabled className="text-xs text-gray-400 px-3 py-1.5 rounded-full bg-gray-100">
        ★ 読み込み中…
      </button>
    );
  }

  if (!isAuthed) {
    return (
      <button
        onClick={toggle}
        className="text-xs px-3 py-1.5 rounded-full border border-pink-300 text-pink-600 bg-white hover:bg-pink-50"
        title="会員になると気になるが使えます"
      >
        ★ 気になる (会員限定)
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
        isFav
          ? 'bg-pink-600 text-white hover:bg-pink-700'
          : 'bg-white border border-pink-300 text-pink-600 hover:bg-pink-50'
      }`}
    >
      {isFav ? '★ 気になる登録済み' : '☆ 気になる'}
    </button>
  );
}
