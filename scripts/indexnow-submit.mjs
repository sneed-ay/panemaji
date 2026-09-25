#!/usr/bin/env node
/**
 * IndexNow で Bing 等に URL を知らせる (2026-09-25)
 *
 * 9/17-23 の自然検索は google +66% / yahoo +81% に対し bing だけ −3%。Bing は巡回が少ないので、
 * こちらから「このページがある」と知らせる。IndexNow は Bing・Yandex・Seznam 等が共有している。
 *
 * - URL は本番のサイトマップから拾う (手元の DB と本番では嬢の id が違うので、手元から URL を作らない)
 * - まだ一度も知らせていない URL を、1回あたり --max 件 (既定 1万) まで。店・一覧・ガイドを先、嬢を後に
 * - 知らせた URL は状態ファイルに追記し、二度は送らない (サイトマップの lastmod は在籍確認日で毎日変わるため、
 *   「更新された」を基準にすると毎日ほぼ全ページを送ることになる)
 *
 * 使い方: node scripts/indexnow-submit.mjs [--max 10000] [--dry-run]
 * 状態ファイル: $INDEXNOW_STATE (既定 ~/panemaji-data/indexnow-submitted.txt)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const HOST = 'panemaji.com';
const KEY = 'cdea41d9795e6d101479773a38f949d7'; // public/<KEY>.txt と同じ値 (IndexNow の鍵は公開前提)
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000; // IndexNow の1リクエスト上限

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const MAX = Number((args[args.indexOf('--max') + 1] || '').match(/^\d+$/) ? args[args.indexOf('--max') + 1] : 10000);
const STATE = process.env.INDEXNOW_STATE || path.join(os.homedir(), 'panemaji-data', 'indexnow-submitted.txt');

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'panemaji-indexnow' }, signal: AbortSignal.timeout(120_000) });
      if (r.ok) return await r.text();
      console.log(`[indexnow] ${url} → ${r.status}`);
    } catch (e) { console.log(`[indexnow] ${url} 取得失敗: ${e.message}`); }
    await new Promise((res) => setTimeout(res, 5000));
  }
  return '';
}
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

const index = await get(`https://${HOST}/sitemap.xml`);
const maps = locs(index).filter((u) => !u.includes('sitemap-image'));
if (maps.length === 0) { console.log('[indexnow] サイトマップが取れない → 中止'); process.exit(0); }

const all = [];
for (const m of maps) all.push(...locs(await get(m)));
const uniq = [...new Set(all)].filter((u) => u.startsWith(`https://${HOST}`));

const done = new Set(fs.existsSync(STATE) ? fs.readFileSync(STATE, 'utf8').split('\n').filter(Boolean) : []);
const rank = (u) => (u.includes('/girl/') ? 2 : u.includes('/shop/') ? 1 : 0);
const todo = uniq.filter((u) => !done.has(u)).sort((a, b) => rank(a) - rank(b)).slice(0, MAX);
console.log(`[indexnow] サイトマップ ${maps.length}本・URL ${uniq.length} / 送信済み ${done.size} / 今回 ${todo.length}${DRY ? ' (dry-run)' : ''}`);
if (DRY || todo.length === 0) process.exit(0);

fs.mkdirSync(path.dirname(STATE), { recursive: true });
let sent = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const urlList = todo.slice(i, i + BATCH);
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
    signal: AbortSignal.timeout(120_000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
  // 200 = 受理 / 202 = 受理 (鍵の確認待ち)。それ以外は送信済みにしない
  if (r.status === 200 || r.status === 202) {
    fs.appendFileSync(STATE, urlList.join('\n') + '\n');
    sent += urlList.length;
  } else {
    console.log(`[indexnow] 送信失敗 status=${r.status} ${(await r.text()).slice(0, 200)}`);
    break;
  }
}
console.log(`[indexnow] 送信 ${sent}件`);
