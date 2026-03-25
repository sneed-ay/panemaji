#!/usr/bin/env node
/**
 * パネマジ掲示板 - 統合データ更新パイプライン
 *
 * 既存の各種スクリプトを統合し、定型的なデータ収集を行う。
 * GitHub Actions のワークフローから呼び出されることを想定。
 *
 * 使い方:
 *   node scripts/pipeline.mjs                  # フル実行（店舗 + 女性 + 画像 + 口コミ + 統計）
 *   node scripts/pipeline.mjs --shops-only     # 店舗一覧のみ
 *   node scripts/pipeline.mjs --girls-only     # 女性データのみ
 *   node scripts/pipeline.mjs --reviews        # 口コミ傾向データのみ
 *   node scripts/pipeline.mjs --images         # 画像URL補完のみ
 *   node scripts/pipeline.mjs --stats          # DB統計出力のみ
 *   node scripts/pipeline.mjs --search         # 検索クエリ分析のみ
 *   node scripts/pipeline.mjs --pref tokyo     # 特定都道府県のみ
 *   node scripts/pipeline.mjs --region 関東    # 特定リージョンのみ
 *   node scripts/pipeline.mjs --force          # 差分スキップせず全取得
 *   node scripts/pipeline.mjs --resume         # 中断から再開
 *   node scripts/pipeline.mjs --dry-run        # 実行内容の確認のみ
 *
 * 処理フロー:
 *   1. 設定ファイル (pipeline-config.json) の読み込み
 *   2. 全都道府県の店舗一覧を更新 (cityheaven)
 *   3. 全カテゴリの女性データを差分更新 + 画像URL同時取得
 *   4. 画像URL補完（未取得分）
 *   5. 口コミ傾向データの生成 (fujoho)
 *   6. DB統計の出力
 *   7. GitHub Releases へのDBアップロード（CI環境のみ）
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'pipeline-config.json');

// ─── 設定読み込み ────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('設定ファイルが見つかりません: scripts/pipeline-config.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// ─── CLI引数パース ──────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    shopsOnly: args.includes('--shops-only'),
    girlsOnly: args.includes('--girls-only'),
    reviews: args.includes('--reviews'),
    images: args.includes('--images'),
    stats: args.includes('--stats'),
    search: args.includes('--search'),
    force: args.includes('--force'),
    resume: args.includes('--resume'),
    dryRun: args.includes('--dry-run'),
    pref: args.find((a, i) => args[i - 1] === '--pref') || null,
    region: args.find((a, i) => args[i - 1] === '--region') || null,
    help: args.includes('--help') || args.includes('-h'),
  };
}

// ─── サブプロセス実行 ────────────────────────────────
function runScript(scriptPath, args = [], label = '') {
  return new Promise((resolve, reject) => {
    const displayLabel = label || path.basename(scriptPath);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  [pipeline] ${displayLabel} を実行中...`);
    console.log(`  コマンド: node ${scriptPath} ${args.join(' ')}`);
    console.log('='.repeat(60));

    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`  [pipeline] ${displayLabel} 完了 (exit: ${code})`);
        resolve(code);
      } else {
        console.error(`  [pipeline] ${displayLabel} 失敗 (exit: ${code})`);
        // エラーでも続行する（個別ステップの失敗で全体を止めない）
        resolve(code);
      }
    });

    child.on('error', (err) => {
      console.error(`  [pipeline] ${displayLabel} 起動エラー: ${err.message}`);
      resolve(1);
    });
  });
}

// ─── ステップ定義 ────────────────────────────────────

/**
 * Step 1: 全都道府県の店舗 + 女性データ更新（update-all.mjs を使用）
 */
async function stepUpdateAll(opts, config) {
  const args = [];
  if (opts.force) args.push('--force');
  if (opts.resume) args.push('--resume');
  if (opts.region) args.push('--region', opts.region);
  if (opts.pref) args.push('--pref', opts.pref);

  return runScript(
    path.join(__dirname, 'update-all.mjs'),
    args,
    '店舗 + 女性データ更新 (cityheaven)'
  );
}

/**
 * Step 1a: 店舗のみ更新
 */
