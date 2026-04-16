'use client';

import { useState, useEffect } from 'react';

type TopShop = {
  id: number;
  name: string;
  category: string;
  area_name: string;
  girl_count: number;
  review_count: number;
  real_pct: number;
};

const PREFECTURES = ['全国', '東京', '神奈川', '埼玉', '千葉', '大阪', '愛知', '北海道', '福岡'] as const;

type Props = {
  initialShops: TopShop[];
  initialPrefecture: string;
};

export default function PrefectureTop5({ initialShops, initialPrefecture }: Props) {
  const [selected, setSelected] = useState(initialPrefecture);
  const [shops, setShops] = useState<TopShop[]>(initialShops);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected === initialPrefecture) {
      setShops(initialShops);
      return;
    }

    setLoading(true);
    fetch(`/api/top-shops?prefecture=${encodeURIComponent(selected)}`)
      .then((res) => res.json())
      .then((data: TopShop[]) => {
        setShops(data);
        setLoading(false);
      })
      .catch(() => {
        setShops([]);
        setLoading(false);
      });
  }, [selected, initialPrefecture, initialShops]);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm sm:text-base font-bold text-gray-800">
          パネル通り率 TOP5
        </h2>
        <a
          href={`/ranking?pref=${selected === '全国' ? 'tokyo' : PREF_SLUG_MAP[selected] || 'tokyo'}`}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          もっと見る
        </a>
      </div>

      {/* Prefecture Tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        {PREFECTURES.map((pref) => (
          <button
            key={pref}
            onClick={() => setSelected(pref)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              selected === pref
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {pref}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shops.length > 0 ? (
        <div className="space-y-2">
          {shops.map((shop, i) => (
            <CompactShopRankingCard key={shop.id} shop={shop} rank={i} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">口コミが増えたら表示されます</p>
      )}
    </div>
  );
}

const PREF_SLUG_MAP: Record<string, string> = {
  '東京': 'tokyo',
  '神奈川': 'kanagawa',
  '埼玉': 'saitama',
  '千葉': 'chiba',
  '大阪': 'osaka',
  '愛知': 'aichi',
  '北海道': 'hokkaido',
  '福岡': 'fukuoka',
};

function CompactShopRankingCard({ shop, rank }: { shop: TopShop; rank: number }) {
  const realPct = shop.real_pct ?? 0;
  const rankColors = rank === 0 ? 'bg-yellow-500' : rank === 1 ? 'bg-gray-400' : rank === 2 ? 'bg-orange-400' : 'bg-blue-400';
  return (
    <a
      href={`/shop/${shop.id}`}
      className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors no-underline"
    >
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${rankColors}`}>
        {rank + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{shop.name}</p>
        <p className="text-xs text-gray-500 truncate">{shop.area_name} · {shop.girl_count ?? 0}人在籍 · {shop.review_count ?? 0}件口コミ</p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-sm font-bold ${realPct >= 70 ? 'text-green-600' : realPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          {realPct}%
        </span>
      </div>
    </a>
  );
}
