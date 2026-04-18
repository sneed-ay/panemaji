import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, isValidCategory, prefectureSlugToName } from '@/lib/queries';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { prefecture: string } }): Metadata {
  if (!isValidPrefecture(params.prefecture)) return {};
  const prefName = prefectureSlugToName(params.prefecture);
  return {
    title: `${prefName}の風俗 口コミ・掲示板・パネマジ度`,
    description: `${prefName}の風俗店舗の口コミ掲示板。パネル写真と実物の一致度（パネマジ度）をチェック。${prefName}のデリヘル・メンエス・ヘルス店のリアルな評判・レビューがわかる。`,
  };
}

export default function PrefecturePage({ params, searchParams }: { params: { prefecture: string }; searchParams: { cat?: string } }) {
  // Only handle valid prefecture slugs; let other routes pass through
  if (!isValidPrefecture(params.prefecture)) {
    notFound();
  }

  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;
  return <HomeContent prefSlug={params.prefecture} catSlug={catSlug} />;
}
