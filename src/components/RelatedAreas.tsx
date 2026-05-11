import type { Area } from '@/lib/db';

interface RelatedAreasProps {
  areas: (Area & { shop_count: number })[];
  prefectureName: string;
  currentCat?: string;
}

/**
 * 近隣エリア widget — area / shop ページの 内部リンク強化用
 *
 * SEO 目的:
 *   - 同 prefecture 内の他エリアへ クロール深度確保
 *   - 回遊率向上 (滞在時間 + bounce rate 改善)
 *
 * 表示:
 *   - 最大 8 エリア (アクティブ店舗数の多い順)
 *   - shop_count を 括弧で 表示
 *   - 現在のエリアと同じ category filter を 引き継ぐ
 */
export default function RelatedAreas({ areas, prefectureName, currentCat }: RelatedAreasProps) {
  if (areas.length === 0) return null;
  const catQuery = currentCat ? `?cat=${currentCat}` : '';
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5">
      <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">
        {prefectureName}の他エリアを 探す
      </h2>
      <div className="flex flex-wrap gap-2">
        {areas.map((area) => (
          <a
            key={area.id}
            href={`/area/${area.slug}${catQuery}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded text-xs sm:text-sm no-underline transition-colors"
          >
            <span className="font-medium">{area.name}</span>
            {area.shop_count > 0 && (
              <span className="text-[10px] sm:text-xs text-gray-400">({area.shop_count})</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
