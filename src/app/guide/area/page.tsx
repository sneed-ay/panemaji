// /guide/area/ index — エリア×業態ガイド一覧 (副作用ゼロ: 既存 /guide/ index を変えない)
import Link from 'next/link';
import db from '@/lib/db';
import { UNIFIED_AREAS } from '../../../../scripts/lib/unified-areas.mjs';
import type { Metadata } from 'next';

export const revalidate = 86400;

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'deriheru', label: 'デリヘル' },
  { key: 'soap', label: 'ソープ' },
  { key: 'health', label: 'ヘルス' },
  { key: 'hoteheru', label: 'ホテヘル' },
  { key: 'esthe', label: 'エステ・アロマ' },
  { key: 'menesu', label: 'メンズエステ' },
];

export const metadata: Metadata = {
  title: 'エリア×業態 ガイド一覧｜パネマジ掲示板',
  description: '都道府県・エリア×業態(デリヘル/ソープ/ヘルス/ホテヘル/エステ/メンエス)別の店舗ガイド。実データに基づくおすすめ店ランキング。',
  alternates: { canonical: 'https://panemaji.com/guide/area' },
};

export default function AreaGuideIndex() {
  // 嬢付き shop 5件以上 ある area×category のみ列挙
  const counts = db
    .prepare(
      `
      SELECT a.slug AS area_slug, a.name AS area_name, a.prefecture, s.category, COUNT(*) AS cnt
      FROM shops s
      JOIN areas a ON s.area_id=a.id
      WHERE s.is_active=1 AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
      GROUP BY a.slug, s.category
      HAVING cnt >= 5
    `,
    )
    .all() as Array<{ area_slug: string; area_name: string; prefecture: string; category: string; cnt: number }>;

  const groupedByPref: Record<string, Array<{ areaSlug: string; areaName: string; categoryKey: string; categoryLabel: string; cnt: number }>> = {};
  for (const c of counts) {
    const cat = CATEGORIES.find((x) => x.label === c.category);
    if (!cat) continue;
    if (!groupedByPref[c.prefecture]) groupedByPref[c.prefecture] = [];
    groupedByPref[c.prefecture].push({
      areaSlug: c.area_slug,
      areaName: c.area_name,
      categoryKey: cat.key,
      categoryLabel: cat.label,
      cnt: c.cnt,
    });
  }

  // pref を都道府県名ソート (UNIFIED_AREAS 順)
  const orderedPrefs = Object.keys(UNIFIED_AREAS as Record<string, unknown>).filter((p) => groupedByPref[p]);

  return (
    <article className="space-y-6 px-4 sm:px-0 max-w-3xl mx-auto py-6">
      <nav className="text-xs text-gray-500">
        <Link href="/" className="hover:text-blue-600">トップ</Link>
        <span className="mx-1">&gt;</span>
        <Link href="/guide" className="hover:text-blue-600">ガイド</Link>
        <span className="mx-1">&gt;</span>
        <span>エリア×業態</span>
      </nav>

      <header className="border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">エリア×業態ガイド一覧</h1>
        <p className="text-sm text-gray-600 mt-2">
          都道府県・エリア × 業態別の店舗ランキング。 各ページは在籍嬢付き店舗5件以上のエリアのみ掲載。
        </p>
      </header>

      <section className="space-y-4">
        {orderedPrefs.map((pref) => (
          <div key={pref}>
            <h2 className="font-bold text-base mb-2 text-gray-800">{pref}</h2>
            <ul className="text-sm space-y-1">
              {groupedByPref[pref].map((g) => (
                <li key={`${g.areaSlug}-${g.categoryKey}`}>
                  <Link
                    href={`/guide/area/${g.areaSlug}-${g.categoryKey}`}
                    className="text-blue-600 hover:underline"
                  >
                    {g.areaName}の{g.categoryLabel}
                  </Link>
                  <span className="text-xs text-gray-500 ml-2">({g.cnt}店)</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </article>
  );
}
