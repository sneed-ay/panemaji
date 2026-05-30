'use client';

/**
 * 嬢ページに置く「気になる」ボタン
 *
 * 動作:
 *   - 未ログイン: クリックで /login?next= にリダイレクト
 *   - ログイン済: トグル (POST/DELETE)
 */
import { useEffect, useState } from 'react';

interface Props {
  girlId: number;
}

export default function FavoriteButton({ girlId }: Props) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/favorites?girl_id=${girlId}`);
      const d = await r.json();
      setIsAuthed(!!('is_favorite' in d) && d.user !== null);
      // user フィールドは GET /api/favorites が未ログインの場合だけ null を返す
      // 簡易判定: error がなく is_favorite が boolean なら ok
      setIsFav(!!d.is_favorite);
      // 認証状態は /api/me で正確に取りたいが、コスト削減で /api/favorites の蹴られ方で判断
      // しっかり判定するため /api/me を別途叩く
      const me = await fetch('/api/me').then((x) => x.json()).catch(() => ({ user: null }));
      setIsAuthed(!!me.user);
      setLoading(false);
    })();
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
