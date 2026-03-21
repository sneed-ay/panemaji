'use client';

import { useState } from 'react';

type Prefecture = {
  name: string;
  slug: string;
  region: string;
};

type Props = {
  prefSlug: string;
  prefsByRegion: Record<string, Prefecture[]>;
  regionOrder: string[];
};

export default function PrefectureSelector({ prefSlug, prefsByRegion, regionOrder }: Props) {
  // Find the region of the current prefecture
  const currentRegion = (() => {
    for (const region of regionOrder) {
      if (prefsByRegion[region]?.some(p => p.slug === prefSlug)) {
        return region;
      }
    }
    return regionOrder[1] || regionOrder[0]; // default to 関東
  })();

  const [activeRegion, setActiveRegion] = useState<string>(currentRegion);

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4">
      {/* Region tabs */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 border-b border-gray-200 pb-3">
        {regionOrder.map((region) => {
          const isActive = region === activeRegion;
          return (
            <button
              key={region}
              onClick={() => setActiveRegion(region)}
              className={`
                px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {region}
            </button>
          );
        })}
      </div>

      {/* Prefecture links for active region */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {(prefsByRegion[activeRegion] || []).map((pref) => {
          const isActive = pref.slug === prefSlug;
          return (
            <a
              key={pref.slug}
              href={`/${pref.slug}`}
              className={`
                inline-block px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors no-underline
                ${isActive
                  ? 'bg-gradient-to-r from-pink-600 to-purple-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }
              `}
            >
              {pref.name}
            </a>
          );
        })}
      </div>
    </div>
  );
}
