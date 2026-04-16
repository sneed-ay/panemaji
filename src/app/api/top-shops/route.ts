import { NextRequest, NextResponse } from 'next/server';
import { getTopShopsForPrefecture, prefectureNameToSlug, isValidPrefecture } from '@/lib/queries';

const PREFECTURE_NAME_MAP: Record<string, string> = {
  '全国': '',
  '東京': 'tokyo',
  '神奈川': 'kanagawa',
  '埼玉': 'saitama',
  '千葉': 'chiba',
  '大阪': 'osaka',
  '愛知': 'aichi',
  '北海道': 'hokkaido',
  '福岡': 'fukuoka',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prefecture = searchParams.get('prefecture') || '';

  // Accept both slug (tokyo) and Japanese name (東京)
  let prefSlug: string | null = null;
  if (prefecture && prefecture !== '全国') {
    if (PREFECTURE_NAME_MAP[prefecture]) {
      prefSlug = PREFECTURE_NAME_MAP[prefecture];
    } else if (isValidPrefecture(prefecture)) {
      prefSlug = prefecture;
    } else {
      // Try converting Japanese name to slug
      prefSlug = prefectureNameToSlug(prefecture);
    }
  }

  const shops = getTopShopsForPrefecture(prefSlug, 5);

  const result = shops.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    area_name: s.area_name,
    girl_count: s.girl_count ?? 0,
    review_count: s.review_count ?? 0,
    real_pct: s.real_pct ?? -1,
  }));

  return NextResponse.json(result);
}
