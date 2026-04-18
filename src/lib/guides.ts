import fs from 'node:fs';
import path from 'node:path';

// Read once per process — Next.js keeps the module cached
let cachedSlugs: string[] | null = null;

export function getAllGuideSlugs(): string[] {
  if (cachedSlugs) return cachedSlugs;
  const guideDir = path.join(process.cwd(), 'src/app/guide');
  try {
    cachedSlugs = fs
      .readdirSync(guideDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name);
  } catch {
    cachedSlugs = [];
  }
  return cachedSlugs;
}

// Return guides whose slug starts with `${areaSlug}-` or `${prefSlug}-`.
// Limits to `max` results, area matches first.
export function getRelatedGuides(
  areaSlug: string | null | undefined,
  prefSlug: string | null | undefined,
  max = 3,
): { slug: string; title: string }[] {
  const all = getAllGuideSlugs();
  const seen = new Set<string>();
  const picks: string[] = [];

  const addMatches = (prefix: string | null | undefined) => {
    if (!prefix) return;
    for (const slug of all) {
      if (picks.length >= max) break;
      if (seen.has(slug)) continue;
      if (slug.startsWith(`${prefix}-`)) {
        picks.push(slug);
        seen.add(slug);
      }
    }
  };

  addMatches(areaSlug);
  if (picks.length < max) addMatches(prefSlug);

  return picks.map((slug) => ({ slug, title: slugToTitle(slug) }));
}

// Convert a slug like "shinjuku-deriheru-guide" to display title
function slugToTitle(slug: string): string {
  const replacements: Record<string, string> = {
    'deriheru': 'デリヘル',
    'menesu': 'メンエス',
    'menesthe': 'メンエス',
    'soap': 'ソープ',
    'health': 'ヘルス',
    'panemaji': 'パネマジ',
    'guide': 'ガイド',
    'detail': '徹底解説',
    'night': 'ナイト',
    'taisaku': '対策',
    'first': '初めての',
    'hajimete': '初めての',
    'erabikata': '選び方',
    'ryoukin': '料金',
    'souba': '相場',
    'faq': 'FAQ',
    'beginner': '初心者',
    'checklist': 'チェックリスト',
  };
  const parts = slug.split('-');
  return parts
    .map((p) => replacements[p] || p.replace(/^\w/, (c) => c.toUpperCase()))
    .join(' ');
}
