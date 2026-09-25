import { HomeView } from './home-view';

// トップを「毎回 SSR」から ISR に戻す (2026-09-25)。?pref= / ?cat= 付きは next.config の rewrite で
// /home/[pref]/[cat] に振り分け、こちらは東京・業種指定なしの版だけを返す。
export const revalidate = 3600;

export default function Home() {
  return <HomeView searchParams={{}} />;
}