async function stepShopsOnly(opts, config) {
  // update-all.mjs は店舗と女性を一緒に処理するため、
  // 都道府県ごとに scrape-prefecture.mjs shops を呼び出す
  const prefs = getTargetPrefectures(opts, config);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  [pipeline] 店舗一覧のみ更新: ${prefs.length} 都道府県`);
  console.log('='.repeat(60));

  let errors = 0;
  for (const pref of prefs) {
    const code = await runScript(
      path.join(__dirname, 'scrape-prefecture.mjs'),
      [pref, 'shops'],
      `店舗一覧: ${pref}`
    );
    if (code !== 0) errors++;
  }

  return errors > prefs.length / 2 ? 1 : 0;
}

/**
 * Step 1b: 女性データのみ更新
 */
async function stepGirlsOnly(opts, config) {
  const prefs = getTargetPrefectures(opts, config);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  [pipeline] 女性データのみ更新: ${prefs.length} 都道府県`);
  console.log('='.repeat(60));

  let errors = 0;
  for (const pref of prefs) {
    const args = [pref, 'girls'];
    if (opts.resume) args.push('--resume');

    const code = await runScript(
      path.join(__dirname, 'scrape-prefecture.mjs'),
      args,
      `女性データ: ${pref}`
    );
    if (code !== 0) errors++;
  }

  return errors > prefs.length / 2 ? 1 : 0;
}

/**
 * Step 2: 画像URL補完
 */
async function stepImages(opts, config) {
  return runScript(
    path.join(__dirname, 'scrape-images.mjs'),
    [],
    '画像URL補完'
  );
}

/**
 * Step 3: 口コミ傾向データ生成 (fujoho)
 */
async function stepReviews(opts, config) {
  const scriptPath = path.join(__dirname, 'import-fujoho-trends.mjs');
  if (!fs.existsSync(scriptPath)) {
    console.log('  [pipeline] import-fujoho-trends.mjs が見つかりません。スキップします。');
    return 0;
  }
  return runScript(scriptPath, [], '口コミ傾向データ (fujoho)');
}

/**
 * Step 4: メンエスデータ更新
 */
async function stepMenesu(opts, config) {
  const scriptPath = path.join(__dirname, 'scrape-menesu.mjs');
  if (!fs.existsSync(scriptPath)) {
    console.log('  [pipeline] scrape-menesu.mjs が見つかりません。スキップします。');
    return 0;
  }
  return runScript(scriptPath, ['all'], 'メンエスデータ更新 (aromaesthe)');
}

/**
 * Step 5: 検索クエリ分析
 */
async function stepSearch(opts, config) {
  const scriptPath = path.join(__dirname, 'analyze-search.mjs');
  if (!fs.existsSync(scriptPath)) {
    console.log('  [pipeline] analyze-search.mjs が見つかりません。スキップします。');
    return 0;
  }
  return runScript(scriptPath, ['--output', 'search-report'], '検索クエリ分析');
}

/**
 * Step 6: DB統計出力
 */
