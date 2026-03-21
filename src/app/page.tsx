import HomeContent from '@/components/HomeContent';
import { isValidPrefecture } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function Home({ searchParams }: { searchParams: { pref?: string } }) {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  return <HomeContent prefSlug={prefSlug} />;
}
