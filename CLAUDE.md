# panemaji プロジェクトルール

Claude Codeでこのリポジトリを触る際の必須ルール。最初に読むこと。

## 🚨 エリア定義は必ず MECE の独自定義（**159エリア固定**）

**絶対ルール:** `areas` テーブルの行は **Mutually Exclusive, Collectively Exhaustive**（重複なし・漏れなし）の独自定義で運用する。**エリア数は159で固定**、これより増やしてはいけない。

### 唯一の正（マスターデータ）

- **コード側の正:** `scripts/lib/unified-areas.mjs` の `UNIFIED_AREAS`（**159エリア / 47都道府県** の機械可読マスター）
- **ドキュメント側の正:** `docs/area-definition.md`
- **両者は必ず同期させる**。片方だけ更新するのは絶対NG
- **エリアを追加したい場合は、必ずユーザーに承認を取った上で両者を1コミットで同時更新**

### エリア数は増えない

- 取込で店舗が追加されても、 **エリア数は絶対に159から増えない**
- 新規店舗は必ず既存159エリアのいずれかにマップする（`pickArea()` でキーワード照合）
- どこにも該当しなければ `{pref}-other` または該当pref の `order:1` エリアにフォールバック
- 一時エリア (`-pending`, `-fj-`, `-ch-`, `-rd-`, `-pl-`, `-meste-`, `-robin-`, `-aXXXX` 等) は禁止

### やってはいけないこと

- ❌ シティヘブン・駅ちか・男性用メンエス情報サイト等の外部ソースのエリア名をそのまま `areas` に `INSERT` する
- ❌ 「新宿・歌舞伎町」と「新宿・大久保・高田馬場・中野」のように**同じ地域を指す複数エリア**が共存する状態
- ❌ 整理せずに新しいスクレイパーを動かしてエリアを増やす
- ❌ slug に日本語を含める（`fukuiその他` ❌）。slug は **英小文字+ハイフンのみ**（`fukui-other` ✅）
- ❌ 一時 slug（`-pending`, `-fj-*`, `-ch-*`, `-rd-*`, `-pl-*`, `-meste-*`, `-robin-*`, `*-aXXXX`）を残す

### やるべきこと

- ✅ 取込時は **shop の `area_id` を直接 `unified-areas.mjs` の正規 slug の id にする**（一時エリア新設しない）
- ✅ どうしても一時エリアを使う場合は、**取込完了後に必ず** `node scripts/migrate-areas-mece.mjs --apply` を実行して MECE 状態に戻す
- ✅ 新しい独自エリアを切る場合は **`unified-areas.mjs` と `docs/area-definition.md` を1コミットで同期**
- ✅ エリア重複・slug表記ゆれを見つけたら、**統合マイグレーション案**を提示する

### 取込時の標準コード

```js
import { pickArea, UNIFIED_AREAS } from './lib/unified-areas.mjs';

// shop名 + source_url から正規エリアを推定
const target = pickArea(pref, shopName, sourceUrl, oldAreaName);
// target.slug は必ず unified-areas.mjs に存在する slug
// その area_id を取得してINSERT
```

### 取込完了後の必須実行

```bash
node scripts/migrate-areas-mece.mjs --apply  # 全shopsをMECE再分配 + 空エリア削除
node scripts/preview-duplicate-shops.mjs     # 店舗重複確認
node scripts/merge-duplicate-shops.mjs --apply # 店舗重複統合
```

### 過去の汚染実績

- Area dedup v2/v3/v4 で複数回整理されているが、外部ソース取り込みで毎回荒れる
- 2026-04-26: シティヘブン/駅ちか/ロビン/ぴゅあらば/m-este取込後 areas 429件 → うち 259件がレガシー `-aXXXX` / `-pending` 系（242件は空）
- `tokyo-other` に 1,140件の shops が雑に集約されていた（shop名の都市名キーワードでの再分配が必要）
- `fukuiその他`, `kanagawaその他` 等の **slug日英混在** が複数件混入していた

→ `migrate-areas-mece.mjs` で全店舗を `unified-areas.mjs` のキーワード照合で正規エリアに再分配。**159エリア / レガシー残0 / 余分slug 0** に整理した。これを今後の標準運用とする。

### 取込時のチェックリスト（必須）

新規スクレイパー作成時、 INSERT 直前に以下を必ず守る：

