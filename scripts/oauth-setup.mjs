#!/usr/bin/env node
/**
 * OAuth 1.0a PIN-based flow to get Access Token for @panemaji_bb
 * Run: node scripts/oauth-setup.mjs
 */
import { TwitterApi } from 'twitter-api-v2';
import readline from 'readline';

const API_KEY = 'HGGhQIAWtSJl4NDxxvRMxCmVb';
const API_SECRET = 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv';

async function main() {
  console.log('🔑 OAuth 1.0a PIN-based認証フロー開始...\n');

  const client = new TwitterApi({
    appKey: API_KEY,
    appSecret: API_SECRET,
  });

  // Step 1: Get request token with PIN-based (oob) callback
  const authLink = await client.generateAuthLink('oob');

  console.log('📋 以下のURLをブラウザで開いて、@panemaji_bb でログインして認可してください:');
  console.log(`\n  ${authLink.url}\n`);
  console.log('認可後に表示されるPINコードを入力してください。');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const pin = await new Promise((resolve) => {
    rl.question('PIN: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  // Step 2: Exchange PIN for Access Token
  const loginClient = new TwitterApi({
    appKey: API_KEY,
    appSecret: API_SECRET,
    accessToken: authLink.oauth_token,
    accessSecret: authLink.oauth_token_secret,
  });

  const { accessToken, accessSecret, screenName, userId } = await loginClient.login(pin);

  console.log(`\n✅ 認証成功! @${screenName} (ID: ${userId})\n`);
  console.log('=== Renderに設定する環境変数 ===');
  console.log(`X_API_KEY=${API_KEY}`);
  console.log(`X_API_SECRET=${API_SECRET}`);
  console.log(`X_ACCESS_TOKEN=${accessToken}`);
  console.log(`X_ACCESS_TOKEN_SECRET=${accessSecret}`);
  console.log('\n上記の値をRenderの環境変数に設定してください。');
}

main().catch(console.error);
