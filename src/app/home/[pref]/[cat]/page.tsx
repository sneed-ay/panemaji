import { HomeView } from '../../../home-view';

// /?pref={県}&cat={業種} の実体 (next.config の rewrite で振り分け。cat=all は業種指定なし)。
// canonical は layout の既定 (https://panemaji.com) のまま = 以前の /?pref=... と同じ扱い。
export const revalidate = 3600;

// 空でも generateStaticParams があると、初回アクセス時に描いて ISR で保持する (無いと Next 14 は毎回 SSR)。
// ビルド時には作らない (ビルド時の DB は本番と違う)。
export function generateStaticParams() {
  return [];
}

export default function HomeVariantPage({ params }: { params: { pref: string; cat: string } }) {
  return <HomeView searchParams={{ pref: params.pref, ...(params.cat === 'all' ? {} : { cat: params.cat }) }} />;
}
