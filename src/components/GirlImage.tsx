type Props = {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
};

// 肖像権・ホットリンク対応 (2026-08):
//   嬢のパネル写真は外部サイト(cityheaven等)のホットリンク表示で、本人同意のない肖像掲載・
//   Referer制限の潜脱・掲載元依存の資産脆弱性という問題があったため、サイト上での画像表示を
//   全面停止し常にプレースホルダを表示する。DBの image_url は保持(可逆)。
//   src/alt は呼び出し側互換のため受け取るが使用しない。
export default function GirlImage({ size = 80, className = '' }: Props) {
  return (
    <div
      className={`bg-gray-200 flex items-center justify-center shrink-0 rounded-lg ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        className="text-gray-400"
        style={{ width: size * 0.5, height: size * 0.5 }}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}
