import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 内部用ヘルスチェック・メモリモニタ用 endpoint
// - GitHub Actions cron が 10 分間隔で叩いて memory_pct > 85% で alert
// - X-Robots-Tag: noindex で検索除外
// - 露出するのは process メモリ統計のみ。 PII / 認証情報 / DB データは含まない
export async function GET() {
  const mem = process.memoryUsage();
  const uptimeSec = Math.round(process.uptime());

  // V8 heap の上限 (NODE_OPTIONS=--max-old-space-size=400 で 400MB cap)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const v8 = require('v8') as typeof import('v8');
  const heap = v8.getHeapStatistics();
  const heapLimitMB = Math.round(heap.heap_size_limit / 1024 / 1024);
  const heapUsedMB = Math.round(heap.used_heap_size / 1024 / 1024);
  const heapPct = Math.round((heap.used_heap_size / heap.heap_size_limit) * 100);

  // RSS は OS から見たプロセス物理メモリ (Render の 512MB limit と直接比較)
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const rssLimitMB = 512; // Render Starter
  const rssPct = Math.round((rssMB / rssLimitMB) * 100);

  return NextResponse.json({
    ok: true,
    uptime_sec: uptimeSec,
    rss_mb: rssMB,
    rss_limit_mb: rssLimitMB,
    rss_pct: rssPct,
    heap_used_mb: heapUsedMB,
    heap_limit_mb: heapLimitMB,
    heap_pct: heapPct,
    external_mb: Math.round(mem.external / 1024 / 1024),
    array_buffers_mb: Math.round(mem.arrayBuffers / 1024 / 1024),
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
