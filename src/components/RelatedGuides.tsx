import { getRelatedGuides } from '@/lib/guides';

type Props = {
  areaSlug?: string | null;
  prefSlug?: string | null;
  max?: number;
};

export default function RelatedGuides({ areaSlug, prefSlug, max = 3 }: Props) {
  const guides = getRelatedGuides(areaSlug, prefSlug, max);
  if (guides.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
        関連ガイド記事
      </h3>
      <ul className="space-y-2">
        {guides.map((g) => (
          <li key={g.slug}>
            <a
              href={`/guide/${g.slug}`}
              className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline text-sm text-gray-700"
            >
              <span className="text-blue-600">📖</span>
              <span className="flex-1 min-w-0 truncate">{g.title}</span>
              <span className="text-gray-400 text-xs shrink-0">→</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