async function stepStats(opts, config) {
  const Database = (await import('better-sqlite3')).default;
  const dbPath = path.join(PROJECT_ROOT, config.db_filename);

  if (!fs.existsSync(dbPath)) {
    console.log('  [pipeline] DBファイルが見つかりません。スキップします。');
    return 0;
  }

  const db = new Database(dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');

  console.log(`\n${'='.repeat(60)}`);
  console.log('  [pipeline] DB統計');
  console.log('='.repeat(60));

  try {
    const prefs = db.prepare('SELECT COUNT(DISTINCT prefecture) as c FROM areas WHERE prefecture IS NOT NULL').get();
    const areas = db.prepare('SELECT COUNT(*) as c FROM areas').get();
    const activeShops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active = 1').get();
    const totalShops = db.prepare('SELECT COUNT(*) as c FROM shops').get();
    const activeGirls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active = 1').get();
    const totalGirls = db.prepare('SELECT COUNT(*) as c FROM girls').get();
    const withImages = db.prepare("SELECT COUNT(*) as c FROM girls WHERE is_active = 1 AND image_url IS NOT NULL AND image_url != ''").get();
    const reviews = db.prepare('SELECT COUNT(*) as c FROM reviews').get();

    // カテゴリ別内訳
    const categories = db.prepare(
      'SELECT category, COUNT(*) as c FROM shops WHERE is_active = 1 GROUP BY category ORDER BY c DESC'
    ).all();

    // 都道府県別トップ10
    const prefStats = db.prepare(`
      SELECT a.prefecture, COUNT(DISTINCT s.id) as shops, COUNT(DISTINCT g.id) as girls
      FROM areas a
      JOIN shops s ON s.area_id = a.id AND s.is_active = 1
      LEFT JOIN girls g ON g.shop_id = s.id AND g.is_active = 1
      WHERE a.prefecture IS NOT NULL
      GROUP BY a.prefecture
      ORDER BY shops DESC
      LIMIT 10
    `).all();

    console.log('');
    console.log(`  都道府県:   ${prefs.c}`);
    console.log(`  エリア:     ${areas.c}`);
    console.log(`  店舗:       ${activeShops.c} アクティブ / ${totalShops.c} 合計`);
    console.log(`  女性:       ${activeGirls.c} アクティブ / ${totalGirls.c} 合計`);
    console.log(`  画像あり:   ${withImages.c} (${activeGirls.c > 0 ? Math.round(withImages.c / activeGirls.c * 100) : 0}%)`);
    console.log(`  口コミ:     ${reviews.c}`);

    if (categories.length > 0) {
      console.log('');
      console.log('  カテゴリ別店舗数:');
      for (const cat of categories) {
        console.log(`    ${cat.category}: ${cat.c}`);
      }
    }

    if (prefStats.length > 0) {
      console.log('');
      console.log('  都道府県別 TOP10:');
      for (const p of prefStats) {
        console.log(`    ${(p.prefecture || '不明').padEnd(8)} 店舗:${String(p.shops).padStart(5)} 女性:${String(p.girls).padStart(6)}`);
      }
    }

    console.log('');

    // GitHub Actions 用のサマリー出力
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summary = [
        '## Pipeline Statistics',
        '| Metric | Value |',
        '|--------|-------|',
        `| Prefectures | ${prefs.c} |`,
        `| Active Shops | ${activeShops.c} |`,
        `| Active Girls | ${activeGirls.c} |`,
        `| With Images | ${withImages.c} (${activeGirls.c > 0 ? Math.round(withImages.c / activeGirls.c * 100) : 0}%) |`,
        `| Reviews | ${reviews.c} |`,
      ].join('\n');
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
    }
  } finally {
    db.close();
  }

  return 0;
}

