#!/usr/bin/env node
// fuzoku.jp エリア → 独自slug マッピング表を生成
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { OVERRIDES } from './fuzoku-area-overrides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB = new Database(path.join(PROJECT_ROOT, 'panemaji.db'), { readonly: true });

// 独自定義の clean slug のみ（legacy XXXX-aNNNN 形式と -other は除外）
const dbAreas = DB.prepare(`
  SELECT prefecture, slug, name
  FROM areas
  WHERE prefecture IS NOT NULL AND prefecture != ''
    AND slug NOT GLOB '*-a[0-9][0-9][0-9][0-9]'
    AND slug NOT LIKE '%-other'
  ORDER BY prefecture, slug
`).all();

const byPref = {};
for (const a of dbAreas) {
  if (!byPref[a.prefecture]) byPref[a.prefecture] = [];
  byPref[a.prefecture].push(a);
}

const otherByPref = {};
for (const o of DB.prepare(`SELECT prefecture, slug FROM areas WHERE slug LIKE '%-other'`).all()) {
  otherByPref[o.prefecture] = o.slug;
}

function tokens(name) {
  return name.split(/[・\/／]/).map(t => t.trim()).filter(Boolean);
}

function score(fTokens, dbName) {
  let s = 0;
  for (const t of fTokens) if (dbName.includes(t)) s += t.length;
  return s;
}

const raw = fs.readFileSync('/tmp/fuzoku-areas-raw.txt', 'utf8').trim().split('\n');
const seen = new Set();
const rows = [];

for (const line of raw) {
  const [pref, rawArea] = line.split('|');
  const key = `${pref}|${rawArea}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const area = rawArea.replace(/\s*風俗\s*$/, '').trim();
  const fTokens = tokens(area);

  // Check manual override first
  const overrideKey = `${pref}|${area}`;
  const override = OVERRIDES[overrideKey];

  const candidates = byPref[pref] || [];
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const sc = score(fTokens, c.name);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }

  let slug, name, confidence;
  if (override) {
    slug = override;
    const cand = candidates.find(c => c.slug === override) || { slug: override, name: '(via override)' };
    name = cand.name || otherByPref[pref] === override ? '(その他)' : cand.name;
    confidence = 'OVERRIDE';
  } else if (best && bestScore >= area.length) {
    slug = best.slug; name = best.name; confidence = 'HIGH';
  } else if (best) {
    slug = best.slug; name = best.name; confidence = 'MED';
  } else {
    slug = otherByPref[pref] || '';
    name = otherByPref[pref] ? '(その他)' : '';
    confidence = 'LOW';
  }

  rows.push({
    prefecture: pref,
    fuzoku_area: rawArea,
    normalized: area,
    suggested_slug: slug,
    suggested_name: name,
    confidence,
  });
}

let csv = 'prefecture,fuzoku_area,normalized,suggested_slug,suggested_name,confidence\n';
for (const r of rows) {
  csv += `${r.prefecture},"${r.fuzoku_area}","${r.normalized}",${r.suggested_slug},"${r.suggested_name}",${r.confidence}\n`;
}
fs.writeFileSync(path.join(PROJECT_ROOT, 'docs/fuzoku-area-mapping.csv'), csv);

const byConf = {};
for (const r of rows) byConf[r.confidence] = (byConf[r.confidence] || 0) + 1;
console.log('総エリア:', rows.length);
console.log('信頼度:', byConf);

console.log('\n=== LOW信頼度（要レビュー） ===');
const lowByPref = {};
for (const r of rows.filter(r => r.confidence === 'LOW')) {
  if (!lowByPref[r.prefecture]) lowByPref[r.prefecture] = [];
  lowByPref[r.prefecture].push(r.normalized);
}
for (const [p, arr] of Object.entries(lowByPref).sort()) {
  console.log(`  ${p}: ${arr.join(', ')}`);
}

console.log('\n=== MED信頼度（要レビュー:30件サンプル） ===');
const medRows = rows.filter(r => r.confidence === 'MED').slice(0, 30);
for (const r of medRows) {
  console.log(`  ${r.prefecture}: "${r.normalized}" → ${r.suggested_slug} (${r.suggested_name})`);
}

DB.close();
