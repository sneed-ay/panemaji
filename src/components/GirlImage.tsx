type Props = {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: number;
  className?: string;
};

// 肖像権・ホットリンク対応 (2026-08):
//   嬢のパネル写真は外部サイト(cityheaven等)のホットリンク表示だったため全面停止。
//   代わりに「名前イニシャルの色付きアバター」を表示し、画像なしでも一覧が
//   “意図されたデザイン”として成立するようにする。DBの image_url は保持(可逆)。
//   src は互換のため受け取るが使用しない。表示文字は name ?? alt から生成。

// 落ち着いた高彩度すぎない配色(bg / text)。名前ハッシュで決定的に選ぶ。
const PALETTE: [string, string][] = [
  ['#fce7f3', '#be185d'], // pink
  ['#ede9fe', '#6d28d9'], // violet
  ['#e0f2fe', '#0369a1'], // sky
  ['#dcfce7', '#15803d'], // green
  ['#fef3c7', '#b45309'], // amber
  ['#ffe4e6', '#be123c'], // rose
  ['#e0e7ff', '#4338ca'], // indigo
  ['#ccfbf1', '#0f766e'], // teal
  ['#fae8ff', '#a21caf'], // fuchsia
  ['#fee2e2', '#b91c1c'], // red
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// 装飾記号を除いた先頭1文字(絵文字・結合文字も1コードポイントで拾う)
function initial(name: string): string {
  const cleaned = name.replace(/[\s★☆♡♥◆◇【】\[\]()（）]/g, '').trim();
  const chars = Array.from(cleaned);
  return chars[0] ?? '?';
}

export default function GirlImage({ name, alt, size = 80, className = '' }: Props) {
  const label = (name ?? alt ?? '').trim();
  const [bg, fg] = PALETTE[hash(label || '?') % PALETTE.length];
  const ch = label ? initial(label) : '';

  return (
    <div
      className={`flex items-center justify-center shrink-0 rounded-lg select-none font-bold leading-none ${className}`}
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: Math.round(size * 0.42) }}
      role="img"
      aria-label={label || undefined}
    >
      {ch || (
        <svg style={{ width: size * 0.5, height: size * 0.5 }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )}
    </div>
  );
}
