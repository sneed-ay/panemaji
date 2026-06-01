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

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setAuthed(!!d.user)).catch(() => setAuthed(false));
  }, []);

  // 会員のみに表示
  if (authed !== true) return null;

  const reasons = targetType === 'shop' ? SHOP_REASONS : GIRL_REASONS;

  async function report(reason: string) {
    if (sending) return;
    setSending(reason);
    try {
      const body: Record<string, unknown> = { target_type: targetType, reason };
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
          <p className="text-xs font-medium text-gray-700 mb-2">どの情報を報告しますか？</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r.v}
                onClick={() => report(r.v)}
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
        </div>
      )}
    </div>
  );
}
