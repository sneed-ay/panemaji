/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'twitter-api-v2'],
    // src/instrumentation.ts (memory-watchdog 起動) を有効化
    instrumentationHook: true,
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
    // ──────────────────────────────────────────────────────────────────
    // v5b マイグレーション (5/4): area slug を compound 化したが、
    // 簡易 slug (/area/shibuya 等) が 404 になり SEO bleeding 発生。
    // → 簡易 slug → 正規 compound slug への 308 redirect で 救済
    //   (旧 indexed URL + 内部リンク + ユーザー入力 URL を全部 catch)
    // ──────────────────────────────────────────────────────────────────

    // 東京: 簡易 → compound
    { source: '/area/shibuya', destination: '/area/shibuya-ebisu', permanent: true },
    { source: '/area/ebisu', destination: '/area/shibuya-ebisu', permanent: true },
    { source: '/area/gotanda', destination: '/area/gotanda-meguro', permanent: true },
    { source: '/area/meguro', destination: '/area/gotanda-meguro', permanent: true },
    { source: '/area/ueno', destination: '/area/ueno-uguisudani', permanent: true },
    { source: '/area/uguisudani', destination: '/area/ueno-uguisudani', permanent: true },
    { source: '/area/kinshicho', destination: '/area/kinshicho-kameido', permanent: true },
    { source: '/area/kameido', destination: '/area/kinshicho-kameido', permanent: true },
    { source: '/area/shinbashi', destination: '/area/shinbashi-ginza', permanent: true },
    { source: '/area/ginza', destination: '/area/shinbashi-ginza', permanent: true },
    { source: '/area/akihabara', destination: '/area/akihabara-kanda', permanent: true },
    { source: '/area/kanda', destination: '/area/akihabara-kanda', permanent: true },
    { source: '/area/roppongi', destination: '/area/roppongi-akasaka', permanent: true },
    { source: '/area/akasaka', destination: '/area/roppongi-akasaka', permanent: true },
    { source: '/area/tachikawa', destination: '/area/tachikawa-hachioji-machida', permanent: true },
    { source: '/area/hachioji', destination: '/area/tachikawa-hachioji-machida', permanent: true },
    { source: '/area/machida', destination: '/area/tachikawa-hachioji-machida', permanent: true },
    { source: '/area/kichijoji', destination: '/area/kichijoji-mitaka', permanent: true },
    { source: '/area/mitaka', destination: '/area/kichijoji-mitaka', permanent: true },
    { source: '/area/nakano', destination: '/area/nakano-koenji', permanent: true },
    { source: '/area/koenji', destination: '/area/nakano-koenji', permanent: true },

    // 大阪
    { source: '/area/umeda', destination: '/area/umeda-kitashinchi', permanent: true },
    { source: '/area/kitashinchi', destination: '/area/umeda-kitashinchi', permanent: true },
    { source: '/area/namba', destination: '/area/namba-shinsaibashi', permanent: true },
    { source: '/area/shinsaibashi', destination: '/area/namba-shinsaibashi', permanent: true },

    // 兵庫
    { source: '/area/kobe', destination: '/area/sannomiya-kobe', permanent: true },
    { source: '/area/sannomiya', destination: '/area/sannomiya-kobe', permanent: true },

    // 福岡
    { source: '/area/hakata', destination: '/area/fukuoka-tenjin-hakata', permanent: true },
    { source: '/area/tenjin', destination: '/area/fukuoka-tenjin-hakata', permanent: true },

    // 愛知
    { source: '/area/sakae', destination: '/area/nagoya-sakae', permanent: true },
    { source: '/area/nagoya', destination: '/area/nagoya-sakae', permanent: true },

    // 北海道
    { source: '/area/susukino', destination: '/area/sapporo-susukino', permanent: true },
    { source: '/area/sapporo', destination: '/area/sapporo-susukino', permanent: true },

    // 宮城
    { source: '/area/kokubuncho', destination: '/area/sendai-kokubuncho', permanent: true },
    { source: '/area/sendai', destination: '/area/sendai-kokubuncho', permanent: true },

    // 神奈川
    { source: '/area/yokohama', destination: '/area/yokohama-station', permanent: true },
    { source: '/area/sagamihara', destination: '/area/sagamihara-hashimoto', permanent: true },
    { source: '/area/atsugi', destination: '/area/atsugi-ebina', permanent: true },

    // 追加: ガイドCTAの簡易slug救済 (2026-06-03 内部リンク404解消・全件 unified-areas で実在確認済)
    // 東京
    { source: '/area/kamata', destination: '/area/kamata-omori-oimachi', permanent: true },
    { source: '/area/otsuka', destination: '/area/otsuka-sugamo-akabane', permanent: true },
    { source: '/area/iidabashi', destination: '/area/iidabashi-ichigaya', permanent: true },
    // 埼玉
    { source: '/area/kawaguchi', destination: '/area/kawaguchi-nishikawaguchi', permanent: true },
    { source: '/area/koshigaya', destination: '/area/kasukabe-koshigaya', permanent: true },
    // 千葉
    { source: '/area/kashiwa', destination: '/area/matsudo-kashiwa', permanent: true },
    { source: '/area/funabashi', destination: '/area/funabashi-ichikawa', permanent: true },

    // ──────────────────────────────────────────────────────────────────
    // 旧 area slug (legacy) → 都道府県 top へのフォールバック
    // ──────────────────────────────────────────────────────────────────
    // /area/{pref} (都道府県 slug を /area/ 配下に書いた旧リンク・典型 404)
    // 例: /area/fukuoka /area/hiroshima /area/osaka → 都道府県top にリダイレクト
    // (注: /area/fukuoka と /area/nagoya 等は上の compound redirect で先に matchするので OK)
    { source: '/area/:pref(tokyo|kanagawa|saitama|chiba|osaka|aichi|hokkaido|hyogo|kyoto|miyagi|hiroshima|shizuoka|niigata|ibaraki|tochigi|gunma|yamanashi|nagano|gifu|mie|shiga|nara|wakayama|tottori|shimane|okayama|yamaguchi|tokushima|kagawa|ehime|kochi|saga|nagasaki|kumamoto|oita|miyazaki|kagoshima|okinawa|aomori|iwate|akita|yamagata|fukushima|toyama|ishikawa|fukui)', destination: '/:pref', permanent: true },
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
      // 🚨 /api/* は必ず除外する。除外しないと /api/me 等の個人化/認証レスポンスが
      //    public キャッシュされ (Vary: Cookie も無いため) ログアウト状態の
      //    {user:null} がブラウザ/CDN にキャッシュ汚染され、会員ログインが
      //    永久に成立しなくなる (login → /mypage → /api/me=cached null → /login ループ)。
      source: '/((?!api/).*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=3600' },
      ],
    },
  ],
};

export default nextConfig;
