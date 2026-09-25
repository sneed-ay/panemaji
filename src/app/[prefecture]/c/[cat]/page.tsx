import { notFound } from 'next/navigation';
import { isValidCategory } from '@/lib/queries';
import { PrefectureView, prefectureMetadata } from '../../view';

// /{県}?cat={業種} の実体 (next.config の rewrite で振り分け)。canonical は /{県} のまま (prefectureMetadata)。
export const revalidate = 7200;

// 空でも generateStaticParams があると、初回アクセス時に描いて ISR で保持する (無いと Next 14 は毎回 SSR)。
// ビルド時には作らない (ビルド時の DB は本番と違う)。
export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: { params: { prefecture: string; cat: string } }) {
  return prefectureMetadata({ params: { prefecture: params.prefecture } });
}

export default function PrefectureCategoryPage({ params }: { params: { prefecture: string; cat: string } }) {
  if (!isValidCategory(params.cat)) notFound();
  return <PrefectureView params={{ prefecture: params.prefecture }} searchParams={{ cat: params.cat }} />;
}
