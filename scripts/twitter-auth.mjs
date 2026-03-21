#!/usr/bin/env node
/**
 * Twitter OAuth 1.0a PIN-based authentication flow
 * 新アカウント(@aichan_ura_ai)のAccess Token/Secretを取得する
 *
 * Usage: node scripts/twitter-auth.mjs
 */

import { TwitterApi } from 'twitter-api-v2';
import * as readline from 'readline';

const APP_KEY = 'HGGhQIAWtSJl4NDxxvRMxCmVb';
const APP_SECRET = 'AyBk6nngIq5kkq9lNC7dfSdNMFsebNZk4qQjLMC2HrXi7rAjVv';

async function main() {
  console.log('=== Twitter OAuth 1.0a PIN-based Auth ===\n');

  // Step 1: Generate auth link
  const client = new TwitterApi({ appKey: APP_KEY, appSecret: APP_SECRET });
  const authLink = await client.generateAuthLink('oob');

  console.log('以下のURLをブラウザで開いて、@aichan_ura_ai でログインし「許可」を押してください:');
  console.log('\n' + authLink.url + '\n');
  console.log('表示されたPINコードを入力してください:');

  // Step 2: Wait for PIN input
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pin = await new Promise((resolve) => {
    rl.question('PIN: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  // Step 3: Exchange PIN for Access Token
  console.log('\nAccess Tokenを取得中...');
  const loginClient = new TwitterApi({
    appKey: APP_KEY,
    appSecret: APP_SECRET,
    accessToken: authLink.oauth_token,
    accessSecret: authLink.oauth_token_secret,
  });

  const { accessToken, accessSecret, screenName, userId } = await loginClient.login(pin);

  console.log('\n=== 認証成功! ===');
  console.log(`Screen Name: @${screenName}`);
  console.log(`User ID: ${userId}`);
  console.log(`Access Token: ${accessToken}`);
  console.log(`Access Secret: ${accessSecret}`);
  console.log('\nこれらの値をsrc/lib/twitter.tsのTWITTER_CONFIGに設定してください。');
}

main().catch((err) => {
  console.error('認証エラー:', err.message || err);
  if (err.data) console.error('Details:', JSON.stringify(err.data, null, 2));
  process.exit(1);
});
