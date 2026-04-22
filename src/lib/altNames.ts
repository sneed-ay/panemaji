export function generateAlternateNames(name: string): string[] {
  if (!name) return [];
  const variants = new Set<string>();
  const noSpace = name.replace(/[\s\u3000]+/g, '');
  if (noSpace !== name) variants.add(noSpace);
  variants.delete(name);
  return Array.from(variants);
}

export function generateGirlAlternateNames(girlName: string, shopName: string | null | undefined): string[] {
  if (!girlName) return [];
  const variants = new Set<string>();
  for (const v of generateAlternateNames(girlName)) variants.add(v);
  if (shopName) {
    const pair = `${shopName} ${girlName}`;
    const pairNoSpace = `${shopName}${girlName}`;
    variants.add(pair);
    if (pair !== pairNoSpace) variants.add(pairNoSpace);
    const shopAlts = generateAlternateNames(shopName);
    for (const sv of shopAlts) {
      variants.add(`${sv} ${girlName}`);
      variants.add(`${sv}${girlName}`);
    }
  }
  variants.delete(girlName);
  return Array.from(variants);
}
