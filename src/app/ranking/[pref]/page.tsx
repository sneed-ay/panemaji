import { notFound } from 'next/navigation';
import { isValidPrefecture } from '@/lib/queries';
import { RankingView, rankingMetadata } from '../view';

// /ranking?pref={県} の実体 (next.config の rewrite で振り分け)。canonical は従来どおり ?pref= 形式。
export const revalidate = 7200;

// 空でも generateStaticParams があると、初回アクセス時に描いて ISR で保持する (無いと Next 14 は毎回 SSR)。
// ビルド時には作らない (ビルド時の DB は本番と違う)。
export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: { params: { pref: string } }) {
  return rankingMetadata({ searchParams: { pref: params.pref } });
}

export default function RankingPrefPage({ params }: { params: { pref: string } }) {
  if (!isValidPrefecture(params.pref)) notFound();
  return <RankingView searchParams={{ pref: params.pref }} />;
}
