/**
 * ページ内で既に表示した FANZA 商品 URL を記録し、同一ページに複数 FANZA 枠があっても
 * 別商品を引けるようにするための共有プール。
 * 無制限に膨れないよう 200 件で自動リセット。
 */
export const shownFanzaUrls = new Set<string>();

export function rememberFanzaUrls(urls: string[]) {
  for (const u of urls) shownFanzaUrls.add(u);
  if (shownFanzaUrls.size > 200) shownFanzaUrls.clear();
}

/** 既出URLを後回しにして count 件選び、選んだものを記録する */
export function pickFreshFanza<T extends { url: string }>(data: T[], count: number): T[] {
  if (!Array.isArray(data) || data.length === 0) return [];
  const fresh = data.filter(it => !shownFanzaUrls.has(it.url));
  const base = fresh.length >= count ? fresh : [...fresh, ...data.filter(it => !fresh.includes(it))];
  const picked = base.slice(0, count);
  rememberFanzaUrls(picked.map(it => it.url));
  return picked;
}
