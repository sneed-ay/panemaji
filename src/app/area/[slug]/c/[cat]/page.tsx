import { notFound } from 'next/navigation';
import { isValidCategory } from '@/lib/queries';
import { AreaView, areaMetadata } from '../../view';

// /area/{slug}?cat={業種} の実体 (next.config の rewrite で振り分け)。canonical は /area/{slug} のまま。
export const revalidate = 7200;

// 空でも generateStaticParams があると、初回アクセス時に描いて ISR で保持する (無いと Next 14 は毎回 SSR)。
// ビルド時には作らない (ビルド時の DB は本番と違う)。
export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: { params: { slug: string; cat: string } }) {
  return areaMetadata({ params: { slug: params.slug } });
}

export default function AreaCategoryPage({ params }: { params: { slug: string; cat: string } }) {
  if (!isValidCategory(params.cat)) notFound();
  return <AreaView params={{ slug: params.slug }} searchParams={{ cat: params.cat }} />;
}
