type Props = {
  pct: number; // -1 means no reviews
  reviewCount: number;
  size?: 'sm' | 'md' | 'lg';
};

export default function PanemajiScore({ pct, reviewCount, size = 'md' }: Props) {
  if (pct < 0 || reviewCount === 0) {
    return (
      <span className="text-gray-400 text-sm">---</span>
    );
  }

  const color = pct >= 70 ? 'text-green-600' :
                pct >= 40 ? 'text-yellow-600' :
                'text-red-600';

  const bgColor = pct >= 70 ? 'bg-green-50 border-green-200' :
                  pct >= 40 ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200';

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${color}`}>
        <span>{pct}%</span>
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <div className={`inline-flex flex-col items-center rounded-lg border p-2 sm:p-3 ${bgColor}`}>
        <span className="text-[10px] sm:text-xs text-gray-500">パネマジ度</span>
        <span className={`text-2xl sm:text-3xl font-bold ${color}`}>{pct}%</span>
        <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">{reviewCount}件の口コミ</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 ${bgColor}`}>
      <span className="text-xs text-gray-500">パネマジ度</span>
      <span className={`text-sm font-bold ${color}`}>{pct}%</span>
    </div>
  );
}
