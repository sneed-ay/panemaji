/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'twitter-api-v2'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cityheaven.net' },
      { protocol: 'https', hostname: 'fuzoku-images.ranking-deli.jp' },
      { protocol: 'https', hostname: 'contents.purelovers.com' },
      { protocol: 'https', hostname: 'men-esthe.jp' },
      { protocol: 'https', hostname: 'www.aromaesthe.co.jp' },
      { protocol: 'https', hostname: 'tokyo.aromaesthe.co.jp' },
      { protocol: 'https', hostname: 'assets.fuzoku.jp' },
      { protocol: 'https', hostname: 'fuzoku.jp' },
      { protocol: 'https', hostname: 'd1ywb8dvwodsnl.cloudfront.net' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 86400, // 24h
    deviceSizes: [320, 480, 640, 750, 828, 1080],
    imageSizes: [56, 80, 120, 189, 256],
  },
  // GSC 解析で発見した「Google indexed だが現在 404」のレガシー area slug を
  // 都道府県トップにリダイレクト (流入回収・副作用ゼロ)。
  // - /area/{pref}-a1302, /area/{pref}-aXXXX  → 旧 cityheaven 形式
  // - /area/{pref}-fj-XXX                     → 旧 fuzoku-japan 形式
  // - /area/{pref}-ch-XXX                     → 旧 cityheaven (別形式)
  // - /area/{pref}-rd-XXX, -pl-XXX, -meste-XXX, -robin-XXX → 各ソース由来
  redirects: async () => [
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-a:n(\\d+)', destination: '/:pref', permanent: true },
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-fj-:rest*', destination: '/:pref', permanent: true },
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-ch-:rest*', destination: '/:pref', permanent: true },
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-rd-:rest*', destination: '/:pref', permanent: true },
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-pl-:rest*', destination: '/:pref', permanent: true },
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-meste-:rest*', destination: '/:pref', permanent: true },
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|fukuoka|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)-robin-:rest*', destination: '/:pref', permanent: true },
  ],

  headers: async () => [
    {
      // Security & SEO best-practice headers (副作用ゼロ・全パス共通)
      // Lighthouse Best Practices / Mozilla Observatory スコア改善
      source: '/:path*',
      headers: [
        // MIME sniffing 防止 (XSS リスク低減)
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Clickjacking 防止 (広告 iframe 内での panemaji 表示は禁止)
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        // Referrer情報の漏洩抑制 (cross-origin では origin のみ送信)
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // HSTS: 2年間 HTTPS 強制 + プリロード適格
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        // Permissions-Policy: 不要なブラウザ機能を全部 disable
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      ],
    },
    {
      // Static assets - long cache
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      // Images
      source: '/images/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
      ],
    },
    {
      // /api/* は thin JSON / 内部用のため検索除外 (副作用ゼロ・SEO品質向上)
      source: '/api/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    },
    {
      // /unlock は client redirect 専用 thin URL (副作用ゼロ・SEO品質向上)
      source: '/unlock',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    },
    {
      // HTML pages - short cache with stale-while-revalidate
      source: '/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=3600' },
      ],
    },
  ],
};

export default nextConfig;
