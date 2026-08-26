#!/usr/bin/env node
/**
 * Google Search Console データ取得 & 分析
 *
 * ⚠️ 2026-08-26 重大バグ修正:
 *   旧版は dimensions=['query'] の合計を「サイト全体の総量」として報告していた。
 *   GSC API のクエリ次元は上位N件しか返さず、希少クエリは匿名化で除外されるため、
 *   panemaji のような極端な長尾サイトでは実数の 2 割程度しか捕捉できていなかった。
 *   （例: 6/21-7/18 スクリプト 9,848 clicks / GSC 画面の実数 50,000+）
 *   その過少値どうしを比較して「-66%」と誤診断した事故が発生。
 *
 *   → 本版では **総量は dimensions を指定しないリクエスト** で取得する。
 *      クエリ次元は「上位N件ぶんの内訳」としてのみ扱い、捕捉率(%)を必ず併記する。
 *
 * 取得するもの:
 *   1. totals       : dimensions なし = サイト全体の正しい総量 (当期 / 前期 / 長期)
 *   2. by_page_type : dimensions=['page'] を URL 種別 (トップ/都道府県/エリア/店舗/嬢/ガイド…) に集計
 *   3. daily        : dimensions=['date'] の時系列
 *   4. top_queries  : dimensions=['query'] の上位N件 + 店名/エリア/ブランドのバケット分け
 *                     （※合計はサイト総量ではない。捕捉率を出力に明示する）
 *
 * 使い方 (SAキーモード・推奨: ADC が失効しても動く):
 *   GSC_SA_KEY=~/.config/panemaji/gsc-sa.json node scripts/fetch-gsc.mjs
 *
 * 使い方 (ADCモード):
 *   事前に一度だけ: gcloud auth application-default login
 *   node scripts/fetch-gsc.mjs
 *
 * 任意環境変数:
 *   GSC_SITE=https://panemaji.com/   プロパティ (sc-domain:panemaji.com も可)
 *   GSC_DAYS=28                      比較期間の長さ
 *   GSC_LONG_DAYS=90                 長期総量の期間 (0 で無効)
 *   GSC_LAG_DAYS=3                   GSC データ遅延の考慮日数
 *   GSC_DATA_STATE=all               all=速報込み(GSC画面の既定) / final=確定のみ
 *   GSC_SEARCH_TYPE=web
 *   GSC_PAGE_ROWS=25000              page 次元の最大取得行数
 *   GSC_QUERY_ROWS=25000             query 次元の最大取得行数
 *   GSC_DB=<path>                    店名/エリア名照合用DB (既定: ~/panemaji-data/panemaji.db)
 *   GSC_ALLOW_EMPTY=1                当期0表示でもエラー終了しない
 *
 * 終了コード:
 *   0 = 正常 / 1 = 一般エラー / 2 = 認証エラー / 3 = データが空(取得失敗の疑い)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SITE_URL = process.env.GSC_SITE || 'https://panemaji.com/';
const KEY_FILE = process.env.GSC_SA_KEY;
const DAYS = Number(process.env.GSC_DAYS || 28);
const LONG_DAYS = Number(process.env.GSC_LONG_DAYS ?? 90);
const LAG_DAYS = Number(process.env.GSC_LAG_DAYS ?? 3);
const DATA_STATE = process.env.GSC_DATA_STATE || 'all';
const SEARCH_TYPE = process.env.GSC_SEARCH_TYPE || 'web';
const PAGE_ROWS = Number(process.env.GSC_PAGE_ROWS || 25000);
const QUERY_ROWS = Number(process.env.GSC_QUERY_ROWS || 25000);
const CURL_TIMEOUT = Number(process.env.GSC_CURL_TIMEOUT || 120);
const MAX_RETRY = Number(process.env.GSC_MAX_RETRY || 3);
const ALLOW_EMPTY = process.env.GSC_ALLOW_EMPTY === '1';

// ADC モードで GSC API を叩くには quota project の明示が必須。
// googleapis ライブラリは x-goog-user-project を送らず "永久 hang" するため、
// REST 直叩き + 明示ヘッダに切替えた (2026-05-29 恒久修正)。
const QUOTA_PROJECT = process.env.GSC_QUOTA_PROJECT || 'panemaji-gsc-3693';
const GSC_ENDPOINT = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;

const API_ROW_LIMIT = 25000; // GSC API の 1 リクエスト上限

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.exitCode = 2;
  }
}

// ─────────────────────────────────────────────────────────────
// 共通ユーティリティ
// ─────────────────────────────────────────────────────────────
const AUTH_TIMEOUT_MS = Number(process.env.GSC_AUTH_TIMEOUT || 60_000);

/** 認証系の Promise に必ずタイムアウトを付ける (無応答で永久 hang させない) */
function withTimeout(promise, ms, message) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AuthError(message)), ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

const sleepSync = (ms) => {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    /* SharedArrayBuffer 不可環境では待たない */
  }
};

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function shiftDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

const fmtInt = (n) => Math.round(n || 0).toLocaleString('en-US');
const fmtPctVal = (n) => `${((n || 0) * 100).toFixed(2)}%`;

