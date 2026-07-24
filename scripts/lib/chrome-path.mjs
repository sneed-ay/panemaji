/**
 * Chrome 実行パス解決
 *
 * puppeteer-core は Chrome を同梱しない。~/.cache/puppeteer が空だと
 * launch() が即 "Could not find Chrome (ver. X)" で落ち、Phase 1 の
 * 取込が全滅する（2026-06-28 / 2026-07-25 に発生）。
 *
 * 優先順:
 *   1. PUPPETEER_EXECUTABLE_PATH（CI / 明示指定）
 *   2. ~/.cache/puppeteer の Chrome for Testing（あればそれが正）
 *   3. システムにインストール済みの Chrome / Chromium
 *
 * 3 が使われる場合はバージョンが puppeteer 期待値とずれるが、
 * CDP は後方互換なので取込用途では実用上問題ない。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const SYSTEM_CANDIDATES =
  process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
      ];

/** ~/.cache/puppeteer にインストール済みの Chrome を探す */
function findCachedChrome() {
  const cacheDir =
    process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
  const chromeDir = path.join(cacheDir, 'chrome');
  if (!fs.existsSync(chromeDir)) return null;

  // 新しいビルドを優先（mac_arm-147.0.7727.57 等）
  const builds = fs.readdirSync(chromeDir).sort().reverse();
  for (const build of builds) {
    const base = path.join(chromeDir, build);
    const candidates =
      process.platform === 'darwin'
        ? [
            path.join(base, 'chrome-mac-arm64', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
            path.join(base, 'chrome-mac-x64', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
          ]
        : [
            path.join(base, 'chrome-linux64', 'chrome'),
            path.join(base, 'chrome-linux', 'chrome'),
          ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

/**
 * 解決した Chrome の実行パスを返す。
 * 見つからなければ null（= puppeteer 既定の解決に委ねる）。
 */
export function resolveChromeExecutable() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const cached = findCachedChrome();
  if (cached) return cached;

  for (const c of SYSTEM_CANDIDATES) {
    if (fs.existsSync(c)) {
      console.log(`[chrome-path] puppeteer キャッシュ無し → システム Chrome を使用: ${c}`);
      return c;
    }
  }
  return null;
}

/**
 * puppeteer.launch() のオプションに executablePath を注入して返す。
 * 解決できなければ元のオプションをそのまま返す。
 */
export function withChromePath(launchOptions = {}) {
  if (launchOptions.executablePath) return launchOptions;
  const exe = resolveChromeExecutable();
  return exe ? { ...launchOptions, executablePath: exe } : launchOptions;
}
