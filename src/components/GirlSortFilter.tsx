'use client';

import React, { useState, useMemo } from 'react';
import GirlImage from '@/components/GirlImage';
import RealScore from '@/components/RealScore';
import PanelRatingBar from '@/components/PanelRatingBar';
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

export default function GirlSortFilter({ girls, query }: { girls: GirlData[]; query: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('real_pct');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((girl, index) => (
            <React.Fragment key={girl.id}>
              <a
                href={`/girl/${girl.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden no-underline"
              >
                <div className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <GirlImage src={girl.image_url} alt={girl.name} size={80} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-base sm:text-lg font-bold text-gray-800 break-words">{girl.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                            {girl.age}歳
                            {girl.height && ` T${girl.height}`}
                            {girl.bust && girl.cup && ` B${girl.bust}(${girl.cup})`}
                            {girl.waist && ` W${girl.waist}`}
                            {girl.hip && ` H${girl.hip}`}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <RealScore pct={girl.real_pct ?? -1} reviewCount={girl.review_count || 0} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">口コミ {girl.review_count || 0}件</span>
                        {(girl.review_count || 0) === 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">口コミ募集中</span>
                        )}
                      </div>
                      <div className="mt-2">
                        <PanelRatingBar
                          matchCount={girl.panel_match_count || 0}
                          diffCount={girl.panel_diff_count || 0}
                          jiraiCount={girl.jirai_count || 0}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </a>
              {(index + 1) % 5 === 0 && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <AdBanner size="rectangle" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((girl) => (
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
    </div>
  );
}
