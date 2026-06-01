'use client';

import { useEffect, useState } from 'react';

type Props = { targetType: 'shop' | 'girl'; targetId: number };

const SHOP_REASONS = [
  { v: 'closed', label: '閉店している' },
  { v: 'not_exist', label: 'この店は存在しない' },
  { v: 'wrong_info', label: '情報が間違っている' },
  { v: 'other', label: 'その他' },
];
const GIRL_REASONS = [
  { v: 'departed', label: '退店している' },
  { v: 'not_exist', label: '在籍していない' },
  { v: 'wrong_info', label: '情報が間違っている' },
  { v: 'other', label: 'その他' },
];

export default function FeedbackButton({ targetType, targetId }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState('');

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setAuthed(!!d.user)).catch(() => setAuthed(false));
  }, []);

  // 会員のみに表示
  if (authed !== true) return null;

  const reasons = targetType === 'shop' ? SHOP_REASONS : GIRL_REASONS;

  async function report(reason: string, detail?: string) {
    if (sending) return;
    setSending(reason);
    try {
      const body: Record<string, unknown> = { target_type: targetType, reason };
      if (detail && detail.trim()) body.detail = detail.trim();
      if (targetType === 'shop') body.shop_id = targetId;
      else body.girl_id = targetId;
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSent(true);
      setOpen(false);
    } catch {
      /* noop */
    } finally {
      setSending('');
    }
  }

  if (sent) {
    return <p className="text-xs text-green-600 mt-2">✅ 報告ありがとうございます（管理者が確認します）</p>;
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-xs text-gray-400 hover:text-gray-600 underline">
          ⚠️ 情報の修正を報告（{targetType === 'shop' ? '閉店' : '退店'}など）
        </button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-left">
          {showOther ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">内容を入力してください</p>
              <textarea
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="例: 移転した／別の店に変わっている など"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-pink-400 focus:border-transparent resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => report('other', otherText)}
                  disabled={!otherText.trim() || !!sending}
                  className="text-xs px-3 py-1.5 rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50"
                >
                  {sending === 'other' ? '送信中…' : '送信'}
                </button>
                <button onClick={() => { setShowOther(false); setOtherText(''); }} className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600">
                  戻る
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-gray-700 mb-2">どの情報を報告しますか？</p>
              <div className="flex flex-wrap gap-2">
                {reasons.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => (r.v === 'other' ? setShowOther(true) : report(r.v))}
                    disabled={!!sending}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-pink-50 hover:border-pink-300 disabled:opacity-50"
                  >
                    {sending === r.v ? '送信中…' : r.label}
                  </button>
                ))}
                <button onClick={() => setOpen(false)} className="text-xs px-2 py-1.5 text-gray-400 hover:text-gray-600">
                  キャンセル
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
