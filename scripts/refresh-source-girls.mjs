#!/usr/bin/env node
/**
 * cityheaven 以外のソースの「嬢の在籍情報」を定期更新する。
 *
 * 背景 (2026-09-05):
 *   在籍嬢 371,988 人のうち直近30日に確認できたのは 4.6% しかなかった。
 *   cityheaven は update-all.mjs が巡回しているが (commit 0a63aa1 でバグ修正)、
 *   それ以外のソースには **更新経路が1つも無かった**。
 *
 *     ranking-deli  99,999人  最終確認 2026-04-26
 *     fuzoku.jp     43,870人  最終確認 2026-04-26
 *     purelovers     8,203人  最終確認 2026-04-26
 *
 *   既存の update-rd-girl-images.mjs / update-pl-girl-images.mjs /
 *   update-fuzoku-girls.mjs は名前に反して「画像欠け・嬢0の穴埋め」用で、
 *   既存の嬢の last_seen_at を更新せず、退店処理も無く、
 *   daily-maintenance からも呼ばれていなかった。
 *
 *   sitemap の lastmod は last_seen_at 基準なので、Google から見ると
 *   これらのページは「4月から更新なし」に見えていた。
 *
 * 使い方:
 *   node scripts/refresh-source-girls.mjs --source rd     --limit 300
 *   node scripts/refresh-source-girls.mjs --source fuzoku --limit 300
 *   node scripts/refresh-source-girls.mjs --source pl     --dry-run
 *
 * 安全設計 (update-all.mjs の実績ある作りに合わせる):
 *   - 1ページも取れなかった店はスキップ (退店処理を一切走らせない)
 *   - 退店は「今回その店で実際に見つかった girls.id 以外」に限定。
 *     source_id を持つ嬢と持たない嬢が混在していても取り違えない。
 *   - 店をまたぐ更新はしない (WHERE shop_id = ? が必ず入る)
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'panemaji.db');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => sleep(1500 + Math.random() * 900);

// 1店あたりの最大ページ数。ranking-deli は 1ページ10人・DB上の最大は418人なので
// 12 では確実に足りず、途中で打ち切ると「取れなかった残り」を全員退店にしてしまう。
// 余裕を持たせた上で、打ち切りに当たった店では退店処理自体を行わない (下記 truncated)。
const MAX_PAGES = 60;

/**
 * 取得した嬢名からキャッチコピーを落として DB の表記に合わせる。
 *
 * 掲載元は「みゆう【現役学生の田舎娘】」のように名前＋煽り文で出すが、
 * DB 側は「みゆう」で保存されている (master 実測: 在籍嬢のうち 【 を含む名前は 0件)。
 * これを揃えないと名前照合が全滅し、同じ嬢を「新規追加 + 既存を退店」に
 * してしまう = /girl/{id} の URL が総入れ替えになり SEO 的に最悪。
 * 実際 purelovers の初回テストでは 8店で 確認4 / 新規21 / 退店27 という churn が出た。
 */
function cleanGirlName(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[【\[][^】\]]*[】\]]/g, ' ')   // 【…】 [ … ] のキャッチコピー
    // 閉じ括弧の無い「ひずき【148cm☆...」= 過去の取込で途中で切れた名前。
    // master 実測では cityheaven 由来の在籍嬢の 12% (22,083人) が末尾 "..." で切れている。
    // 開き括弧以降を落とさないと、掲載元の完全な名前と永久に照合できない。
    .replace(/[【\[][^】\]]*$/, ' ')
    .replace(/[（(]\s*\d+\s*[)）]\s*$/, ' ') // 末尾の (20) 年齢
    .replace(/[.．…]{2,}\s*$/, ' ')          // 末尾の省略記号
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgs() {
  const a = process.argv.slice(2);
  const val = (k) => a.find((x, i) => a[i - 1] === k) || null;
  return {
    source: val('--source'),
    staleDays: Number(val('--stale-days') || 7),
    limit: Number(val('--limit') || 0),
    dryRun: a.includes('--dry-run'),
  };
}

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (r.status === 404 || r.status === 403 || r.status === 410) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i === retries - 1) return null;
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// ─── ソースごとのアダプタ ────────────────────────────
// listUrl(shop, page) → 取得URL (null なら以降のページ無し)
// parse(html, shop)   → [{ name, imageUrl, sourceId }]
//   sourceId は照合に使える安定IDがあるときだけ返す (無ければ name で照合)