1. ✅ `import { pickArea } from './lib/unified-areas.mjs'` で正規エリアを取得
2. ✅ shop の `area_id` は `pickArea()` で得た slug の id を使用
3. ❌ 一時エリア（`{pref}-pending` 等）を新設しない
4. ❌ `areas` テーブルへの直接 INSERT は禁止（事前にユーザーと docs同期）
5. ✅ 取込完了後、必ず以下3コマンドを実行：
   ```bash
   node scripts/migrate-areas-mece.mjs --apply  # 全shopsをMECE再分配
   node scripts/preview-duplicate-shops.mjs     # 店舗重複確認
   node scripts/merge-duplicate-shops.mjs --apply # 店舗重複統合
   ```
6. ✅ 完了後 `SELECT COUNT(*) FROM areas` が **159** であることを必ず検証

## 🏪 店名は広告ワードを除いた本来の店名のみ保存

**絶対ルール:** スクレイパーが取得する店舗名は、INSERT 直前に必ず `scripts/lib/clean-shop-name.mjs` の `cleanShopName()` を通す。新規スクレイパーは例外なく必須。

### 削除すべき広告ワードの例

- 末尾の販促語: 「激安クーポン！」「クーポン」「割引」「超割引」「予約限定」「お得な情報」
- 販促【】: 「【激安】」「【激安クーポン】」「【限定】」「【NEW OPEN】」「【オープニング】」
- 装飾の `★/☆/♡/◆` の3個以上連続（例: `★★★ 店名 ★★★` → `店名`）
- 末尾の販促コピー: 「-福岡で評判!-」「、博多で人気」「Webで予約」

### 残すべきもの

- 「○○店」「【宮崎店】」「【○○グループ】」等の支店・グループ名
- 「GAL☆PARADISE」「Pinky★ピンキー」等、正規店名内の単独の `★/☆`
- 「ソープランド若葉」「池袋角海老」等、業態名を含む正規店名

### 過去の汚染と対処

DB内に `【】` 含む 45件、`★` 含む 18件、装飾系混入を確認済み。新規取り込み前に必ず `node scripts/fix-shop-names.mjs --apply` で既存DBもクリーンアップする運用とする。

## 🚫 店舗データ重複は絶対作らない

**絶対ルール:** 複数の外部ソースから取込むと、必ず重複が発生する（同一店舗の表記ゆれ、装飾違い、ローマ字/カナ違い、半角/全角違い）。**取込時 + 完了後** の両方で防衛する。

### 取込時の必須実装

新規スクレイパーは INSERT 直前に必ず以下を行う:

1. **名前を `cleanShopName()`** に通す（広告ノイズ除去）
2. **強化重複チェック** をする (単純LIKEや LOWER+space除去ではダメ):
   ```js
   import { registerNormalizeUdf } from './lib/normalize-shop-name.mjs';
   registerNormalizeUdf(db);
   const findShop = db.prepare(`
     SELECT s.id FROM shops s LEFT JOIN areas a ON s.area_id=a.id
     WHERE s.is_active=1 AND a.prefecture=? AND normalize_shop(s.name) = normalize_shop(?)
     LIMIT 1
   `);
   const exists = findShop.get(pref, name);
   if (exists) skip;
   ```

### 取込完了後の必須実行

新ソース取込後は必ず以下を実行する:

```bash
node scripts/preview-duplicate-shops.mjs       # 重複候補確認 (dry-run)
node scripts/merge-duplicate-shops.mjs --apply # 重複を統合
```

### 同一店舗判定の基準

- 同一 `prefecture` （都道府県）かつ
- `normalize_shop(name)` が一致

→ 1店舗とみなす。チェーン店の別都道府県は別店舗扱い。

### normalize_shop の挙動

`scripts/lib/normalize-shop-name.mjs` の `normalizeShopName()`:
- NFKC、装飾記号削除、中黒/ハイフン削除、括弧内削除、スペース全削除
- ひらがな→カタカナ、大小文字統一
- 「店/本店/支店/号店」末尾削除

→ 「ハニーコレクション」「ハニー・コレクション」「ハニーコレクション♡」を全部 `ハニコレクション` に寄せる。

### 過去の汚染実績

fuzoku.jp 取込後の DB に **重複1,181グループ・2,447shops 混入**を確認 (2026-04-26)。統合で `-1,266店`。これを許容しない運用に変更。

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
