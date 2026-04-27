// 副作用ゼロ ガイド: 既存 /guide/* と URL衝突なし、 動的routeでfs列挙されない
// 実データ (shops + girls) ベースで thin contentを回避
import { notFound } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/db';
import { UNIFIED_AREAS } from '../../../../../scripts/lib/unified-areas.mjs';
import type { Metadata } from 'next';

export const revalidate = 86400; // 1日 ISR (build時間影響ゼロ)

const CATEGORY_MAP: Record<string, string> = {
  deriheru: 'デリヘル',
  soap: 'ソープ',
  health: 'ヘルス',
  hoteheru: 'ホテヘル',
  esthe: 'エステ・アロマ',
  menesu: 'メンズエステ',
};

// slug = "{area_slug}-{category}" 例: ikebukuro-soap
function parseSlug(slug: string) {
  for (const cat of Object.keys(CATEGORY_MAP)) {
    if (slug.endsWith(`-${cat}`)) {
      const areaSlug = slug.substring(0, slug.length - cat.length - 1);
      return { areaSlug, categoryKey: cat, categoryLabel: CATEGORY_MAP[cat] };
    }
  }
  return null;
}

function getAreaInfo(areaSlug: string) {
  for (const [pref, areas] of Object.entries(UNIFIED_AREAS as Record<string, Array<{ slug: string; name: string }>>)) {
    const a = areas.find((x) => x.slug === areaSlug);
    if (a) return { pref, areaName: a.name };
  }
  return null;
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const parsed = parseSlug(params.slug);
  if (!parsed) return {};
  const area = getAreaInfo(parsed.areaSlug);
  if (!area) return {};
  const title = `${area.areaName}の${parsed.categoryLabel}おすすめ｜パネマジ度・口コミ掲示板`;
  const description = `${area.areaName}エリアの${parsed.categoryLabel}店舗の口コミ・パネマジ度・在籍嬢一覧。実際にパネル通りだった店をパネマジ掲示板でチェック。`;
  return {
    title,
    description,
    alternates: { canonical: `https://panemaji.com/guide/area/${params.slug}` },
    openGraph: { title, description, url: `https://panemaji.com/guide/area/${params.slug}` },
  };
}

export default function AreaGuidePage({ params }: { params: { slug: string } }) {
  const parsed = parseSlug(params.slug);
  if (!parsed) notFound();
  const area = getAreaInfo(parsed.areaSlug);
  if (!area) notFound();

  // shops: 該当エリア×業態 で 嬢付き
  const shops = db
    .prepare(
      `
      SELECT s.id, s.name, s.description,
        (SELECT COUNT(*) FROM girls g WHERE g.shop_id=s.id AND g.is_active=1) AS girl_count,
        (SELECT COUNT(*) FROM reviews r JOIN girls g ON r.girl_id=g.id WHERE g.shop_id=s.id) AS review_count,
        (SELECT g2.image_url FROM girls g2 WHERE g2.shop_id=s.id AND g2.is_active=1 AND g2.image_url IS NOT NULL AND g2.image_url != '' LIMIT 1) AS thumb
      FROM shops s
      JOIN areas a ON s.area_id=a.id
      WHERE s.is_active=1 AND a.slug=? AND s.category=?
        AND EXISTS (SELECT 1 FROM girls g WHERE g.shop_id=s.id AND g.is_active=1)
      ORDER BY review_count DESC, girl_count DESC
      LIMIT 30
    `,
    )
    .all(parsed.areaSlug, parsed.categoryLabel) as Array<{
    id: number;
    name: string;
    description: string | null;
    girl_count: number;
    review_count: number;
    thumb: string | null;
  }>;

  // thin content対策: 嬢付き shop 5件未満なら 404
  if (shops.length < 5) notFound();

  return (
    <article className="space-y-6 px-4 sm:px-0 max-w-3xl mx-auto py-6">
      <nav className="text-xs text-gray-500">
        <Link href="/" className="hover:text-blue-600">トップ</Link>
        <span className="mx-1">&gt;</span>
        <Link href="/guide/area" className="hover:text-blue-600">エリア×業態ガイド</Link>
        <span className="mx-1">&gt;</span>
        <span>{area.areaName} {parsed.categoryLabel}</span>
      </nav>

      <header className="border-b pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">
          {area.areaName}の{parsed.categoryLabel}おすすめ {shops.length}店
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          パネマジ掲示板で集計した{area.areaName}エリアの{parsed.categoryLabel}店舗一覧。
          口コミ件数・在籍嬢数・パネル通り率(パネマジ度)で評判の良い店をご紹介。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">{area.areaName}の{parsed.categoryLabel}店舗ランキング</h2>
        <ol className="space-y-3">
          {shops.map((shop, i) => (
            <li key={shop.id} className="bg-white rounded-lg shadow p-4 flex gap-4">
              <span className="text-2xl font-bold text-gray-400 w-8 shrink-0">{i + 1}</span>
              {shop.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.thumb} alt={shop.name} className="w-16 h-16 object-cover rounded shrink-0" loading="lazy" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <Link href={`/shop/${shop.id}`} className="font-bold text-blue-600 hover:underline break-words">
                  {shop.name}
                </Link>
                <p className="text-xs text-gray-500 mt-1">
                  在籍 {shop.girl_count === 100 ? '100+' : shop.girl_count}人 / 口コミ {shop.review_count}件
                </p>
                {shop.description && <p className="text-sm text-gray-700 mt-1 line-clamp-2">{shop.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-blue-50 rounded-lg p-4">
        <h2 className="font-bold mb-2">{area.areaName}の{parsed.categoryLabel}選びのポイント</h2>
        <ul className="text-sm text-gray-700 space-y-1 list-disc pl-6">
          <li>口コミ数が多い店ほど、 実体験の情報が集まっている</li>
          <li>パネマジ度(パネル通り率)が高いほど、 写真と実物の差が少ない</li>
          <li>在籍嬢が多い店は 好みの女性に出会える可能性が高い</li>
          <li>気になった店は、 個別ページで在籍一覧と最新口コミを確認</li>
        </ul>
      </section>

      <footer className="text-xs text-gray-500 pt-4 border-t">
        ※掲載情報はパネマジ掲示板に投稿された口コミに基づきます。
        最新の在籍状況は各店舗の公式サイトでご確認ください。
      </footer>
    </article>
  );
}
