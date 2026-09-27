# 0016. SEO とメタデータ（metadataBase・robots・sitemap・構造化データ）

- 状態: 提案
- オーナーの確認: 未
- 日付: 2026-09-27
- 関連: S-1 / S-2 / D-2、ADR 0008 / 0013 / 0015

## 背景

- `openGraph.url` に `process.env.VERCEL_URL` を入れている（S-1）。これはプロトコルなしの、デプロイごとに変わる URL（`pdf-merge-app-xxxx.vercel.app`）で、本番の URL ではない。`metadataBase` もないので、OGP 画像の絶対 URL が正しく作られない可能性がある。
- `robots.txt`・`sitemap.xml`・canonical・構造化データがない（S-2）。
- Preview のデプロイも検索エンジンに読まれうる（noindex を返していない）。
- 本番の URL は `pdf-merge-app-nine.vercel.app`。独自ドメインはない。
- ADR 0013 で英語版（`/en`）ができると、言語ごとの URL の関係（hreflang）を検索エンジンに伝える必要がある。

## 決定

1. **サイトの URL の起点を環境変数 1 つにする。** `NEXT_PUBLIC_SITE_URL`（未設定なら `https://${VERCEL_PROJECT_PRODUCTION_URL}`）を `metadataBase` に入れる。`VERCEL_URL` は使わない。
2. **メタデータはロケールごとに `generateMetadata` で作る（ADR 0013）。**
   - `title` は `{ template: "%s - <アプリ名>", default: "<アプリ名> - <説明>" }`（アプリ名は ADR 0008 決定 6）。
   - `alternates.canonical` と `alternates.languages`（`ja` → `/`、`en` → `/en`、`x-default` → `/`）。
   - `openGraph.locale` を `ja_JP` / `en_US`。
   - `keywords` は検索エンジンが使わないので消す。
3. **`app/robots.ts` と `app/sitemap.ts` を置く。**
   - 本番（`VERCEL_ENV === "production"`）: すべて Allow。sitemap に `/` と `/en` と `/about`（とその英語版）を載せる。
   - それ以外: `Disallow: /`、かつ全レスポンスに `X-Robots-Tag: noindex`（ヘッダは ADR 0017 と同じ場所で付ける）。
4. **構造化データ（JSON-LD）の `WebApplication` を置く。** `name`・`description`・`applicationCategory: "UtilitiesApplication"`・`operatingSystem: "Any"`・`offers`（価格 0）・`inLanguage`。
5. **OGP 画像は ADR 0008 で作る静的な画像を、ロケールごとに置く**（`app/[locale]/opengraph-image.png`）。`twitter:card` は `summary_large_image` のまま。
6. **Web App Manifest（`app/manifest.ts`）を置く。** 名前・アイコン・`theme_color`（ADR 0008 のトークンの値）。ホーム画面に追加できるようにするが、Service Worker によるオフライン対応はこの ADR では扱わない（ADR 0002 で処理が端末で完結するので、将来の候補にはなる）。
7. 検索での表示は Google Search Console で見る。登録はオーナーが行う。

## 結果

- 良い点: 共有したときのプレビューと検索の結果が正しくなる。Preview のデプロイが検索に出なくなる。英語版が英語の検索に出る。
- 悪い点: 独自ドメインがないと、`vercel.app` のサブドメインのまま評価を積むことになる（後で移すとリダイレクトの手間がかかる）。

## オーナーに確認したいこと

1. 独自ドメインを取るか。取るなら、この ADR の実装の前にするとよい。
2. Google Search Console への登録。

## 完了条件（DoD）

- [ ] 本番の HTML の `og:url`・`og:image`・canonical が本番の絶対 URL になっている（E2E か `curl` の結果を PR に貼る）
- [ ] `/` と `/en` に、互いを指す hreflang と `x-default` がある
- [ ] 本番の `/robots.txt` が Allow と Sitemap を返し、Preview では `Disallow: /` と `X-Robots-Tag: noindex` を返す
- [ ] `/sitemap.xml` に全ロケールのページがある
- [ ] JSON-LD が Google のリッチリザルトテストでエラーなし
- [ ] `manifest.webmanifest` が配信され、Lighthouse の該当の監査を通る
- [ ] Lighthouse の SEO が 95 以上（ADR 0012）
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