const ADAPTERS = {
  // 駅ちか
  rd: {
    label: 'ranking-deli',
    match: '%ranking-deli%',
    listUrl(shop, page) {
      const base = shop.source_url.replace(/\/?$/, '/') + 'girlslist/';
      return page === 1 ? base : `${base}page${page}/`;
    },
    parse(html) {
      const out = [];
      const seen = new Set();
      const push = (name, ctx) => {
        const n = cleanGirlName(name);
        if (!n || seen.has(n)) return;
        seen.add(n);
        const im =
          ctx.match(/background:\s*url\((https:\/\/fuzoku-images\.ranking-deli\.jp\/[^)]+\.(?:jpg|jpeg|png|webp))/) ||
          ctx.match(/(?:src|data-src)=["'](https?:\/\/[^"']*fuzoku-images\.ranking-deli[^"']*\.(?:jpg|jpeg|png|webp))/);
        out.push({ name: n, imageUrl: im ? im[1] : null, sourceId: null });
      };
      for (const re of [/<p\s+class="girls-name[^"]*">\s*([^<]+?)\s*<\/p>/g, /class="data-name\s+ellipsis"[^>]*>\s*([^<]+?)\s*</g]) {
        let m;
        while ((m = re.exec(html))) {
          push(m[1], html.slice(Math.max(0, m.index - 1500), Math.min(html.length, m.index + 1500)));
        }
      }
      return out;
    },
  },

  // 風俗じゃぱん
  fuzoku: {
    label: 'fuzoku.jp',
    match: '%fuzoku.jp%',
    slug(shop) {
      const m = shop.source_url.match(/fuzoku\.jp\/([^/?#]+)/);
      return m ? m[1] : null;
    },
    listUrl(shop, page) {
      const slug = ADAPTERS.fuzoku.slug(shop);
      if (!slug) return null;
      const base = `https://fuzoku.jp/${slug}/girllist/`;
      return page === 1 ? base : `${base}page${page}/`;
    },
    parse(html, shop) {
      const slug = ADAPTERS.fuzoku.slug(shop);
      if (!slug) return [];
      const out = [];
      const seen = new Set();
      // 🚨 href はシングルクォート。既存の update-fuzoku-girls.mjs は
      //    href="..." (二重引用符) しか見ておらず、常に0件になっていた。
      const re = new RegExp(`href=['"](?:https?://fuzoku\\.jp)?/${slug}/girl/(\\d+)/['"]`, 'g');
      let m;
      while ((m = re.exec(html))) {
        const gid = m[1];
        if (seen.has(gid)) continue;
        seen.add(gid);
        const ctx = html.slice(m.index, Math.min(html.length, m.index + 2500));
        const alt = ctx.match(/<img[^>]*\salt="([^"]+)"/);
        const img = ctx.match(/data-original="([^"]+\.(?:jpg|jpeg|png|webp))[^"]*"/) || ctx.match(/<img[^>]*\ssrc="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))[^"]*"/);
        const name = alt ? cleanGirlName(alt[1]) : '';
        if (!name) continue;
        out.push({ name, imageUrl: img ? img[1] : null, sourceId: `fj-${slug}-${gid}` });
      }
      return out;
    },
  },

  // ぴゅあらば (在籍は shop ページ内。専用一覧ページは無い)
  pl: {
    label: 'purelovers',
    match: '%purelovers%',
    listUrl(shop, page) {
      return page === 1 ? shop.source_url : null;
    },
    parse(html, shop) {
      const idm = shop.source_url.match(/\/shop\/(\d+)\//);
      if (!idm) return [];
      const shopId = idm[1];
      const out = [];
      const seen = new Set();
      const re = new RegExp(
        `href="https://purelovers\\.com/shop/${shopId}/girl/(\\d+)/"[\\s\\S]{0,3000}?data-src="(//contents\\.purelovers\\.com/[^"]+\\.(?:jpg|jpeg|png|webp))[^"]*"[\\s\\S]{0,500}?alt="([^/"\\(\\n]+?)\\(\\d+\\)`,
        'g'
      );
      let m;
      while ((m = re.exec(html))) {
        const name = cleanGirlName(m[3]);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        out.push({ name, imageUrl: 'https:' + m[2], sourceId: null });
      }
      return out;
    },
  },
};

// ─── メイン ─────────────────────────────────────────
const opts = parseArgs();
const ad = ADAPTERS[opts.source];
if (!ad) {
  console.error(`--source は ${Object.keys(ADAPTERS).join(' | ')} のいずれか`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

const threshold = new Date(Date.now() - opts.staleDays * 86400000).toISOString();

// 対象: そのソースの active shop で、嬢が0人 または 嬢の最終取得が閾値より古い
let sql = `
  SELECT s.id, s.name, s.source_url
  FROM shops s
  WHERE s.is_active = 1 AND s.source_url LIKE ?
    AND (
      NOT EXISTS (SELECT 1 FROM girls g WHERE g.shop_id = s.id AND g.is_active = 1)
      OR COALESCE((SELECT MAX(g2.last_seen_at) FROM girls g2 WHERE g2.shop_id = s.id AND g2.is_active = 1), '') < ?
    )
  ORDER BY COALESCE((SELECT MAX(g3.last_seen_at) FROM girls g3 WHERE g3.shop_id = s.id AND g3.is_active = 1), '') ASC`;
const params = [ad.match, threshold];
if (opts.limit > 0) { sql += ' LIMIT ?'; params.push(opts.limit); }
const shops = db.prepare(sql).all(...params);

const totalShops = db.prepare('SELECT COUNT(*) c FROM shops WHERE is_active = 1 AND source_url LIKE ?').get(ad.match).c;
console.log(`\n=== ${ad.label} 在籍更新 ===`);
console.log(`  対象 ${shops.length} 店 / active ${totalShops} 店  (${opts.staleDays}日以上未更新${opts.limit ? ` / 上限${opts.limit}` : ''})${opts.dryRun ? '  [DRY-RUN]' : ''}`);

// その店の既存の嬢を一括で読み、JS 側で照合表を作る。
//   DB に保存されている名前自体が汚れている場合がある (過去の cityheaven 取込由来で
//   「ひずき【148cm☆...」のように途中で切れた名前が残っている)。SQL の name 完全一致では
//   拾えないので、両側を cleanGirlName で正規化してから突き合わせる。
const loadExisting = db.prepare('SELECT id, name, source_id, is_active FROM girls WHERE shop_id = ?');
const markSeen = db.prepare("UPDATE girls SET is_active = 1, last_seen_at = ?, image_url = COALESCE(NULLIF(image_url,''), ?) WHERE id = ?");
const insertGirl = db.prepare('INSERT INTO girls (name, shop_id, image_url, source_id, is_active, last_seen_at) VALUES (?, ?, ?, ?, 1, ?)');
// 在籍一覧が取れた = その店はまだ存在する。店側の last_seen_at も更新しておく
// (閉店した店は 404 になり、last_seen_at が古いまま残るので将来の掃除の手がかりになる)。
// ⚠ update-all.mjs の deactivateStaleShops は cityheaven 限定なので、
//   ここで更新しても他ソースの店が巻き込まれて消えることはない。
const markShopSeen = db.prepare('UPDATE shops SET last_seen_at = ? WHERE id = ?');

let nShops = 0, nNew = 0, nSeen = 0, nDeact = 0, nSkip = 0, nImg = 0, nTrunc = 0, nPoor = 0;

for (const shop of shops) {
  nShops++;
  // 全ページを集める
  const all = [];
  const pageSeen = new Set();
  let truncated = false; // MAX_PAGES に当たって最後まで読み切れなかったか
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = ad.listUrl(shop, page);
    if (!url) break;
    const html = await fetchPage(url);
    await delay();
    if (!html) break;
    const rows = ad.parse(html, shop);
    const fresh = rows.filter((r) => {
      const key = r.sourceId || r.name;
      if (pageSeen.has(key)) return false;
      pageSeen.add(key);
      return true;
    });
    if (fresh.length === 0) break; // 新規が出なくなったら終わり
    all.push(...fresh);
    // 最終ページまで読んでも新規が出続けている = まだ先がある可能性
    if (page === MAX_PAGES) truncated = true;
  }

  // 🚨 1件も取れなかった店は「構造変更 / 遮断 / 一時エラー」の可能性があるので何もしない。
  //    ここで退店処理を走らせると全員を消してしまう。
  if (all.length === 0) { nSkip++; continue; }

  if (opts.dryRun) {
    console.log(`  [dry] ${shop.name}: ${all.length}人 取得`);
    continue;
  }

  const now = new Date().toISOString();
  // 退店判定の分母。既存の在籍数に対してどれだけ照合できたかを見る。
  const existingActive = db.prepare('SELECT COUNT(*) c FROM girls WHERE shop_id = ? AND is_active = 1').get(shop.id).c;
  let matched = 0;

  // 照合表 (在籍中を優先。同名が複数あれば is_active=1 の若い id を採用)
  const existingRows = loadExisting.all(shop.id);
  const bySourceId = new Map();
  const byName = new Map();
  for (const r of [...existingRows].sort((a, b) => (b.is_active - a.is_active) || (a.id - b.id))) {
    if (r.source_id && !bySourceId.has(r.source_id)) bySourceId.set(r.source_id, r);
    const key = cleanGirlName(r.name);
    if (key && !byName.has(key)) byName.set(key, r);
  }

  const tx = db.transaction(() => {
    markShopSeen.run(now, shop.id);
    const seenRowIds = new Set();
    for (const g of all) {
      let row = (g.sourceId && bySourceId.get(g.sourceId)) || byName.get(cleanGirlName(g.name)) || null;
      if (row && seenRowIds.has(row.id)) row = null; // 同一行への二重割当を防ぐ
      if (row) {
        const before = db.prepare("SELECT COALESCE(NULLIF(image_url,''),'') i FROM girls WHERE id = ?").get(row.id).i;
        markSeen.run(now, g.imageUrl, row.id);
        if (!before && g.imageUrl) nImg++;
        seenRowIds.add(row.id);
        matched++;
        nSeen++;
      } else {
        const r = insertGirl.run(g.name, shop.id, g.imageUrl, g.sourceId, now);
        seenRowIds.add(Number(r.lastInsertRowid));
        nNew++;
        if (g.imageUrl) nImg++;
      }
    }

    // 🚨 照合がほとんど効いていない店では退店させない。
    //    掲載元の表記変更 (名前にキャッチコピーが付く等) や source_id の
    //    名前空間ズレが起きると、同じ嬢を「新規 + 既存を退店」に倒してしまい
    //    /girl/{id} の URL が総入れ替えになる (SEO 的に致命的)。
    //    既存が5人以上いるのに3割も照合できないのは異常とみなす。
    const poorMatch = existingActive >= 5 && matched / existingActive < 0.3;
    if (poorMatch) {
      nPoor++;
      console.log(`  [warn] ${shop.name}: 既存 ${existingActive} 人中 ${matched} 人しか照合できず → 退店処理を見送り`);
      return;
    }
    // 退店: 今回この店で見つからなかった在籍嬢だけを落とす。
    //   girls.id で除外するので、source_id あり/なしが混在していても取り違えない。
    //   🚨 ページを読み切れなかった店 (truncated) は「残りが取れていないだけ」の
    //      可能性があるので退店させない。取り違えると実在の嬢を大量に消してしまう。
    if (seenRowIds.size > 0 && !truncated) {
      const ph = [...seenRowIds].map(() => '?').join(',');
      nDeact += db
        .prepare(`UPDATE girls SET is_active = 0 WHERE shop_id = ? AND is_active = 1 AND id NOT IN (${ph})`)
        .run(shop.id, ...seenRowIds).changes;
    }
  });
  tx();
  if (truncated) nTrunc++;

  if (nShops % 25 === 0) {
    console.log(`  ... ${nShops}/${shops.length} (新規 ${nNew} / 確認 ${nSeen} / 退店 ${nDeact} / 取得0 ${nSkip} / 打切 ${nTrunc})`);
  }
}

console.log(`\n  完了: ${nShops} 店`);
console.log(`  新規 ${nNew} | 在籍確認 ${nSeen} | 退店 ${nDeact} | 画像補完 ${nImg} | 取得0でスキップ ${nSkip}`);
db.close();
