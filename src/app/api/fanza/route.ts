import { NextResponse } from 'next/server';
import { AD_CONFIG } from '@/lib/ad-config';

const CACHE_TTL = 3600; // 1時間キャッシュ
let cache: { data: FanzaItem[]; ts: number } | null = null;

interface FanzaItem {
  title: string;
  url: string;
  imageUrl: string;
}

export async function GET() {
  // キャッシュ有効ならそのまま返す
  if (cache && Date.now() - cache.ts < CACHE_TTL * 1000) {
    return NextResponse.json(cache.data);
  }

  const { fanza } = AD_CONFIG;
  const apiAffId = (fanza as { apiAffiliateId?: string }).apiAffiliateId || fanza.affiliateId;
  const apiId = fanza.apiId;

  try {
    const params = new URLSearchParams({
      api_id: apiId,
      affiliate_id: apiAffId,
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      hits: '6',
      sort: 'rank',
      output: 'json',
    });

    const res = await fetch(`https://api.dmm.com/affiliate/v3/ItemList?${params}`, {
      next: { revalidate: CACHE_TTL },
    });

    if (!res.ok) {
      console.error('FANZA API error:', res.status);
      return NextResponse.json([], { status: 200 });
    }

    const json = await res.json();
    const items: FanzaItem[] = (json.result?.items || []).map((item: Record<string, unknown>) => ({
      title: (item.title as string || '').substring(0, 40),
      url: item.affiliateURL as string || '',
      imageUrl: (item.imageURL as Record<string, string>)?.small || (item.imageURL as Record<string, string>)?.list || '',
    })).filter((item: FanzaItem) => item.url && item.imageUrl);

    cache = { data: items, ts: Date.now() };
    return NextResponse.json(items);
  } catch (e) {
    console.error('FANZA API fetch error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
