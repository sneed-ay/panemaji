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
  // --expose-gc が必要 (NODE_OPTIONS=--expose-gc, init-db.sh で設定済)
  // sitemap streaming の ArrayBuffer 蓄積 を予防するため 2 分ごと + external 高い時は即発動
  const gcFn = (globalThis as { gc?: () => void }).gc;
  if (typeof gcFn === 'function') {
    console.log('[memory-watchdog] --expose-gc detected, periodic gc() enabled (every 2min + on-demand)');

    // 2 分ごとの定期 gc
    setInterval(() => {
      try { gcFn(); } catch {}
    }, 2 * 60_000);

    // メイン watchdog タイマーで external > 100MB なら preemptive gc
    setInterval(() => {
      try {
        const mem = process.memoryUsage();
        const externalMB = mem.external / 1024 / 1024;
        if (externalMB > 100) {
          gcFn();
          const after = process.memoryUsage();
          const reclaimedMB = Math.round((mem.external - after.external) / 1024 / 1024);
          if (reclaimedMB > 5) {
            console.log(`[memory-watchdog] preemptive gc reclaimed ${reclaimedMB}MB external (was ${Math.round(externalMB)}MB)`);
          }
        }
      } catch {}
    }, 30_000); // 30 秒ごと external チェック
  } else {
    console.warn('[memory-watchdog] global.gc not available — pass --expose-gc in NODE_OPTIONS for proactive GC');
  }
}
