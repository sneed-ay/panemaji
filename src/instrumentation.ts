/**
 * Next.js instrumentation hook
 *
 * Next.js 14 の標準の server-side 起動フック。
 * next.config.mjs で `experimental.instrumentationHook: true` 不要 (Next 15 以降は default)。
 * Next 14 では experimental flag 必要。
 *
 * 用途: メモリ watchdog をサーバー起動時に1度だけ起動する。
 */

export async function register() {
  // Node.js runtime のみ (edge runtime では process.memoryUsage() なし)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMemoryWatchdog } = await import('@/lib/memory-watchdog');
    startMemoryWatchdog();
  }
}
