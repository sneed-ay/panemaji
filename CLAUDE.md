# panemaji プロジェクトルール

Claude Codeでこのリポジトリを触る際の必須ルール。最初に読むこと。

## 🚨 エリア定義は必ず MECE の独自定義

**絶対ルール:** `areas` テーブルの行は **Mutually Exclusive, Collectively Exhaustive**（重複なし・漏れなし）の独自定義で運用する。

### やってはいけないこと

- ❌ シティヘブン・男性用メンエス情報サイト等の外部ソースのエリア名をそのまま `areas` に `INSERT` する
- ❌ 「新宿・歌舞伎町」と「新宿・大久保・高田馬場・中野」のように**同じ地域を指す複数エリア**が共存する状態
- ❌ 整理せずに新しいスクレイパーを動かしてエリアを増やす

### やるべきこと

- ✅ **独自エリア定義**は `docs/area-definition.md` に記載（都道府県ごとにMECEな一覧）
- ✅ 外部ソース取り込み時は必ず **外部エリア名 → 独自定義エリア** のマッピングテーブルを通す
- ✅ 新しいエリアを独自定義に追加するかは慎重に判断（単純な重複や表記ゆれなら追加しない）
- ✅ エリア重複を見つけたら、ユーザーに報告する前に**統合マイグレーション案**を提示する

### 過去の経緯

複数回（Area dedup v2, v3, v4）整理されているが、その後の外部ソース取り込みで再び荒れるのを繰り返している。ここを厳守しないと毎回同じ議論になる。

## 🎯 SEO関連

- shop / area / 都道府県ページの title は「口コミ・掲示板・パネマジ度」の三点を確実に含める
- サイトヘッダーは `<h1>` にしない。各ページで個別の `<h1>` を使う
- sitemap の lastmod は `last_seen_at` ベース。全URLで today 固定にしない
- ガイド記事 (`src/app/guide/*`) は area/shop からの内部リンクを必ず維持（`RelatedGuides` コンポーネント経由）

## 📊 データソースと DB

- 本番DBは Render 上の SQLite（`panemaji.db`）
- ローカルは GitHub Releases の `db-latest` タグから `scripts/download-db.mjs` でダウンロード可能（ただしストリーム処理に既知バグあり、`curl + gunzip` の方が安全）
- ブラウザ指紋を `reviews.browser_id` に保存。`x-import-*` / `ext-trend-*` / `ch-*` プレフィックスはインポートデータ

## 📈 GSC モニタリング

- `scripts/fetch-gsc.mjs` で週次取得（scheduled-task `panemaji-gsc-weekly` が自動実行）
- 認証は ADC（`gcloud auth application-default login --scopes=...`）
- quota project は GCP `panemaji-gsc-*` プロジェクト
