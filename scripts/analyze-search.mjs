#!/usr/bin/env node
/**
 * Google Search Console 検索クエリ分析スクリプト
 *
 * Search Console API を使って検索キーワードデータを取得し、
 * パネマジ掲示板の SEO 改善提案を自動生成する。
 *
 * 前提条件:
 *   1. Google Cloud Console で Search Console API を有効化
 *   2. サービスアカウントまたは OAuth2 認証情報を作成
 *   3. 認証情報を credentials.json として配置
 *
 * 使い方:
 *   node scripts/analyze-search.mjs                    # 直近28日間のデータ
 *   node scripts/analyze-search.mjs --days 90          # 直近90日間
 *   node scripts/analyze-search.mjs --top 50           # 上位50件
 *   node scripts/analyze-search.mjs --output report    # レポートをファイル出力
 *
 * 環境変数:
 *   GOOGLE_APPLICATION_CREDENTIALS  サービスアカウントの鍵 JSON パス
 *   GSC_SITE_URL                    対象サイト URL（デフォルト: https://panemaji.com/）
 *
 * 認証情報がない場合は、Search Console の Web UI リンクを案内する。
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const SITE_URL = process.env.GSC_SITE_URL || 'https://panemaji.com/';
const SEARCH_CONSOLE_UI_URL = `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(SITE_URL)}`;

// ─── CLI 引数パース ─────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    days: parseInt(args.find((a, i) => args[i - 1] === '--days') || '28', 10),
    top: parseInt(args.find((a, i) => args[i - 1] === '--top') || '30', 10),
    output: args.find((a, i) => args[i - 1] === '--output') || null,
    help: args.includes('--help') || args.includes('-h'),
  };
}

// ─── Search Console API 呼び出し ────────────────────
async function fetchSearchAnalytics(auth, days, rowLimit) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const fmt = (d) => d.toISOString().split('T')[0];

  const body = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ['query'],
    rowLimit,
    dataState: 'final',
  };

  const encodedSiteUrl = encodeURIComponent(SITE_URL);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Search Console API error (${response.status}): ${errText}`);
  }

  return response.json();
}

// ─── ページ別データ取得 ──────────────────────────────
async function fetchPageAnalytics(auth, days, rowLimit) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const fmt = (d) => d.toISOString().split('T')[0];

  const body = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ['page'],
    rowLimit,
    dataState: 'final',
  };

  const encodedSiteUrl = encodeURIComponent(SITE_URL);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Search Console API error (${response.status}): ${errText}`);
  }

  return response.json();
}

// ─── 認証ヘルパー ────────────────────────────────────
async function getAuth() {
  // 方法1: サービスアカウント (GOOGLE_APPLICATION_CREDENTIALS)
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    try {
      const cred = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      const jwt = await createJWT(cred);
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        return { accessToken: tokenData.access_token };
      }
    } catch (e) {
      console.error(`  認証エラー: ${e.message}`);
    }
  }

  // 方法2: ローカルの credentials.json (OAuth2)
  const localCred = path.join(PROJECT_ROOT, 'credentials.json');
  if (fs.existsSync(localCred)) {
    console.log('  credentials.json を検出しましたが、OAuth2 フローは未実装です。');
    console.log('  サービスアカウントの使用を推奨します。');
  }

  return null;
}

// ─── JWT 生成（サービスアカウント用）─────────────────
async function createJWT(credentials) {
  const crypto = await import('crypto');

  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${signInput}.${signature}`;
}

// ─── レポート生成 ────────────────────────────────────
function generateReport(queryData, pageData, opts) {
  const rows = queryData?.rows || [];
  const pageRows = pageData?.rows || [];
  const lines = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  パネマジ掲示板 - 検索クエリ分析レポート');
  lines.push('='.repeat(60));
  lines.push(`  期間: 直近 ${opts.days} 日間`);
  lines.push(`  生成日: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // --- 上位検索クエリ ---
  lines.push('─'.repeat(60));
  lines.push('  上位検索クエリ');
  lines.push('─'.repeat(60));
  lines.push('');
  lines.push(
    '  #'.padEnd(5) +
    'クエリ'.padEnd(30) +
    'クリック'.padStart(8) +
    '表示'.padStart(8) +
    'CTR'.padStart(8) +
    '順位'.padStart(8)
  );
  lines.push('  ' + '-'.repeat(66));

  for (let i = 0; i < Math.min(rows.length, opts.top); i++) {
    const r = rows[i];
    const query = r.keys[0];
    lines.push(
      `  ${(i + 1).toString().padEnd(4)}` +
      `${query.substring(0, 28).padEnd(30)}` +
      `${r.clicks.toString().padStart(8)}` +
      `${r.impressions.toString().padStart(8)}` +
      `${(r.ctr * 100).toFixed(1).padStart(7)}%` +
      `${r.position.toFixed(1).padStart(8)}`
    );
  }

  // --- 改善提案 ---
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('  SEO 改善提案');
  lines.push('─'.repeat(60));
  lines.push('');

  // CTR が低いが表示回数が多いキーワード（タイトル改善候補）
  const lowCtrHighImpressions = rows
    .filter(r => r.ctr < 0.03 && r.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  if (lowCtrHighImpressions.length > 0) {
    lines.push('  [CTR 改善候補] 表示回数が多いが CTR が低いキーワード:');
    lines.push('  → タイトルやメタディスクリプションの改善で CTR 向上が期待できます');
    lines.push('');
    for (const r of lowCtrHighImpressions) {
      lines.push(
        `    "${r.keys[0]}" - 表示:${r.impressions} CTR:${(r.ctr * 100).toFixed(1)}% 順位:${r.position.toFixed(1)}`
      );
    }
    lines.push('');
  }

  // 順位が高い（1-10位）がクリックが少ないキーワード
  const highRankLowClick = rows
    .filter(r => r.position <= 10 && r.clicks < 5 && r.impressions >= 20)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  if (highRankLowClick.length > 0) {
    lines.push('  [機会損失] 上位表示だがクリックが少ないキーワード:');
    lines.push('  → リッチスニペットやタイトル改善で流入増が見込めます');
    lines.push('');
    for (const r of highRankLowClick) {
      lines.push(
        `    "${r.keys[0]}" - 順位:${r.position.toFixed(1)} 表示:${r.impressions} クリック:${r.clicks}`
      );
    }
    lines.push('');
  }

  // 11-20位のキーワード（もう少しで1ページ目）
  const almostFirstPage = rows
    .filter(r => r.position > 10 && r.position <= 20 && r.impressions >= 30)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  if (almostFirstPage.length > 0) {
    lines.push('  [1ページ目到達候補] あと少しで1ページ目のキーワード:');
    lines.push('  → コンテンツ強化や内部リンク改善で順位向上が期待できます');
    lines.push('');
    for (const r of almostFirstPage) {
      lines.push(
        `    "${r.keys[0]}" - 順位:${r.position.toFixed(1)} 表示:${r.impressions} CTR:${(r.ctr * 100).toFixed(1)}%`
      );
    }
    lines.push('');
  }

  // --- パネマジ固有の改善提案 ---
  const panelKeywords = rows.filter(r =>
    r.keys[0].includes('パネマジ') || r.keys[0].includes('パネル') ||
    r.keys[0].includes('写真詐欺') || r.keys[0].includes('パネ')
  );

  if (panelKeywords.length > 0) {
    lines.push('  [パネマジ関連キーワード]:');
    lines.push('');
    for (const r of panelKeywords) {
      lines.push(
        `    "${r.keys[0]}" - 順位:${r.position.toFixed(1)} 表示:${r.impressions} クリック:${r.clicks}`
      );
    }
    lines.push('');
  }

  // --- 上位ページ ---
  if (pageRows.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('  上位ページ (クリック数順)');
    lines.push('─'.repeat(60));
    lines.push('');
    const topPages = pageRows.sort((a, b) => b.clicks - a.clicks).slice(0, 15);
    for (const r of topPages) {
      const pagePath = r.keys[0].replace(SITE_URL, '/');
      lines.push(
        `    ${pagePath.substring(0, 40).padEnd(42)} クリック:${r.clicks} 表示:${r.impressions}`
      );
    }
    lines.push('');
  }

  lines.push('='.repeat(60));
  lines.push('');
  lines.push('  Search Console Web UI:');
  lines.push(`  ${SEARCH_CONSOLE_UI_URL}`);
  lines.push('');

  return lines.join('\n');
}

// ─── デモデータ生成（API 未設定時の説明用）──────────
function generateDemoReport(opts) {
  const lines = [];
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  パネマジ掲示板 - 検索クエリ分析');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push('  [!] Search Console API の認証情報が設定されていません。');
  lines.push('');
  lines.push('  方法1: Web UI で直接確認（推奨）');
  lines.push(`  ${SEARCH_CONSOLE_UI_URL}`);
  lines.push('');
  lines.push('  方法2: API を使用するには以下を設定してください');
  lines.push('  1. Google Cloud Console で Search Console API を有効化');
  lines.push('  2. サービスアカウントを作成');
  lines.push('  3. Search Console でサービスアカウントにアクセス権を付与');
  lines.push('  4. 環境変数を設定:');
  lines.push('     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json');
  lines.push('');
  lines.push('  方法3: GitHub Actions で自動実行');
  lines.push('  - Secrets に GOOGLE_APPLICATION_CREDENTIALS の内容を設定');
  lines.push('  - pipeline.mjs --search で定期的にレポート生成');
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ─── メイン ─────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (opts.help) {
    console.log(`
使い方: node scripts/analyze-search.mjs [オプション]

オプション:
  --days <N>       分析期間（日数、デフォルト: 28）
  --top <N>        表示件数（デフォルト: 30）
  --output <name>  レポートをファイル出力（scripts/<name>.txt）
  --help, -h       このヘルプを表示
`);
    return;
  }

  console.log('検索クエリ分析を開始...');

  const auth = await getAuth();

  let report;
  if (!auth) {
    report = generateDemoReport(opts);
  } else {
    console.log('  Search Console API に接続中...');
    const [queryData, pageData] = await Promise.all([
      fetchSearchAnalytics(auth, opts.days, Math.max(opts.top, 100)),
      fetchPageAnalytics(auth, opts.days, 50),
    ]);

    const queryCount = queryData?.rows?.length || 0;
    console.log(`  ${queryCount} 件のクエリデータを取得`);

    report = generateReport(queryData, pageData, opts);
  }

  console.log(report);

  if (opts.output) {
    const outPath = path.join(PROJECT_ROOT, 'scripts', `${opts.output}.txt`);
    fs.writeFileSync(outPath, report);
    console.log(`\nレポートを保存しました: ${outPath}`);
  }
}

main().catch(e => {
  console.error('エラー:', e.message);
  process.exit(1);
});
