#!/usr/bin/env node
/**
 * Download DB from GitHub Releases during build
 * This runs as part of buildCommand where all npm packages are available
 */
import https from 'https';
import http from 'http';
import fs from 'fs';
import zlib from 'zlib';
import Database from 'better-sqlite3';

const DB_URL = 'https://github.com/sneed-ay/panemaji/releases/download/db-latest/panemaji.db.gz';
// Download to both ./panemaji.db (for build) AND DB_PATH env (for runtime)
const DB_PATH = './panemaji.db';
const RUNTIME_DB_PATH = process.env.DB_PATH || DB_PATH;

function download(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'panemaji-build' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('  → Redirect:', res.headers.location.substring(0, 60) + '...');
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const gunzip = zlib.createGunzip();
      const file = fs.createWriteStream(DB_PATH);
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.pipe(gunzip).pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('  Downloaded:', Math.round(bytes / 1024 / 1024) + 'MB compressed →',
          Math.round(fs.statSync(DB_PATH).size / 1024 / 1024) + 'MB uncompressed');
        resolve();
      });
      file.on('error', reject);
      gunzip.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('📥 Downloading 47-prefecture database...');
  await download(DB_URL);

  // Verify
  const db = new Database(DB_PATH);
  const check = db.prepare('PRAGMA integrity_check').get();
  const girls = db.prepare('SELECT COUNT(*) as c FROM girls WHERE is_active=1').get();
  const shops = db.prepare('SELECT COUNT(*) as c FROM shops WHERE is_active=1').get();
  const prefs = db.prepare('SELECT COUNT(DISTINCT prefecture) as c FROM areas WHERE prefecture IS NOT NULL').get();
  console.log('  Integrity:', check.integrity_check);
  console.log('  Prefectures:', prefs.c, '| Shops:', shops.c, '| Girls:', girls.c);
  db.close();

  if (check.integrity_check !== 'ok') {
    throw new Error('DB integrity check failed');
  }

  // Runtime copy handled by init-db.sh at startup (disk not available during build)
  console.log('✅ Database ready for build');
}

main().catch(e => {
  console.error('❌ DB download failed:', e.message);
  process.exit(1);
});
