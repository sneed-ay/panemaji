This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## GA / Search Console

検索パフォーマンスの確認は Search Console の Web UI を使用:

- [Search Console - 検索パフォーマンス](https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fpanemaji.com%2F)

API を使ったレポート生成:

```bash
# 認証設定済みの場合
node scripts/analyze-search.mjs              # 直近28日間
node scripts/analyze-search.mjs --days 90    # 直近90日間
node scripts/analyze-search.mjs --output report  # ファイル出力
```

## データ更新パイプライン

### 統合パイプライン

```bash
node scripts/pipeline.mjs              # フル実行
node scripts/pipeline.mjs --shops-only # 店舗のみ
node scripts/pipeline.mjs --girls-only # 女性のみ
node scripts/pipeline.mjs --reviews    # 口コミ傾向データのみ
node scripts/pipeline.mjs --images     # 画像URLのみ
node scripts/pipeline.mjs --stats      # DB統計のみ
node scripts/pipeline.mjs --search     # 検索クエリ分析のみ
node scripts/pipeline.mjs --pref tokyo # 特定都道府県のみ
node scripts/pipeline.mjs --region 関東 # 特定リージョンのみ
node scripts/pipeline.mjs --force      # 差分スキップせず全取得
node scripts/pipeline.mjs --dry-run    # 実行内容の確認のみ
```

フル実行の処理順序:
1. 店舗 + 女性データ更新 (cityheaven)
2. メンエスデータ更新 (aromaesthe)
3. 画像URL補完
4. 口コミ傾向データ (fujoho)
5. 検索クエリ分析
6. DB統計出力

設定: `scripts/pipeline-config.json`

### GitHub Actions 自動更新

毎週月曜 12:00 JST に `.github/workflows/update-data.yml` で自動実行される。
手動実行も可能（workflow_dispatch）。
