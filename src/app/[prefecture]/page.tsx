import { PrefectureView, prefectureMetadata } from './view';

// 一覧ページを「毎回 SSR」から ISR に戻す (2026-09-25)。以前は searchParams.cat を読んでいたため
// revalidate が効かず毎リクエスト 0.5〜6秒かけて描いていた。?cat= 付きは next.config の rewrite で
// /[prefecture]/c/[cat] に振り分け、こちらは業種指定なしの版だけを返す。
export const revalidate = 7200;

// 空でも generateStaticParams があると、初回アクセス時に描いて ISR で保持する (無いと Next 14 は毎回 SSR)。
// ビルド時には作らない (ビルド時の DB は本番と違う)。
export function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: { params: { prefecture: string } }) {
  return prefectureMetadata({ params });
}

export default function PrefecturePage({ params }: { params: { prefecture: string } }) {
  return <PrefectureView params={params} searchParams={{}} />;
}
