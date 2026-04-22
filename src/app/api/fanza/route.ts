import { NextResponse } from 'next/server';
import { AD_CONFIG } from '@/lib/ad-config';

const CACHE_TTL = 60; // 1分キャッシュ（短めにしてバリエーション最大化）

interface FanzaItem {
  title: string;
  url: string;
  imageUrl: string;
  floor?: string;
}

// フロア別にキャッシュを持つ
const cacheByFloor: Record<string, { data: FanzaItem[]; ts: number }> = {};

// FANZA の各フロア（service/floor の組み合わせ）
// 視覚的に似すぎないよう bucket タグでグルーピングし、1リクエストで異なる bucket から取得する
const FLOORS = [
  { service: 'digital', floor: 'videoa', label: 'AV', bucket: 'live' },
  { service: 'digital', floor: 'videoc', label: 'アマチュア', bucket: 'live' },
  { service: 'digital', floor: 'nikkatsu', label: '日活ロマン', bucket: 'live' },
  { service: 'digital', floor: 'cinema', label: '一般映画', bucket: 'live' },
  { service: 'mono', floor: 'dvd', label: 'DVD', bucket: 'live' },
  { service: 'digital', floor: 'anime', label: 'アニメ', bucket: 'anime' },
  { service: 'mono', floor: 'anime', label: 'アニメDVD', bucket: 'anime' },
  { service: 'doujin', floor: 'digital_doujin', label: '同人', bucket: 'book' },
  { service: 'book', floor: 'comic', label: 'コミック', bucket: 'book' },
];

function randomSort(): string {
  const sorts = ['rank', 'date', 'review', 'price_asc', '-price'];
  return sorts[Math.floor(Math.random() * sorts.length)];
}

function randomFloor() {
  return FLOORS[Math.floor(Math.random() * FLOORS.length)];
}

/** bucket が異なる 2 フロアを選び、パターン被りを防ぐ */
function pickTwoFloors() {
  const a = randomFloor();
  const otherBucket = FLOORS.filter(f => f.bucket !== a.bucket);
  const b = otherBucket.length > 0
    ? otherBucket[Math.floor(Math.random() * otherBucket.length)]
    : FLOORS.find(f => f !== a) || a;
  return [a, b] as const;
}

async function fetchFloorItems(floor: { service: string; floor: string }, apiId: string, apiAffId: string, clickAffId: string): Promise<FanzaItem[]> {
  const key = `${floor.service}_${floor.floor}`;
  const cached = cacheByFloor[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL * 1000) {
    return cached.data;
  }

  try {
    const offset = Math.floor(Math.random() * 80) + 1;
    const params = new URLSearchParams({
      api_id: apiId,
      affiliate_id: apiAffId,
      site: 'FANZA',
      service: floor.service,
      floor: floor.floor,
      hits: '50',
      sort: randomSort(),
      offset: String(offset),
      output: 'json',
    });

    const res = await fetch(`https://api.dmm.com/affiliate/v3/ItemList?${params}`, {
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items: FanzaItem[] = (json.result?.items || []).map((item: Record<string, unknown>) => ({
      title: (item.title as string || '').substring(0, 40),
      url: ((item.affiliateURL as string) || '').replace(`af_id=${apiAffId}`, `af_id=${clickAffId}`),
      imageUrl: (item.imageURL as Record<string, string>)?.small || (item.imageURL as Record<string, string>)?.list || '',
      floor: floor.floor,
    })).filter((it: FanzaItem) => it.url && it.imageUrl);

    cacheByFloor[key] = { data: items, ts: Date.now() };
    return items;
  } catch {
    return [];
  }
}

/** items から floor 別に偏りなく count 件サンプリング */
function balancedPick(byFloor: FanzaItem[][], count: number): FanzaItem[] {
  const active = byFloor.filter(a => a.length > 0).map(a => [...a].sort(() => Math.random() - 0.5));
  const out: FanzaItem[] = [];
  let i = 0;
  while (out.length < count && active.some(a => a.length > 0)) {
    const src = active[i % active.length];
    if (src.length > 0) out.push(src.shift()!);
    i++;
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const count = Math.min(parseInt(url.searchParams.get('n') || '4'), 20);

  const { fanza } = AD_CONFIG;
  const apiAffId = (fanza as { apiAffiliateId?: string }).apiAffiliateId || fanza.affiliateId;
  const apiId = fanza.apiId;
  const clickAffId = fanza.affiliateId;

  try {
    // bucket が異なる2フロアを選ぶ → ジャンル/視覚の被りを減らす
    const [floor1, floor2] = pickTwoFloors();

    const [items1, items2] = await Promise.all([
      fetchFloorItems(floor1, apiId, apiAffId, clickAffId),
      fetchFloorItems(floor2, apiId, apiAffId, clickAffId),
    ]);

    if (items1.length + items2.length === 0) return NextResponse.json([], { status: 200 });

    // フロアごとに偏りなく取るので、視覚的に「全部同じジャンル」にならない
    return NextResponse.json(balancedPick([items1, items2], count));
  } catch (e) {
    console.error('FANZA API fetch error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