// 全角文字を幅2として数えて表を揃える
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/;
export function dispWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += WIDE.test(ch) ? 2 : 1;
  return w;
}
const padEndW = (s, w) => String(s) + ' '.repeat(Math.max(0, w - dispWidth(s)));

function pctChange(cur, prev) {
  if (prev > 0) return ((cur - prev) / prev) * 100;
  return cur > 0 ? Infinity : 0;
}

function fmtPct(n) {
  if (!isFinite(n)) return 'NEW';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────
// 認証
// ─────────────────────────────────────────────────────────────
async function getAuth() {
  if (KEY_FILE) {
    const keyPath = KEY_FILE.replace(/^~/, process.env.HOME || '~');
    if (!fs.existsSync(keyPath)) {
      throw new AuthError(
        `GSC_SA_KEY に指定されたサービスアカウントキーが存在しません: ${keyPath}\n` +
          '  → キーのパスを確認するか、GSC_SA_KEY を外して ADC モードで実行してください。',
      );
    }
    let token;
    try {
      // 認証は google-auth-library のみを使う。
      //   googleapis (巨大パッケージ) は Google Drive 上で import が数分〜無限にハングする
      //   ことを実測で確認済み (2026-08-27: 25秒経過しても解決せず)。
      //   さらに withTimeout は同期的な CJS ロードを中断できないため、フォールバックすると
      //   タイムアウトも効かず「黙って止まる」= 今回5週間データが飛んだのと同じ事故になる。
      //   → フォールバックせず、明示エラーで即座に落とす。
      // OAuth トークンエンドポイントが無応答の場合は withTimeout が効く。
      const t = await withTimeout(
        (async () => {
          let GoogleAuthCtor;
          try {
            ({ GoogleAuth: GoogleAuthCtor } = await import('google-auth-library'));
          } catch (impErr) {
            throw new AuthError(
              'google-auth-library を読み込めません。サービスアカウント認証にはこのパッケージが必要です。\n' +
                `  読み込みエラー: ${impErr && impErr.message}\n` +
                '  → npm install google-auth-library を実行してください。\n' +
                '  (googleapis へのフォールバックは Google Drive 上で永久ハングするため意図的に廃止しています)',
            );
          }
          const auth = new GoogleAuthCtor({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
          });
          const client = await auth.getClient();
          return client.getAccessToken();
        })(),
        AUTH_TIMEOUT_MS,
        `サービスアカウントのトークン取得が ${Math.round(AUTH_TIMEOUT_MS / 1000)} 秒でタイムアウトしました (${keyPath})。\n` +
          '  → ネットワーク到達性 (oauth2.googleapis.com) とキーの有効性を確認してください。',
      );
      token = typeof t === 'string' ? t : t && t.token;
    } catch (e) {
      if (e instanceof AuthError) throw e;
      throw new AuthError(
        `サービスアカウントキーでのトークン取得に失敗しました (${keyPath}): ${e.message}\n` +
          '  → キーが失効/削除されていないか、GCP プロジェクトで Search Console API が有効か確認してください。',
      );
    }
    if (!token) {
      throw new AuthError(`サービスアカウント (${keyPath}) からアクセストークンを取得できませんでした。`);
    }
    // SA は自分のプロジェクトが quota project になるため x-goog-user-project 不要
    return { token, quota: null, mode: `SA key (${keyPath})` };
  }

  // ADC モード: gcloud が refresh token から都度発行 (cron でも安定)
  let raw;
  try {
    raw = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
  } catch (e) {
    const stderr = String((e && e.stderr) || '').trim();
    throw new AuthError(
      `ADC (gcloud) のアクセストークン取得に失敗しました。\n` +
        (stderr ? `  gcloud: ${stderr.split('\n').slice(0, 4).join('\n  ')}\n` : '') +
        '  → 対処: gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly\n' +
        '  → ADC が使えない場合はサービスアカウントキーを使ってください:\n' +
        '     GSC_SA_KEY=/path/to/sa-key.json node scripts/fetch-gsc.mjs',
    );
  }
  const token = String(raw || '').trim();
  // "ERROR: ..." 等がそのまま返るケースを弾く (黙って壊れたトークンで叩くのを防ぐ)
  if (!/^[A-Za-z0-9._~+/=-]{20,}$/.test(token)) {
    throw new AuthError(
      'gcloud が有効なアクセストークンを返しませんでした（ADC 失効の可能性）。\n' +
        `  返却値(先頭200字): ${token.slice(0, 200) || '(空)'}\n` +
        '  → gcloud auth application-default login を実行するか、GSC_SA_KEY を設定してください。',
    );
  }
  return { token, quota: QUOTA_PROJECT, mode: `ADC (quota=${QUOTA_PROJECT})` };
}

// ─────────────────────────────────────────────────────────────
// GSC API 呼び出し
// ─────────────────────────────────────────────────────────────
const HTTP_MARK = '\n__HTTP_STATUS__';

function gscRequest(auth, body, label) {
  // curl にシェルアウト (-m でハードタイムアウト)。
  //   Node の global fetch(undici) がこの環境で GSC への POST 時に稀に "永久 hang" する事象があり
  //   (2026-07 判明)、実績のある curl に置換した。body は @- で stdin 渡し。
  const payload = JSON.stringify(body);
  const args = [
    '-sS',
    '-m', String(CURL_TIMEOUT),
    '-X', 'POST',
    GSC_ENDPOINT,
    '-H', `Authorization: Bearer ${auth.token}`,
    '-H', 'Content-Type: application/json',
    '-w', `${HTTP_MARK}%{http_code}`,
  ];
  if (auth.quota) args.push('-H', `x-goog-user-project: ${auth.quota}`);
  args.push('--data-binary', '@-');

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    let out;
    try {
      out = execFileSync('curl', args, {
        input: payload,
        maxBuffer: 256 * 1024 * 1024,
        encoding: 'utf8',
      });
    } catch (e) {
      lastErr = new Error(`GSC ${label}: curl 実行に失敗 (${e.message})`);
      if (attempt < MAX_RETRY) { sleepSync(2000 * attempt); continue; }
      throw lastErr;
    }

    const idx = out.lastIndexOf(HTTP_MARK);
    const status = idx >= 0 ? Number(out.slice(idx + HTTP_MARK.length).trim()) : 0;
    const text = idx >= 0 ? out.slice(0, idx) : out;

    if (status === 401 || status === 403) {
      throw new AuthError(
        `GSC API が認証エラーを返しました (HTTP ${status}) [${label}]\n` +
          `  応答: ${text.slice(0, 400)}\n` +
          `  → トークンの失効、または ${SITE_URL} への権限不足の可能性があります。\n` +
          '  → ADC の場合: gcloud auth application-default login / SA の場合: そのSAを Search Console のユーザーに追加。',
      );
    }
    if (status === 429 || status >= 500) {
      lastErr = new Error(`GSC ${label}: HTTP ${status} — ${text.slice(0, 200)}`);
      if (attempt < MAX_RETRY) { sleepSync(3000 * attempt); continue; }
      throw lastErr;
    }
    if (status !== 200) {
      throw new Error(`GSC ${label}: HTTP ${status} — ${text.slice(0, 400)}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      lastErr = new Error(`GSC ${label}: JSON パース失敗 — 応答先頭: ${text.slice(0, 300)}`);
      if (attempt < MAX_RETRY) { sleepSync(2000 * attempt); continue; }
      throw lastErr;
    }
    if (data.error) {
      const code = data.error.code;
      const msg = `GSC ${label}: API error ${code} — ${JSON.stringify(data.error).slice(0, 300)}`;
      if (code === 401 || code === 403) throw new AuthError(msg);
      throw new Error(msg);
    }
    return data;
  }
  throw lastErr || new Error(`GSC ${label}: 不明なエラー`);
}

/**
 * 行を取得する。dimensions を省略 (= []) すると **サイト全体の集計 1 行** が返る。
 * これが「正しい総量」。dimensions を指定した場合は startRow でページングする。
 */
function fetchRows(auth, { startDate, endDate, dimensions = [], maxRows = API_ROW_LIMIT, label = 'query' }) {
  const rows = [];
  let startRow = 0;
  for (;;) {
    const remaining = dimensions.length ? maxRows - rows.length : 1;
    if (remaining <= 0) break;
    const rowLimit = dimensions.length ? Math.min(API_ROW_LIMIT, remaining) : 1;
    const body = {
      startDate,
      endDate,
      type: SEARCH_TYPE,
      dataState: DATA_STATE,
      rowLimit,
      startRow,
    };
    if (dimensions.length) body.dimensions = dimensions;
    const data = gscRequest(auth, body, `${label} ${startDate}..${endDate}${startRow ? ` (startRow=${startRow})` : ''}`);
    const batch = data.rows || [];
    rows.push(...batch);
    if (!dimensions.length) break; // 集計行は 1 行のみ
    if (batch.length < rowLimit) break; // これ以上ない
    startRow += batch.length;
  }
  return rows;
}

/** dimensions なし = サイト全体の正しい総量 */
function fetchTotals(auth, startDate, endDate) {
  const rows = fetchRows(auth, { startDate, endDate, dimensions: [], label: 'totals' });
  const r = rows[0] || {};
  const clicks = r.clicks || 0;
  const impressions = r.impressions || 0;
  return {
    start: startDate,
    end: endDate,
    days: Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1,
    clicks,
    impressions,
    ctr: r.ctr != null ? r.ctr : impressions > 0 ? clicks / impressions : 0,
    position: r.position || 0,
  };
}

// ─────────────────────────────────────────────────────────────
// 集計
// ─────────────────────────────────────────────────────────────
/** 行配列 → clicks/impressions/ctr/表示回数加重の平均順位 */
export function aggregate(rows) {
  let clicks = 0;
  let impressions = 0;
  let posWeight = 0;
  for (const r of rows) {
    const c = r.clicks || 0;
    const i = r.impressions || 0;
    clicks += c;
    impressions += i;
    posWeight += (r.position || 0) * i;
  }
  return {
    rows: rows.length,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? posWeight / impressions : 0,
  };
}

export function deltaOf(cur, prev) {
  return {
    clicks: { cur: cur.clicks, prev: prev.clicks, delta: cur.clicks - prev.clicks, pct: pctChange(cur.clicks, prev.clicks) },
    impressions: {
      cur: cur.impressions,
      prev: prev.impressions,
      delta: cur.impressions - prev.impressions,
      pct: pctChange(cur.impressions, prev.impressions),
    },
    ctr: { cur: cur.ctr, prev: prev.ctr, delta: cur.ctr - prev.ctr },
    position: { cur: cur.position, prev: prev.position, delta: cur.position - prev.position },
  };
}

// ─────────────────────────────────────────────────────────────
// ページ種別
// ─────────────────────────────────────────────────────────────
export const PAGE_TYPES = [
  ['top', 'トップ'],
  ['prefecture', '都道府県'],
  ['area', 'エリア'],
  ['shop', '店舗'],
  ['girl', '嬢'],
  ['guide', 'ガイド'],
  ['ranking', 'ランキング'],
  ['search', '検索'],
  ['meta', '固定/会員'],
  ['asset', 'その他/資産'],
];
const PAGE_TYPE_LABEL = Object.fromEntries(PAGE_TYPES);

export function pageType(url) {
  let p;
  try {
    p = new URL(url).pathname;
  } catch {
    p = String(url || '');
  }
  try {
    p = decodeURIComponent(p);
  } catch {
    /* 不正な %エンコードはそのまま */
  }
  p = p.replace(/\/+$/, '') || '/';
  if (p === '/') return 'top';
  if (p.startsWith('/girl')) return 'girl';
  if (p.startsWith('/shop')) return 'shop';
  if (p.startsWith('/area')) return 'area';
  if (p.startsWith('/guide')) return 'guide';
  if (p.startsWith('/ranking')) return 'ranking';
  if (p.startsWith('/search')) return 'search';
  if (/^\/(login|signup|mypage|admin|contact|privacy|terms|unlock|sitemap)/.test(p)) return 'meta';
  if (p.startsWith('/api') || p.startsWith('/_next') || p.includes('.')) return 'asset';
  return 'prefecture'; // src/app/[prefecture]
}

export function groupByPageType(rows) {
  const groups = new Map();
  for (const r of rows) {
    const url = (r.keys && r.keys[0]) || '';
    const t = pageType(url);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push({
      url,
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    });
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────
// クエリのバケット分け (brand / shop_name / area / other)
// ─────────────────────────────────────────────────────────────
const BRAND_PATTERNS = ['panemaji', 'パネマジ', 'パネまじ', 'ぱねまじ', 'パネマ時', 'バネマジ'];

export function normalizeQuery(q) {
  return String(q || '').toLowerCase().replace(/\s+/g, '');
}

export function isBrand(query) {
  const n = normalizeQuery(query);
  return BRAND_PATTERNS.some((p) => n.includes(normalizeQuery(p)));
}

function resolveDbPath() {
  if (process.env.GSC_DB) return process.env.GSC_DB.replace(/^~/, process.env.HOME || '~');
  const master = path.join(process.env.HOME || '', 'panemaji-data', 'panemaji.db');
  if (fs.existsSync(master)) return master;
  return path.join(ROOT, 'panemaji.db');
}

/**
 * DB から店名・エリア名をロード。
 * DB が壊れている/無い場合でも **総量レポートは落とさない** (バケット分けだけ諦める)。
 */
async function loadDbTerms() {
  const dbPath = resolveDbPath();
  try {
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    // shops: 3文字以上（短い店名は汎用語と衝突しやすいため）
    const shops = db
      .prepare('SELECT DISTINCT name FROM shops WHERE is_active=1')
      .all()
      .map((r) => r.name)
      .filter((n) => n && n.length >= 3);
    const areas = db
      .prepare('SELECT name FROM areas')
      .all()
      .map((r) => r.name)
      .filter((n) => n && n.length >= 2);
    db.close();
    return { shops, areas, dbPath, ok: true };
  } catch (e) {
    console.warn(`  ⚠️ DB (${dbPath}) を読めませんでした: ${e.message}`);
    console.warn('     → クエリの店名/エリア分類はスキップします (総量・ページ種別の集計には影響しません)');
    return { shops: [], areas: [], dbPath, ok: false };
  }
}

/** 正規化済み語彙を先頭文字でインデックス化して部分一致を高速化 */
export function buildTermIndex(terms) {
  const byHead = new Map();
  for (const t of terms) {
    const nt = normalizeQuery(t);
    if (nt.length < 2) continue;
    const head = nt[0];
    if (!byHead.has(head)) byHead.set(head, []);
    byHead.get(head).push([nt, t]);
  }
  return byHead;
}

export function matchTerm(query, index) {
  const n = normalizeQuery(query);
  const seen = new Set();
  for (const ch of n) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    const cands = index.get(ch);
    if (!cands) continue;
    for (const [nt, orig] of cands) {
      if (n.includes(nt)) return orig;
    }
  }
  return null;
}

export function bucketizeQueries(rows, shopIndex, areaIndex) {
  const buckets = { brand: [], shop_name: [], area: [], other: [] };
  for (const row of rows) {
    const q = (row.keys && row.keys[0]) || '';
    const entry = {
      query: q,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };
    if (isBrand(q)) {
      buckets.brand.push(entry);
      continue;
    }
    const shopHit = matchTerm(q, shopIndex);
    if (shopHit) {
      entry.matched = shopHit;
      buckets.shop_name.push(entry);
      continue;
    }
    const areaHit = matchTerm(q, areaIndex);
    if (areaHit) {
      entry.matched = areaHit;
      buckets.area.push(entry);
      continue;
    }
    buckets.other.push(entry);
  }
  return buckets;
}

// ─────────────────────────────────────────────────────────────
// 出力
// ─────────────────────────────────────────────────────────────
function printTotals(label, cur, prev) {
  const d = deltaOf(cur, prev);
  console.log(`\n━━━ ${label} ━━━`);
  console.log(`  期間           : ${cur.start} → ${cur.end} (${cur.days}日)  [前期: ${prev.start} → ${prev.end}]`);
  console.log(`  クリック       : ${fmtInt(cur.clicks)} (${fmtPct(d.clicks.pct)})  [前期: ${fmtInt(prev.clicks)}]`);
  console.log(`  表示回数       : ${fmtInt(cur.impressions)} (${fmtPct(d.impressions.pct)})  [前期: ${fmtInt(prev.impressions)}]`);
  console.log(`  CTR            : ${fmtPctVal(cur.ctr)}  (Δ ${((d.ctr.delta) * 100).toFixed(2)}pt)`);
  console.log(`  平均順位       : ${cur.position.toFixed(1)}  (Δ ${d.position.delta >= 0 ? '+' : ''}${d.position.delta.toFixed(1)})`);
  return d;
}

function printPageTypeTable(curGroups, prevGroups, curTotals) {
  const W_TYPE = 12;
  const W_CELL = 30;
  console.log('\n━━━ ページ種別別 (dimensions=[page]) ━━━');
  console.log(
    `  ${padEndW('種別', W_TYPE)}| URL数 | ${padEndW('クリック (当期←前期)', W_CELL)}| ${padEndW('表示 (当期←前期)', W_CELL)}|    CTR | 平均順位`,
  );
  console.log(`  ${'-'.repeat(W_TYPE)}|------:|${'-'.repeat(W_CELL + 1)}|${'-'.repeat(W_CELL + 1)}|-------:|--------:`);
  const result = {};
  for (const [key, label] of PAGE_TYPES) {
    const cur = aggregate(curGroups.get(key) || []);
    const prev = aggregate(prevGroups.get(key) || []);
    if (cur.rows === 0 && prev.rows === 0) continue;
    const d = deltaOf(cur, prev);
    const clickCell = `${fmtInt(cur.clicks).padStart(8)} ← ${fmtInt(prev.clicks).padStart(8)} (${fmtPct(d.clicks.pct).padStart(7)})`;
    const impCell = `${fmtInt(cur.impressions).padStart(8)} ← ${fmtInt(prev.impressions).padStart(8)} (${fmtPct(d.impressions.pct).padStart(7)})`;
    console.log(
      `  ${padEndW(label, W_TYPE)}| ${String(cur.rows).padStart(5)} | ${padEndW(clickCell, W_CELL)}| ${padEndW(impCell, W_CELL)}| ` +
        `${fmtPctVal(cur.ctr).padStart(6)} | ${cur.position.toFixed(1).padStart(8)}`,
    );
    const top = (curGroups.get(key) || []).slice().sort((a, b) => b.clicks - a.clicks).slice(0, 10);
    result[key] = { key, label, cur, prev, delta: d, top_pages: top };
  }
  const curAll = aggregate([...curGroups.values()].flat());
  const covClicks = curTotals.clicks > 0 ? curAll.clicks / curTotals.clicks : 0;
  const covImp = curTotals.impressions > 0 ? curAll.impressions / curTotals.impressions : 0;
  console.log(
    `\n  ⚠️ 上表は上位 ${fmtInt(curAll.rows)} ページぶん。サイト総量に対する捕捉率: ` +
      `クリック ${fmtPctVal(covClicks)} / 表示 ${fmtPctVal(covImp)}`,
  );
  console.log('     (GSC はページ次元も上位N件しか返さないため、種別の「構成比」を見る用途で使うこと)');
  return { types: result, coverage: { clicks: covClicks, impressions: covImp }, fetched: curAll };
}

function printDaily(daily, curStart) {
  console.log('\n━━━ 日次 (dimensions=[date]) ━━━');
  const recent = daily.slice(-Math.min(daily.length, DAYS));
  const maxClicks = Math.max(1, ...recent.map((r) => r.clicks));
  for (const r of recent) {
    const bar = '█'.repeat(Math.max(0, Math.round((r.clicks / maxClicks) * 30)));
    const mark = r.date >= curStart ? ' ' : '·';
    console.log(
      `  ${mark}${r.date}  clicks ${fmtInt(r.clicks).padStart(7)}  imp ${fmtInt(r.impressions).padStart(8)}  ` +
        `CTR ${fmtPctVal(r.ctr).padStart(6)}  pos ${r.position.toFixed(1).padStart(4)}  ${bar}`,
    );
  }
  if (daily.length > recent.length) {
    console.log(`  (直近 ${recent.length} 日のみ表示 / 取得は ${daily.length} 日ぶん。全量は JSON を参照)`);
  }
}

function printQueryBuckets(curBuckets, prevBuckets, curQueryAgg, curTotals) {
  const covClicks = curTotals.clicks > 0 ? curQueryAgg.clicks / curTotals.clicks : 0;
  const covImp = curTotals.impressions > 0 ? curQueryAgg.impressions / curTotals.impressions : 0;
  console.log('\n━━━ クエリ次別 (dimensions=[query]) ━━━');
  console.log(
    `  ⚠️ これは上位 ${fmtInt(curQueryAgg.rows)} クエリぶんの内訳であり、サイト総量ではない。\n` +
      `     捕捉率: クリック ${fmtPctVal(covClicks)} (${fmtInt(curQueryAgg.clicks)} / ${fmtInt(curTotals.clicks)}) / ` +
      `表示 ${fmtPctVal(covImp)} (${fmtInt(curQueryAgg.impressions)} / ${fmtInt(curTotals.impressions)})\n` +
      '     残りは GSC の匿名化・行数上限で取得できない長尾。総量は必ず「サイト全体」セクションを見ること。',
  );
  const summary = {};
  for (const [key, label] of [
    ['brand', 'brand (ブランド指名)'],
    ['shop_name', 'shop_name (店名クエリ)'],
    ['area', 'area (エリア系クエリ)'],
    ['other', 'other (その他)'],
  ]) {
    const cur = aggregate(curBuckets[key]);
    const prev = aggregate(prevBuckets[key]);
    const d = deltaOf(cur, prev);
    summary[key] = { ...d, queries: { cur: cur.rows, prev: prev.rows, delta: cur.rows - prev.rows, pct: pctChange(cur.rows, prev.rows) } };
    console.log(
      `\n  【${label}】 (上位N件内)\n` +
        `    ユニーククエリ : ${fmtInt(cur.rows)} (${fmtPct(pctChange(cur.rows, prev.rows))})\n` +
        `    クリック       : ${fmtInt(cur.clicks)} (${fmtPct(d.clicks.pct)})  [前期: ${fmtInt(prev.clicks)}]\n` +
        `    表示回数       : ${fmtInt(cur.impressions)} (${fmtPct(d.impressions.pct)})  [前期: ${fmtInt(prev.impressions)}]\n` +
        `    CTR / 平均順位 : ${fmtPctVal(cur.ctr)} / ${cur.position.toFixed(1)}`,
    );
  }
  return { summary, coverage: { clicks: covClicks, impressions: covImp } };
}

export function topMovers(curRows, prevRows, n = 10) {
  const prevMap = new Map(prevRows.map((r) => [r.query, r]));
  const all = new Map();
  for (const r of curRows) all.set(r.query, { cur: r, prev: prevMap.get(r.query) });
  for (const [q, p] of prevMap) if (!all.has(q)) all.set(q, { cur: null, prev: p });

  const diffs = [];
  for (const [q, { cur, prev }] of all) {
    const curImp = (cur && cur.impressions) || 0;
    const prevImp = (prev && prev.impressions) || 0;
    diffs.push({
      query: q,
      curImp,
      prevImp,
      delta: curImp - prevImp,
      curClicks: (cur && cur.clicks) || 0,
      curPos: (cur && cur.position) || 0,
    });
  }
  diffs.sort((a, b) => b.delta - a.delta);
  return { top: diffs.slice(0, n), bottom: diffs.slice(-n).reverse() };
}

function printMovers(label, movers) {
  console.log(`\n  【${label} 伸び Top10 (imp 増分)】`);
  for (const m of movers.top) {
    if (m.delta <= 0) break;
    console.log(`    +${String(m.delta).padStart(5)}  imp ${m.prevImp} → ${m.curImp}  clicks ${m.curClicks}  pos ${m.curPos.toFixed(1)}  "${m.query}"`);
  }
  console.log(`\n  【${label} 失速 Top10 (imp 減分)】`);
  for (const m of movers.bottom) {
    if (m.delta >= 0) break;
    console.log(`    ${String(m.delta).padStart(6)}  imp ${m.prevImp} → ${m.curImp}  clicks ${m.curClicks}  pos ${m.curPos.toFixed(1)}  "${m.query}"`);
  }
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔍 GSC データ取得: ${SITE_URL}  (${DAYS}日 vs 前${DAYS}日, dataState=${DATA_STATE}, type=${SEARCH_TYPE})`);

  const auth = await getAuth();
  console.log(`  auth: ${auth.mode}`);

  // 期間計算 (GSC データは約2-3日遅延)
  const base = new Date();
  base.setDate(base.getDate() - LAG_DAYS);
  const curEnd = ymd(base);
  const curStart = shiftDays(curEnd, -(DAYS - 1));
  const prevEnd = shiftDays(curStart, -1);
  const prevStart = shiftDays(prevEnd, -(DAYS - 1));
  const longEnd = curEnd;
  const longStart = LONG_DAYS > 0 ? shiftDays(curEnd, -(LONG_DAYS - 1)) : null;

  console.log(`  当期: ${curStart} → ${curEnd}`);
  console.log(`  前期: ${prevStart} → ${prevEnd}`);
  if (longStart) console.log(`  長期: ${longStart} → ${longEnd} (${LONG_DAYS}日)`);

  // ── 1. サイト全体の総量 (dimensions なし) = 正しい総量 ──────────
  console.log('\n⏳ [1/4] サイト全体の総量を取得中 (dimensions なし)…');
  const curTotals = fetchTotals(auth, curStart, curEnd);
  const prevTotals = fetchTotals(auth, prevStart, prevEnd);
  const longTotals = longStart ? fetchTotals(auth, longStart, longEnd) : null;

  if (!ALLOW_EMPTY && curTotals.impressions === 0 && curTotals.clicks === 0) {
    const err = new Error(
      `当期 (${curStart}〜${curEnd}) の表示回数・クリックがどちらも 0 でした。\n` +
        `  プロパティ指定 (GSC_SITE=${SITE_URL}) が誤っている、または権限がない可能性があります。\n` +
        '  意図的に 0 を許容する場合は GSC_ALLOW_EMPTY=1 を付けてください。',
    );
    err.exitCode = 3;
    throw err;
  }

  // ── 2. ページ次元 ──────────────────────────────────────────
  console.log(`\n⏳ [2/4] ページ次元を取得中 (最大 ${fmtInt(PAGE_ROWS)} 行)…`);
  const curPages = fetchRows(auth, { startDate: curStart, endDate: curEnd, dimensions: ['page'], maxRows: PAGE_ROWS, label: 'page' });
  const prevPages = fetchRows(auth, { startDate: prevStart, endDate: prevEnd, dimensions: ['page'], maxRows: PAGE_ROWS, label: 'page' });
  console.log(`  取得: 当期 ${fmtInt(curPages.length)} pages, 前期 ${fmtInt(prevPages.length)} pages`);

  // ── 3. 日次 ────────────────────────────────────────────────
  const dailyStart = longStart && longStart < prevStart ? longStart : prevStart;
  console.log(`\n⏳ [3/4] 日次を取得中 (${dailyStart} → ${curEnd})…`);
  const dailyRows = fetchRows(auth, {
    startDate: dailyStart,
    endDate: curEnd,
    dimensions: ['date'],
    maxRows: 1000,
    label: 'date',
  });
  const daily = dailyRows
    .map((r) => ({
      date: (r.keys && r.keys[0]) || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // ── 4. クエリ次元 (上位N件のみ・総量ではない) ─────────────────
  console.log(`\n⏳ [4/4] クエリ次元を取得中 (最大 ${fmtInt(QUERY_ROWS)} 行 / これは総量ではない)…`);
  const curQueries = fetchRows(auth, { startDate: curStart, endDate: curEnd, dimensions: ['query'], maxRows: QUERY_ROWS, label: 'query' });
  const prevQueries = fetchRows(auth, { startDate: prevStart, endDate: prevEnd, dimensions: ['query'], maxRows: QUERY_ROWS, label: 'query' });
  console.log(`  取得: 当期 ${fmtInt(curQueries.length)} queries, 前期 ${fmtInt(prevQueries.length)} queries`);

  const { shops, areas, dbPath, ok: dbOk } = await loadDbTerms();
  if (dbOk) console.log(`  DB: ${dbPath} (shops=${fmtInt(shops.length)}, areas=${fmtInt(areas.length)})`);
  const shopIndex = buildTermIndex(shops);
  const areaIndex = buildTermIndex(areas);
  const curBuckets = bucketizeQueries(curQueries, shopIndex, areaIndex);
  const prevBuckets = bucketizeQueries(prevQueries, shopIndex, areaIndex);

  // ── レポート ───────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('📊 サイト全体 (dimensions なし = GSC 画面と一致する正しい総量)');
  console.log('════════════════════════════════════════════════════════════════');
  const totalDelta = printTotals(`直近${DAYS}日 vs 前${DAYS}日`, curTotals, prevTotals);
  if (longTotals) {
    console.log(`\n━━━ 直近${LONG_DAYS}日 (参考) ━━━`);
    console.log(`  期間           : ${longTotals.start} → ${longTotals.end} (${longTotals.days}日)`);
    console.log(`  クリック       : ${fmtInt(longTotals.clicks)}`);
    console.log(`  表示回数       : ${fmtInt(longTotals.impressions)}`);
    console.log(`  CTR            : ${fmtPctVal(longTotals.ctr)}`);
    console.log(`  平均順位       : ${longTotals.position.toFixed(1)}`);
  }

  // 日次合計と総量の整合チェック (乖離があれば取得漏れの警告)
  const dailyCur = daily.filter((r) => r.date >= curStart && r.date <= curEnd);
  const dailySum = aggregate(dailyCur);
  const clickGap = curTotals.clicks - dailySum.clicks;
  if (Math.abs(clickGap) > Math.max(5, curTotals.clicks * 0.01)) {
    console.log(`\n  ⚠️ 日次合計 (${fmtInt(dailySum.clicks)}) と総量 (${fmtInt(curTotals.clicks)}) が乖離しています (${fmtInt(clickGap)})。dataState/遅延を確認。`);
  }

  const pageReport = printPageTypeTable(groupByPageType(curPages), groupByPageType(prevPages), curTotals);
  printDaily(daily, curStart);

  const curQueryAgg = aggregate(curQueries);
  const prevQueryAgg = aggregate(prevQueries);
  const queryReport = printQueryBuckets(curBuckets, prevBuckets, curQueryAgg, curTotals);
  printMovers('shop_name', topMovers(curBuckets.shop_name, prevBuckets.shop_name));
  printMovers('area', topMovers(curBuckets.area, prevBuckets.area));

  // ── JSON ダンプ ────────────────────────────────────────────
  const outDir = path.join(ROOT, 'logs');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = ymd(new Date()).replace(/-/g, '');
  const outPath = path.join(outDir, `gsc-${stamp}.json`);

  const byPageTypeOut = {};
  for (const [key, v] of Object.entries(pageReport.types)) {
    byPageTypeOut[key] = {
      label: v.label,
      cur: v.cur,
      prev: v.prev,
      delta: v.delta,
      share_of_fetched_clicks: pageReport.fetched.clicks > 0 ? v.cur.clicks / pageReport.fetched.clicks : 0,
      top_pages: v.top_pages,
    };
  }

  const byClicks = (a, b) => b.clicks - a.clicks;
  const payload = {
    generated_at: new Date().toISOString(),
    site: SITE_URL,
    meta: {
      auth_mode: auth.mode,
      data_state: DATA_STATE,
      search_type: SEARCH_TYPE,
      lag_days: LAG_DAYS,
      db: dbOk ? dbPath : null,
      note:
        '総量 (totals) は dimensions を指定しないリクエストで取得したサイト全体の値。' +
        'by_page_type / top_queries は次元ごとの上位N件のみで、合計は総量と一致しない (coverage 参照)。',
    },
    periods: {
      current: { start: curStart, end: curEnd, days: DAYS },
      previous: { start: prevStart, end: prevEnd, days: DAYS },
      long: longStart ? { start: longStart, end: longEnd, days: LONG_DAYS } : null,
      daily_range: { start: dailyStart, end: curEnd },
      // 後方互換: analyze-gsc-page2.mjs が periods.curStart/curEnd を読むため残す。
      // 旧JSONを読む既存スクリプトを壊さないこと (2026-08-27)。
      curStart,
      curEnd,
      prevStart,
      prevEnd,
    },
    totals: {
      source: 'searchAnalytics.query (dimensions なし) = サイト全体',
      current: curTotals,
      previous: prevTotals,
      long: longTotals,
      delta: totalDelta,
    },
    by_page_type: {
      note: `dimensions=['page'] の上位 ${fmtInt(pageReport.fetched.rows)} ページを URL 種別に集計したもの`,
      fetched: { cur_pages: curPages.length, prev_pages: prevPages.length, ...pageReport.fetched },
      coverage: pageReport.coverage,
      types: byPageTypeOut,
    },
    daily,
    top_queries: {
      note: `dimensions=['query'] の上位 ${fmtInt(curQueries.length)} 件のみ。合計をサイト総量として扱わないこと`,
      row_limit: QUERY_ROWS,
      fetched: { cur: curQueries.length, prev: prevQueries.length },
      coverage: queryReport.coverage,
      aggregate: { cur: curQueryAgg, prev: prevQueryAgg },
      cur: curBuckets.brand
        .concat(curBuckets.shop_name, curBuckets.area, curBuckets.other)
        .sort(byClicks)
        .slice(0, 500),
      prev: prevBuckets.brand
        .concat(prevBuckets.shop_name, prevBuckets.area, prevBuckets.other)
        .sort(byClicks)
        .slice(0, 500),
    },
    // 後方互換 (analyze-gsc-page2.mjs が data.buckets.cur[bucket] を参照)
    summary: queryReport.summary,
    buckets: { cur: curBuckets, prev: prevBuckets },
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`\n💾 saved: ${outPath}`);
  return payload;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    const isAuth = e instanceof AuthError || e.name === 'AuthError';
    console.error(`\n❌ ${isAuth ? '認証エラー' : 'エラー'}: ${e.message}`);
    if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
    console.error('   GSC データは取得できませんでした（前回の logs/gsc-*.json は更新されていません）。');
    process.exit(e.exitCode || (isAuth ? 2 : 1));
  });
}

export { main, getAuth, fetchRows, fetchTotals, AuthError };
