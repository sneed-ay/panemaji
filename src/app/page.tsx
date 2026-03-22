import HomeContent from '@/components/HomeContent';
import { isValidPrefecture, isValidCategory } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function Home({ searchParams }: { searchParams: { pref?: string; cat?: string } }) {
  const prefSlug = searchParams.pref && isValidPrefecture(searchParams.pref) ? searchParams.pref : 'tokyo';
  const catSlug = searchParams.cat && isValidCategory(searchParams.cat) ? searchParams.cat : undefined;
  return <HomeContent prefSlug={prefSlug} catSlug={catSlug} />;
}
