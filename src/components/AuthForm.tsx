'use client';

import { useState } from 'react';

interface Props {
  mode: 'login' | 'signup';
}

export default function AuthForm({ mode }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = isSignup ? '/api/auth/register' : '/api/auth/login';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          data.error === 'email_taken' ? 'このメアドは既に登録済みです'
          : data.error === 'invalid_credentials' ? 'メアドかパスワードが違います'
          : data.error === 'invalid_email' ? 'メアドの形式が正しくありません'
          : data.error === 'invalid_password' ? 'パスワードは8文字以上にしてください'
          : data.error === 'rate_limit' ? '試行回数が多すぎます。少し時間を空けて再度お試しください'
          : data.message || `エラー (${r.status})`;
        setError(msg);
        return;
      }
      // 成功 → リダイレクト先 (?next=) があれば優先、なければ /mypage
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      window.location.href = next || '/mypage';
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-1">{isSignup ? '新規会員登録' : 'ログイン'}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {isSignup
          ? 'メアドとパスワードだけで30秒登録 (メアド認証なし)'
          : '会員ログイン'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">メアド</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
            placeholder="example@panemaji.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            パスワード <span className="text-gray-400">(8文字以上)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white font-medium text-sm rounded-lg py-2.5 transition-colors"
        >
          {loading ? '送信中…' : isSignup ? '会員登録する (無料)' : 'ログイン'}
        </button>
      </form>

      <div className="text-center mt-4">
        {isSignup ? (
          <a href="/login" className="text-xs text-pink-600 hover:underline">
            既にアカウントをお持ちの方はこちら
          </a>
        ) : (
          <a href="/signup" className="text-xs text-pink-600 hover:underline">
            まだアカウントをお持ちでない方はこちら (無料登録)
          </a>
        )}
      </div>

      <ul className="text-[11px] text-gray-500 mt-6 space-y-1 leading-relaxed">
        <li>✅ 5秒待ち広告がスキップされます</li>
        <li>✅ 「気になる」嬢を保存できます</li>
        <li>✅ 自分の口コミがマイページで管理できます</li>
        <li>✅ 会員の口コミは評価で優遇されます</li>
      </ul>
    </div>
  );
}
