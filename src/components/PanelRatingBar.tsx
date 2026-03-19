type Props = {
  matchCount: number;
  diffCount: number;
  jiraiCount: number;
};

export default function PanelRatingBar({ matchCount, diffCount, jiraiCount }: Props) {
  const total = matchCount + diffCount + jiraiCount;
  if (total === 0) {
    return <p className="text-gray-400 text-sm">口コミなし</p>;
  }

  const matchPct = Math.round((matchCount / total) * 100);
  const diffPct = Math.round((diffCount / total) * 100);
  const jiraiPct = 100 - matchPct - diffPct;

  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
        {matchPct > 0 && (
          <div className="bg-green-500 transition-all" style={{ width: `${matchPct}%` }} />
        )}
        {diffPct > 0 && (
          <div className="bg-yellow-400 transition-all" style={{ width: `${diffPct}%` }} />
        )}
        {jiraiPct > 0 && (
          <div className="bg-red-500 transition-all" style={{ width: `${jiraiPct}%` }} />
        )}
      </div>
      <div className="flex justify-between text-xs mt-1 text-gray-600">
        <span className="text-green-700">パネル通り {matchCount}件</span>
        <span className="text-yellow-700">違う {diffCount}件</span>
        <span className="text-red-700">地雷 {jiraiCount}件</span>
      </div>
    </div>
  );
}
