import { CATEGORY_TABS } from '@/lib/queries';

type Props = {
  currentCat: string;
  /** Base URL path to prepend (e.g. "/tokyo" or "/area/shinjuku") */
  basePath: string;
  /** Extra query params to preserve (e.g. "pref=tokyo") */
  extraParams?: string;
};

export default function CategoryTabs({ currentCat, basePath, extraParams }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
      {CATEGORY_TABS.map((tab) => {
        const isActive = tab.slug === currentCat;
        const params = new URLSearchParams();
        if (extraParams) {
          for (const part of extraParams.split('&')) {
            const [k, v] = part.split('=');
            if (k && v) params.set(k, v);
          }
        }
        if (tab.slug) {
          params.set('cat', tab.slug);
        } else {
          params.delete('cat');
        }
        const qs = params.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;

        return (
          <a
            key={tab.slug}
            href={href}
            className={`
              inline-block whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors no-underline shrink-0
              ${isActive
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }
            `}
          >
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
