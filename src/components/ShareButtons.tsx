'use client';

import { useState } from 'react';

type Props = {
  url: string;
  text: string;
  variant?: 'full' | 'compact';
};

export default function ShareButtons({ url, text, variant = 'full' }: Props) {
  const [copied, setCopied] = useState(false);

  const fullUrl = url.startsWith('http') ? url : `https://panemaji.com${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedText = encodeURIComponent(text);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black text-white hover:bg-gray-800 transition-colors no-underline"
          title="Xでシェア"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a
          href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#06C755] text-white hover:bg-[#05b34d] transition-colors no-underline"
          title="LINEでシェア"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 5.82 2 10.5c0 4.21 3.74 7.74 8.79 8.4.34.07.81.23.93.52.1.27.07.68.03.95l-.15.9c-.05.27-.22 1.07.94.58 1.16-.48 6.27-3.69 8.56-6.32C22.76 13.64 22 12.13 22 10.5 22 5.82 17.52 2 12 2zm-3.08 11.24H6.58a.53.53 0 01-.53-.53V8.66a.53.53 0 011.06 0v3.52h1.81a.53.53 0 010 1.06zm1.77-.53a.53.53 0 01-1.06 0V8.66a.53.53 0 011.06 0v4.05zm4.23 0c0 .22-.13.41-.33.5a.53.53 0 01-.58-.1l-2.32-3.16v2.76a.53.53 0 01-1.06 0V8.66c0-.22.13-.41.33-.5a.53.53 0 01.58.1l2.32 3.16V8.66a.53.53 0 011.06 0v4.05zm3.22-3.52a.53.53 0 010 1.06h-1.81v.99h1.81a.53.53 0 010 1.06h-2.34a.53.53 0 01-.53-.53V8.66c0-.29.24-.53.53-.53h2.34a.53.53 0 010 1.06h-1.81v.99h1.81z"/></svg>
        </a>
        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
          title="URLをコピー"
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          )}
        </button>
      </div>
    );
  }

  // Full variant - for after review submission
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700 text-center">この口コミをシェアする</p>
      <div className="flex items-center justify-center gap-3">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors no-underline text-sm font-medium"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Xでシェア
        </a>
        <a
          href={`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#06C755] text-white hover:bg-[#05b34d] transition-colors no-underline text-sm font-medium"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.48 2 2 5.82 2 10.5c0 4.21 3.74 7.74 8.79 8.4.34.07.81.23.93.52.1.27.07.68.03.95l-.15.9c-.05.27-.22 1.07.94.58 1.16-.48 6.27-3.69 8.56-6.32C22.76 13.64 22 12.13 22 10.5 22 5.82 17.52 2 12 2zm-3.08 11.24H6.58a.53.53 0 01-.53-.53V8.66a.53.53 0 011.06 0v3.52h1.81a.53.53 0 010 1.06zm1.77-.53a.53.53 0 01-1.06 0V8.66a.53.53 0 011.06 0v4.05zm4.23 0c0 .22-.13.41-.33.5a.53.53 0 01-.58-.1l-2.32-3.16v2.76a.53.53 0 01-1.06 0V8.66c0-.22.13-.41.33-.5a.53.53 0 01.58.1l2.32 3.16V8.66a.53.53 0 011.06 0v4.05zm3.22-3.52a.53.53 0 010 1.06h-1.81v.99h1.81a.53.53 0 010 1.06h-2.34a.53.53 0 01-.53-.53V8.66c0-.29.24-.53.53-.53h2.34a.53.53 0 010 1.06h-1.81v.99h1.81z"/></svg>
          LINEでシェア
        </a>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors text-sm font-medium"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              コピー済み
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              URLコピー
            </>
          )}
        </button>
      </div>
    </div>
  );
}
