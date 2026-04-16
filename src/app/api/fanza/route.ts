import { NextResponse } from 'next/server';
import { AD_CONFIG } from '@/lib/ad-config';

const CACHE_TTL = 600; // 10分キャッシュ（バリエーション確保のため短め）
let cache: { data: FanzaItem[]; ts: number } | null = null;

interface FanzaItem {
  title: string;
  url: string;
  imageUrl: string;
}

/** 配列からランダムにn件を選んで返す */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** ソート条件をランダムに選ぶ（表示バリエーション向上） */
function randomSort(): string {
  const sorts = ['rank', 'date', 'review', 'price_asc'];
  return sorts[Math.floor(Math.random() * sorts.length)];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const count = Math.min(parseInt(url.searchParams.get('n') || '4'), 10);

  // キャッシュ有効でも、返すアイテムはランダムに選ぶ
  if (cache && Date.now() - cache.ts < CACHE_TTL * 1000) {
    return NextResponse.json(pickRandom(cache.data, count));
  }

  const { fanza } = AD_CONFIG;
  const apiAffId = (fanza as { apiAffiliateId?: string }).apiAffiliateId || fanza.affiliateId;
  const apiId = fanza.apiId;

  try {
    // ランダムなソート+ページで毎回違う結果を取得
    const offset = Math.floor(Math.random() * 50) + 1; // 1-50ページからランダム
    const params = new URLSearchParams({
      api_id: apiId,
      affiliate_id: apiAffId,
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      hits: '30',
      sort: randomSort(),
      offset: String(offset),
      output: 'json',
    });

    const res = await fetch(`https://api.dmm.com/affiliate/v3/ItemList?${params}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('FANZA API error:', res.status);
      return NextResponse.json([], { status: 200 });
    }

    const json = await res.json();
    // API は shumpo-990 で取得するが、クリックURLは shumpo-018 に差し替え
    const clickAffId = fanza.affiliateId; // shumpo-018
    const items: FanzaItem[] = (json.result?.items || []).map((item: Record<string, unknown>) => ({
      title: (item.title as string || '').substring(0, 40),
      url: ((item.affiliateURL as string) || '').replace(`af_id=${apiAffId}`, `af_id=${clickAffId}`),
      imageUrl: (item.imageURL as Record<string, string>)?.small || (item.imageURL as Record<string, string>)?.list || '',
    })).filter((item: FanzaItem) => item.url && item.imageUrl);

    cache = { data: items, ts: Date.now() };
    return NextResponse.json(pickRandom(items, count));
  } catch (e) {
    console.error('FANZA API fetch error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
