'use client';

import React, { useState, useMemo } from 'react';
import GirlImage from '@/components/GirlImage';
import RealScore from '@/components/RealScore';
import AdBanner from '@/components/AdBanner';

type GirlData = {
  id: number;
  name: string;
  age: number | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  cup: string | null;
  image_url: string | null;
  review_count: number;
  panel_match_count: number;
  panel_diff_count: number;
  jirai_count: number;
  real_pct: number;
};

type SortKey = 'name' | 'review_count' | 'real_pct';
type ViewMode = 'grid' | 'list';

const INITIAL_LIMIT = 24;

export default function GirlSortFilter({ girls, query }: { girls: GirlData[]; query: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('real_pct');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...girls];
    switch (sortKey) {
      case 'name':
        arr.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        break;
      case 'review_count':
        arr.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        break;
      case 'real_pct':
        arr.sort((a, b) => {
          const aPct = a.real_pct >= 0 ? a.real_pct : -1;
          const bPct = b.real_pct >= 0 ? b.real_pct : -1;
          if (bPct !== aPct) return bPct - aPct;
          return (b.review_count || 0) - (a.review_count || 0);
        });
        break;
    }
    return arr;
  }, [girls, sortKey]);

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: 'real_pct', label: 'リアル度' },
    { key: 'review_count', label: '口コミ数' },
    { key: 'name', label: '名前' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 shrink-0">並び替え:</span>
          {sortButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setSortKey(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortKey === btn.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label="グリッド表示"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            aria-label="リスト表示"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-xl font-bold text-gray-800 min-w-0">
          在籍一覧
          {query && <span className="text-sm sm:text-base text-gray-500 ml-2 break-words">「{query}」の検索結果</span>}
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 shrink-0">{sorted.length}人</p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-500 bg-white rounded-lg shadow p-8 text-center">
          {query ? '該当する女性が見つかりませんでした' : '女性データはまだありません'}
        </p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(showAll ? sorted : sorted.slice(0, INITIAL_LIMIT)).map((girl, index) => {
            const realPct = girl.real_pct ?? -1;
            const hasReviews = (girl.review_count || 0) > 0 && realPct >= 0;
            const pctColor = realPct >= 70 ? 'bg-green-100 text-green-700 border-green-200' : realPct >= 40 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200';
            return (
              <React.Fragment key={girl.id}>
                <a
                  href={`/girl/${girl.id}`}
                  className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden no-underline"
                >
                  <div className="p-2.5 sm:p-3">
                    <div className="flex flex-col items-center text-center gap-2">
                      <GirlImage src={girl.image_url} alt={girl.name} size={80} />
                      <div className="min-w-0 w-full">
                        <h4 className="text-sm sm:text-base font-bold text-gray-800 truncate">{girl.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {girl.age && `${girl.age}歳`}
                          {girl.bust && girl.cup && ` B${girl.bust}(${girl.cup})`}
                        </p>
                      </div>
                      {hasReviews ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${pctColor}`}>
                          {realPct}%
                          <span className="font-normal text-[10px]">({girl.review_count}件)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">口コミ募集中</span>
                      )}
                    </div>
                  </div>
                </a>
                {(index + 1) % 6 === 0 && (
                  <div className="col-span-2 sm:col-span-3">
                    <AdBanner size="rectangle" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {(showAll ? sorted : sorted.slice(0, INITIAL_LIMIT)).map((girl) => (
            <a
              key={girl.id}
              href={`/girl/${girl.id}`}
              className="flex items-center gap-3 bg-white rounded-lg shadow hover:shadow-md transition-shadow p-3 no-underline"
            >
              <GirlImage src={girl.image_url} alt={girl.name} size={56} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-gray-800 break-words truncate">{girl.name}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {girl.age}歳
                  {girl.height && ` T${girl.height}`}
                  {girl.bust && girl.cup && ` B${girl.bust}(${girl.cup})`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">{girl.review_count || 0}件</span>
                <RealScore pct={girl.real_pct ?? -1} reviewCount={girl.review_count || 0} />
              </div>
            </a>
          ))}
        </div>
      )}
      {!showAll && sorted.length > INITIAL_LIMIT && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAll(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow"
          >
            残り {sorted.length - INITIAL_LIMIT} 名を表示
          </button>
        </div>
      )}
    </div>
  );
}
