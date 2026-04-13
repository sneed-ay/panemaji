'use client';

import { useEffect } from 'react';

/**
 * AdMavenロッカー通過後のリダイレクトページ
 * localStorageにアンロック状態を保存し、元のページに戻る
 */
export default function UnlockPage() {
  useEffect(() => {
    // アンロック状態を24時間保存
    try {
      localStorage.setItem('content_unlocked', String(Date.now() + 86400000));
    } catch {}

    // 元のページに戻る（referrerまたはトップ）
    const returnTo = document.referrer && document.referrer.includes('panemaji.com')
      ? document.referrer
      : '/';
    window.location.replace(returnTo);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">口コミを解除しています...</p>
      </div>
    </div>
  );
}
