import { RankingView, rankingMetadata } from './view';

// ?pref= 付きは next.config の rewrite で /ranking/[pref] に振り分け、こちらは ISR で返す (2026-09-25)。
export const revalidate = 7200;

export function generateMetadata() {
  return rankingMetadata({ searchParams: {} });
}

export default function RankingPage() {
  return <RankingView searchParams={{}} />;
}
