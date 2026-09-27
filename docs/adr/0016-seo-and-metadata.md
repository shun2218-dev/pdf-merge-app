# 0016. SEO とメタデータ（metadataBase・robots・sitemap・構造化データ）

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: S-1 / S-2 / D-2、ADR 0008 / 0013 / 0015

## 背景

- `openGraph.url` に `process.env.VERCEL_URL` を入れている（S-1）。これはプロトコルなしの、デプロイごとに変わる URL（`pdf-merge-app-xxxx.vercel.app`）で、本番の URL ではない。`metadataBase` もないので、OGP 画像の絶対 URL が正しく作られない可能性がある。
- `robots.txt`・`sitemap.xml`・canonical・構造化データがない（S-2）。
- Preview のデプロイも検索エンジンに読まれうる（noindex を返していない）。
- 本番の URL は `pdf-merge-app-nine.vercel.app`。独自ドメイン `pdf-merge.app` は取得済み（オーナーの回答 2026-09-27）で、これを正式な URL にする。
- ADR 0013 で英語版（`/en`）ができると、言語ごとの URL の関係（hreflang）を検索エンジンに伝える必要がある。

## 決定

1. **正式な URL を `https://pdf-merge.app` にし、URL の起点を環境変数 1 つにする。** `NEXT_PUBLIC_SITE_URL`（本番は `https://pdf-merge.app`。未設定なら `https://${VERCEL_PROJECT_PRODUCTION_URL}`）を `metadataBase` に入れる。`VERCEL_URL` は使わない。
   - Vercel のプロジェクトに `pdf-merge.app` を Production のドメインとして追加し、`pdf-merge-app-nine.vercel.app` と `www.pdf-merge.app` から 301 でリダイレクトする（評価を 1 つの URL に集める）。
   - `.app` の TLD はブラウザの HSTS preload に入っていて HTTPS でしか開けない。Vercel が証明書を自動で発行するので追加の作業は要らないが、`http://` のリンクを書かない。
   - README のデモ URL も `https://pdf-merge.app/` に変える。
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
- 悪い点: `vercel.app` の URL がすでに共有・インデックスされている場合、リダイレクトで評価が移り切るまで時間がかかる。

## オーナーに確認したいこと

1. ~~独自ドメインを取るか~~ → **取得済み: `https://pdf-merge.app/`（オーナーの回答 2026-09-27）**。Vercel のプロジェクトへの追加と DNS の設定が済んでいるか。
2. Google Search Console への登録。

**オーナーの回答（2026-09-27）**: すべて提案どおりでよい。Google Search Console にはオーナーが登録する（決定 7）。`pdf-merge.app` を Vercel のプロジェクトに追加済みか・DNS の設定は、実装の最初に確かめる。

## 完了条件（DoD）

- [ ] `pdf-merge-app-nine.vercel.app` と `www.pdf-merge.app` が `https://pdf-merge.app` に 301 でリダイレクトされる
- [ ] 本番の HTML の `og:url`・`og:image`・canonical が本番の絶対 URL になっている（E2E か `curl` の結果を PR に貼る）
- [ ] `/` と `/en` に、互いを指す hreflang と `x-default` がある
- [ ] 本番の `/robots.txt` が Allow と Sitemap を返し、Preview では `Disallow: /` と `X-Robots-Tag: noindex` を返す
- [ ] `/sitemap.xml` に全ロケールのページがある
- [ ] JSON-LD が Google のリッチリザルトテストでエラーなし
- [ ] `manifest.webmanifest` が配信され、Lighthouse の該当の監査を通る
- [ ] Lighthouse の SEO が 95 以上（ADR 0012）
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-27: ドメインの現状の確認

オーナーから「`pdf-merge.app` は登録済み、Google Search Console にも登録済み」と回答があり、`curl` で実際の応答を確かめた。

| URL | 応答 | 決定との差 |
|---|---|---|
| `https://pdf-merge.app/` | 200（本番のアプリ） | — |
| `https://www.pdf-merge.app/` | 307 → `https://pdf-merge.app/` | 決定 1 は恒久のリダイレクト（301 / 308）。307 は一時的なリダイレクトなので、Vercel のドメインの設定で 308 に変える |
| `https://pdf-merge-app-nine.vercel.app/` | **404（`DEPLOYMENT_NOT_FOUND`）** | 旧 URL が死んでいる。README のデモ URL と、よそに貼られたリンクが切れている（S-3）。この URL を持つプロジェクトが別のアカウントにあるなら、そこから `pdf-merge.app` へリダイレクトする |
| `/robots.txt` | 404 | 既知（S-2） |

- 本番の `og:url` は `pdf-merge-o0btx76ap-shun2218devs-projects.vercel.app`（プロトコルなし・デプロイごとの URL）で、背景に書いた S-1 が本番で起きていることを確かめた。
- DNS は Cloudflare にあり、プロキシ（オレンジの雲）を通して Vercel に届いている（`server: cloudflare`）。
  - ブラウザの User-Agent のない `curl` は Cloudflare のボット対策で 403 になる。Slack・X・Facebook のプレビュー用のクローラーは 200 で、OGP の取得には問題ない。
  - Vercel の前にプロキシを置くと、Vercel のファイアウォール・キャッシュ・Speed Insights が実際の利用者の IP やリクエストを正しく扱えないことがある。Vercel は、Cloudflare を DNS のみ（灰色の雲）で使う構成を推奨している。プロキシを外すかどうかは S-4 としてオーナーに確認する（ADR 0012 の計測と ADR 0017 のヘッダにも関わる）。
- Search Console の登録は済んでいる。sitemap の送信は、決定 3 の実装のあとに行う。
- README と CLAUDE.md のデモ URL は `https://pdf-merge.app/` に直した（この追記と同じコミット）。
- 同日、オーナーから「Cloudflare は WAF として使っている（国ごとのブロックを含む）」と回答があった。プロキシは外さず、CSP・ヘッダ・計測との取り決めを ADR 0018 に書いた。この ADR の DoD の「`curl` で確かめる」は、ADR 0018 決定 4 のとおりブラウザの User-Agent で行う。