// ─── ヘルパー ────────────────────────────────────────
function getTargetPrefectures(opts, config) {
  if (opts.pref) {
    if (!config.prefectures.includes(opts.pref)) {
      console.error(`不明な都道府県コード: ${opts.pref}`);
      console.error(`有効なコード: ${config.prefectures.join(', ')}`);
      process.exit(1);
    }
    return [opts.pref];
  }

  if (opts.region) {
    const regionPrefs = config.regions[opts.region];
    if (!regionPrefs) {
      console.error(`不明なリージョン: ${opts.region}`);
      console.error(`有効なリージョン: ${Object.keys(config.regions).join(', ')}`);
      process.exit(1);
    }
    return regionPrefs;
  }

  return config.prefectures;
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h${remMin}m`;
}

// ─── メイン ─────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const config = loadConfig();

  if (opts.help) {
    console.log(`
パネマジ掲示板 - 統合データ更新パイプライン

使い方: node scripts/pipeline.mjs [オプション]

オプション:
  --shops-only     店舗一覧のみ更新
  --girls-only     女性データのみ更新
  --reviews        口コミ傾向データのみ
  --images         画像URL補完のみ
  --stats          DB統計出力のみ
  --search         検索クエリ分析のみ
  --pref <code>    特定都道府県のみ (例: tokyo, osaka)
  --region <name>  特定リージョンのみ (例: 関東, 近畿)
  --force          差分スキップせず全取得
  --resume         中断から再開
  --dry-run        実行内容の確認のみ（実際には実行しない）
  --help, -h       このヘルプを表示

フル実行の処理順序:
  1. 店舗 + 女性データ更新 (cityheaven)
  2. メンエスデータ更新 (aromaesthe)
  3. 画像URL補完
  4. 口コミ傾向データ (fujoho)
  5. 検索クエリ分析
  6. DB統計出力

設定ファイル: scripts/pipeline-config.json
`);
    return;
  }

  const startTime = Date.now();
  const isSpecificMode = opts.shopsOnly || opts.girlsOnly || opts.reviews || opts.images || opts.stats || opts.search;

  console.log('');
  console.log('#'.repeat(60));
  console.log('#  パネマジ掲示板 - データ更新パイプライン');
  console.log(`#  ${new Date().toISOString()}`);
  console.log('#'.repeat(60));

  if (opts.pref) console.log(`\n  対象: ${opts.pref}`);
  if (opts.region) console.log(`\n  リージョン: ${opts.region}`);
  if (opts.force) console.log('  モード: 強制再取得');
  if (opts.resume) console.log('  モード: 中断再開');

  // 実行するステップを決定
  const steps = [];

  if (isSpecificMode) {
    if (opts.shopsOnly) steps.push({ name: '店舗一覧更新', fn: stepShopsOnly });
    if (opts.girlsOnly) steps.push({ name: '女性データ更新', fn: stepGirlsOnly });
    if (opts.images) steps.push({ name: '画像URL補完', fn: stepImages });
    if (opts.reviews) steps.push({ name: '口コミ傾向データ', fn: stepReviews });
    if (opts.search) steps.push({ name: '検索クエリ分析', fn: stepSearch });
    if (opts.stats) steps.push({ name: 'DB統計出力', fn: stepStats });
  } else {
    // フル実行
    steps.push(
      { name: '店舗 + 女性データ更新', fn: stepUpdateAll },
      { name: 'メンエスデータ更新', fn: stepMenesu },
      { name: '画像URL補完', fn: stepImages },
      { name: '口コミ傾向データ', fn: stepReviews },
      { name: '検索クエリ分析', fn: stepSearch },
      { name: 'DB統計出力', fn: stepStats },
    );
  }

  console.log(`\n  実行ステップ (${steps.length}件):`);
  for (let i = 0; i < steps.length; i++) {
    console.log(`    ${i + 1}. ${steps[i].name}`);
  }

  if (opts.dryRun) {
    console.log('\n  [dry-run] 実行はスキップされました。');
    return;
  }

  // 各ステップを順次実行
  const results = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepStart = Date.now();

    console.log(`\n${'#'.repeat(60)}`);
    console.log(`#  Step ${i + 1}/${steps.length}: ${step.name}`);
    console.log('#'.repeat(60));

    try {
      const code = await step.fn(opts, config);
      const elapsed = Date.now() - stepStart;
      results.push({ name: step.name, code, elapsed });

      if (code !== 0) {
        console.log(`\n  [pipeline] ${step.name} がエラーで終了 (${formatDuration(elapsed)})`);
        console.log('  次のステップに進みます...');
      } else {
        console.log(`\n  [pipeline] ${step.name} 完了 (${formatDuration(elapsed)})`);
      }
    } catch (e) {
      const elapsed = Date.now() - stepStart;
      results.push({ name: step.name, code: 1, elapsed, error: e.message });
      console.error(`\n  [pipeline] ${step.name} 例外: ${e.message}`);
      console.log('  次のステップに進みます...');
    }
  }

  // パイプラインサマリー
  const totalElapsed = Date.now() - startTime;
  const successes = results.filter(r => r.code === 0).length;
  const failures = results.filter(r => r.code !== 0).length;

  console.log('');
  console.log('#'.repeat(60));
  console.log('#  パイプライン完了サマリー');
  console.log('#'.repeat(60));
  console.log(`  合計時間: ${formatDuration(totalElapsed)}`);
  console.log(`  成功: ${successes} / 失敗: ${failures} / 合計: ${results.length}`);
  console.log('');

  for (const r of results) {
    const status = r.code === 0 ? 'OK' : 'NG';
    console.log(`  [${status}] ${r.name.padEnd(25)} ${formatDuration(r.elapsed)}`);
    if (r.error) console.log(`       エラー: ${r.error}`);
  }

  console.log('');

  // GitHub Actions 用サマリー
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = [
      '## Pipeline Execution Summary',
      `Total time: ${formatDuration(totalElapsed)}`,
      '',
      '| Step | Status | Duration |',
      '|------|--------|----------|',
      ...results.map(r => `| ${r.name} | ${r.code === 0 ? 'OK' : 'FAILED'} | ${formatDuration(r.elapsed)} |`),
    ].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + summary + '\n');
  }

  // 半数以上失敗なら異常終了
  if (failures > results.length / 2) {
    console.error('過半数のステップが失敗しました。異常終了します。');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('\n致命的エラー:', e.message);
  console.error(e.stack);
  process.exit(1);
});
