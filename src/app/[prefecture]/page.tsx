import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, prefectureSlugToName } from '@/lib/queries';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { prefecture: string } }): Metadata {
  if (!isValidPrefecture(params.prefecture)) return {};
  const prefName = prefectureSlugToName(params.prefecture);
  return {
    title: `${prefName}のデリヘル パネマジ口コミ一覧`,
    description: `${prefName}のデリヘル店舗のパネル写真リアル度・口コミをチェック。パネル通りかパネル詐欺か、みんなの口コミで確認。`,
  };
}

export default function PrefecturePage({ params }: { params: { prefecture: string } }) {
  // Only handle valid prefecture slugs; let other routes pass through
  if (!isValidPrefecture(params.prefecture)) {
    notFound();
  }

  return <HomeContent prefSlug={params.prefecture} />;
}
