/**
 * メモリ監視 watchdog
 *
 * 目的: external memory leak (V8 heap cap 外) が原因で OOM 寸前まで RSS が肥大化する事故を
 *       「ユーザー影響ゼロで自動回復」 させる安全網。
 *
 * 仕組み:
 *   1. 毎分 process.memoryUsage().rss を確認
 *   2. しきい値 (Render Starter 512MB の 88% = 450MB) を超えたら警告ログ
 *   3. critical しきい値 (92% = 470MB) を超えたら process.exit(1) → Render が auto-restart
 *
 * 効果:
 *   - V8 heap 外 (better-sqlite3 / ArrayBuffer / native binding) の leak でも保護
 *   - Render が新 instance を立てて切り替えるので ダウンタイム ~10秒以内
 *   - 「気付いたら 100% 張り付き → サイト 10 秒応答」の事故を防ぐ
 *
 * 注意:
 *   - 同じ Node プロセスでの multi-spawn (child_process) には対応してない
 *   - process.exit(1) は graceful shutdown を待たない (in-flight requests は切断される)
 *     ただし、 OOM で殺されるよりは ヘルシーな終了の方が ユーザー影響少ない
 */

const RSS_LIMIT_MB = 512; // Render Starter
const WARN_PCT = 88; // この%超で warn ログ
const CRITICAL_PCT = 92; // この%超で process.exit(1)
const CHECK_INTERVAL_MS = 60_000; // 毎分チェック

let started = false;

export function startMemoryWatchdog(): void {
  if (started) return;
  started = true;

  // build 中や test 中には起動させない (NODE_ENV で判定)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[memory-watchdog] non-production, skip');
    return;
  }

  console.log(
    `[memory-watchdog] started — interval=${CHECK_INTERVAL_MS}ms warn=${WARN_PCT}% critical=${CRITICAL_PCT}% rss_limit=${RSS_LIMIT_MB}MB`,
  );

  const timer = setInterval(() => {
    try {
      const mem = process.memoryUsage();
      const rssMB = Math.round(mem.rss / 1024 / 1024);
      const pct = Math.round((rssMB / RSS_LIMIT_MB) * 100);

      if (pct >= CRITICAL_PCT) {
        const externalMB = Math.round(mem.external / 1024 / 1024);
        const arrayBuffersMB = Math.round(mem.arrayBuffers / 1024 / 1024);
        const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        console.error(
          `[memory-watchdog] CRITICAL rss=${rssMB}MB (${pct}%) heap=${heapUsedMB}MB external=${externalMB}MB arrayBuffers=${arrayBuffersMB}MB — exit(1) で Render 自動再起動を誘発`,
        );
        // 即時 process.exit すると in-flight HTTP request が切れる。
        // 数秒猶予を与えて (Render の rolling deploy なら新 instance が立ち上がる時間)、
        // それでも下がらなければ 強制終了する。
        // ただし leak 源は close するすべがないので、 待っても下がる可能性はほぼゼロ。
        // 即時 exit が正解。
        clearInterval(timer);
        // exit code 1 で Render は failure と認識し、 auto-restart する
        process.exit(1);
        return;
      }
      if (pct >= WARN_PCT) {
        const externalMB = Math.round(mem.external / 1024 / 1024);
        const arrayBuffersMB = Math.round(mem.arrayBuffers / 1024 / 1024);
        const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        console.warn(
          `[memory-watchdog] WARN rss=${rssMB}MB (${pct}%) heap=${heapUsedMB}MB external=${externalMB}MB arrayBuffers=${arrayBuffersMB}MB`,
        );
      }
    } catch (e) {
      console.error('[memory-watchdog] check failed', e);
    }
  }, CHECK_INTERVAL_MS);

  // GC ヒント発火 (V8 が積極的に GC してメモリを OS に返さない場合がある)
  // --expose-gc が必要なので、 利用可能な場合のみ
  if (typeof (globalThis as { gc?: () => void }).gc === 'function') {
    setInterval(() => {
      try {
        (globalThis as { gc?: () => void }).gc?.();
      } catch {}
    }, 5 * 60_000); // 5分ごと
  }
}
