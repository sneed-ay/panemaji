'use client';

import type { AnchorHTMLAttributes } from 'react';
import { trackEvent, type EventParams } from '@/lib/analytics';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** クリック時に送る GA イベント名 */
  event: string;
  params?: EventParams;
};

/**
 * クリック時に GA イベントを送るリンク。
 * サーバーコンポーネントのページは onClick を書けないので、計測したいリンクはこれで包む。
 */
export default function TrackedLink({ event, params, onClick, ...rest }: Props) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        trackEvent(event, params);
        onClick?.(e);
      }}
    />
  );
}
