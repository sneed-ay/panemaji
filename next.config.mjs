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
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 86400, // 24h
    deviceSizes: [320, 480, 640, 750, 828, 1080],
    imageSizes: [56, 80, 120, 189, 256],
  },
  headers: async () => [
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
      // HTML pages - short cache with stale-while-revalidate
      source: '/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=3600' },
      ],
    },
  ],
};

export default nextConfig;
