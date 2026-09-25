import { AreaView, areaMetadata } from './view';

// ?cat= 付きは next.config の rewrite で /area/[slug]/c/[cat] に振り分け、こちらは ISR で返す (2026-09-25)。
export const revalidate = 7200;

// 空でも generateStaticParams があると、初回アクセス時に描いて ISR で保持する (無いと Next 14 は毎回 SSR)。
// ビルド時には作らない (ビルド時の DB は本番と違う)。
export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  return areaMetadata({ params });
}

export default function AreaPage({ params }: { params: { slug: string } }) {
  return <AreaView params={params} searchParams={{}} />;
}
