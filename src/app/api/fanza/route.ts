import { NextResponse } from 'next/server';
import { AD_CONFIG } from '@/lib/ad-config';

const CACHE_TTL = 180; // 3分キャッシュ（短めにしてバリエーション最大化）

interface FanzaItem {
  title: string;
  url: string;
  imageUrl: string;
  floor?: string;
}

// フロア別にキャッシュを持つ
const cacheByFloor: Record<string, { data: FanzaItem[]; ts: number }> = {};

/** 配列からランダムにn件を選ぶ */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// FANZA の各フロア（service/floor の組み合わせ）
// 表示バリエーションを広げるため複数から毎回ランダム選択
const FLOORS = [
  { service: 'digital', floor: 'videoa', label: 'AV' },
  { service: 'digital', floor: 'videoc', label: 'アマチュア' },
  { service: 'digital', floor: 'anime', label: 'アニメ' },
  { service: 'digital', floor: 'nikkatsu', label: '日活ロマン' },
  { service: 'digital', floor: 'cinema', label: '一般映画' },
  { service: 'mono', floor: 'dvd', label: 'DVD' },
  { service: 'mono', floor: 'anime', label: 'アニメDVD' },
  { service: 'doujin', floor: 'digital_doujin', label: '同人' },
  { service: 'book', floor: 'comic', label: 'コミック' },
];

function randomSort(): string {
  const sorts = ['rank', 'date', 'review', 'price_asc', '-price'];
  return sorts[Math.floor(Math.random() * sorts.length)];
}

function randomFloor() {
  return FLOORS[Math.floor(Math.random() * FLOORS.length)];
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const count = Math.min(parseInt(url.searchParams.get('n') || '4'), 10);

  const { fanza } = AD_CONFIG;
  const apiAffId = (fanza as { apiAffiliateId?: string }).apiAffiliateId || fanza.affiliateId;
  const apiId = fanza.apiId;
  const clickAffId = fanza.affiliateId;

  try {
    // 毎回2つのフロアから取得して混ぜる（バリエーション最大化）
    const floor1 = randomFloor();
    let floor2 = randomFloor();
    while (floor2 === floor1) floor2 = randomFloor();

    const [items1, items2] = await Promise.all([
      fetchFloorItems(floor1, apiId, apiAffId, clickAffId),
      fetchFloorItems(floor2, apiId, apiAffId, clickAffId),
    ]);

    const merged = [...items1, ...items2];
    if (merged.length === 0) return NextResponse.json([], { status: 200 });

    return NextResponse.json(pickRandom(merged, count));
  } catch (e) {
    console.error('FANZA API fetch error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
