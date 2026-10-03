# 現状の棚卸し（2026-09-27）

本番公開中（`main` = `c3aca68` 相当）の実装を読み、改善の余地を洗い出した記録。
ここは「何が問題か」だけを書く。「どう直すか」は `docs/adr/` に、「いつ直すか」は `docs/roadmap.md` に書く。

- 重大度: **高** = 本番で利用者が困っている / セキュリティ・プライバシーに関わる、**中** = 品質や保守性を確実に下げている、**低** = 直すと良くなる
- 「ADR」列は、その問題を扱う ADR の番号

## 1. 本番で起きている不具合・制約

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| B-1 | 高 | プレビュー前に「ダウンロード」を押すと、何もダウンロードされない。`setTimeout` のコールバックが、押した時点の `mergedPdfUrl`（`null`）を閉じ込めているため | `app/page.tsx:91` | 0005 |
| B-2 | 高 | 合計およそ 4.5MB を超える PDF は結合できない。Route Handler は Node.js の Vercel Functions で動いており（`runtime` の指定なし）、リクエスト本文の上限が 4.5MB。利用者には「エラーが発生しました」としか出ない | `app/api/merge-pdf/route.ts` | 0002 |
| B-3 | 高 | プレビューが使う `pdfjs-dist@3.11.174` に、細工した PDF で任意の JavaScript を実行できる脆弱性（CVE-2024-4367、4.2.67 で修正）がある。`@react-pdf-viewer` は 2023-03 から更新が止まっており、pdfjs 4 以降に上げられない | `pnpm-lock.yaml`、`components/pdf-preview.tsx` | 0003 |
| B-4 | 中 | パスワード付き・暗号化された PDF を混ぜると、全体が 500 で失敗する。どのファイルが原因かも出ない | `app/api/merge-pdf/route.ts:19` | 0002 |
| B-5 | 中 | `URL.createObjectURL` で作った URL を解放しないので、結合を繰り返すとメモリが増え続ける | `app/page.tsx:72` | 0005 |
| B-6 | 中 | ファイル一覧の `key` が `ファイル名-index`。並び替えのたびに key が変わり、同名ファイルがあると衝突する | `components/file-list.tsx:43` | 0005 |
| B-7 | 中 | 並び替えが HTML5 の Drag and Drop だけなので、スマートフォン（タッチ）とキーボードでは並び替えられない。biome の抑止コメントは「キーボードの代替手段がある」と書いているが、実際にはない | `components/file-list.tsx:40` | 0010 |
| B-8 | 低 | PDF の判定が `file.type` だけ。拡張子が `.pdf` でも MIME が空の環境（一部の Windows / Android）では弾かれる | `components/file-uploader.tsx:18` | 0009 |
| B-9 | 高 | 本番で Web Vitals の送信（`POST /ingest/i/v0/e/`）が Next.js の 404 になり、PostHog に届いていない。Vercel は `vercel.json` の rewrites の `source` を末尾の `/` を区別して照合するので、`/ingest/:path*` が末尾が `/` のパスに当たらない（v1.2.0 で発生。2026-09-28 に発見） | `vercel.json`、本番の通信 | 0021 |
| B-10 | 中 | Sentry にソースマップが送られていない。`next.config` に直接書いた組織名（`vercel-development`）とプロジェクト名（`pdf-merge-app`）が、実際のもの（Vercel の環境変数の `SENTRY_ORG` / `SENTRY_PROJECT`）と違い、アップロードが 403 で失敗していた。Issue のスタックトレースが圧縮後のファイル名のままで、どこで起きたかを読みにくい | `next.config.mjs`、PR #81 の Preview と本番で起こしたエラーの Issue（2026-09-30） | 0007 |

## 2. プライバシー・セキュリティ

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| P-1 | 高 | PDF の中身をサーバーへ送っている。注意事項のモーダルで「機密文書は送らないで」と断っているが、PDF 結合ツールの用途（契約書・請求書・履歴書など）と正面から衝突している | `components/disclaimer-modal.tsx` | 0002 |
| P-2 | 高 | Sentry が `sendDefaultPii: true`（IP アドレスなどを送る）、Session Replay 10%、エラー時 100%。Replay にはファイル名が映る | `instrumentation-client.ts:21,28`、`sentry.*.config.ts` | 0007 |
| P-3 | 中 | セキュリティヘッダ（CSP、`X-Content-Type-Options` など）を何も返していない | `next.config.mjs` | 0017 |
| P-4 | 中 | API にファイル数・サイズ・レートの制限がない | `app/api/merge-pdf/route.ts` | 0002 |
| P-5 | 中 | ブラウザからのアクセスの HTML に、Cloudflare Web Analytics のビーコン（`static.cloudflareinsights.com/beacon.min.js`）が差し込まれ、`/cdn-cgi/rum` にページの閲覧の情報が送られている。ADR 0018 決定 2 で「使わない」とした機能。以前の確認は `Accept: text/html` を付けない `curl` で行っており、差し込まれない応答を見ていた。→ オーナーが Off にし、ビーコンがなくなったことを確かめた（2026-09-28） | ブラウザと `curl -H "Accept: text/html"` の結果（2026-09-28） | 0018 |

## 3. コードベース・依存関係

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| C-1 | 高 | `typescript.ignoreBuildErrors: true` で型エラーがあってもビルドが通る。CI にも型チェックがない | `next.config.mjs:6` | 0004 / 0006 |
| C-2 | 中 | shadcn/ui のコンポーネントが 59 ファイルあるが、アプリが使うのは button / card / checkbox / dialog / label の 5 つだけ。対応する依存（recharts、date-fns、embla、cmdk、vaul、react-hook-form、zod、input-otp、react-day-picker など）も未使用 | `components/ui/`、`package.json` | 0004 |
| C-3 | 中 | 依存の多くが `"latest"`。lockfile はあるが、`pnpm update` で何が上がるか読めない。`happy-dom`、`@vitest/runner`、`prettier`、`path`、`@edge-runtime/vm` が `dependencies` に入っている | `package.json` | 0004 |
| C-4 | 中 | `app/globals.css` と `styles/globals.css` がほぼ同じ内容で 2 つある。読み込まれているのは `styles/` だけだが、`components.json` は `app/` を指す。`hooks/use-mobile.ts` と `components/ui/use-mobile.tsx`、`hooks/use-toast.ts` と `components/ui/use-toast.ts` も重複 | 各ファイル | 0004 |
| C-5 | 中 | `app/page.tsx` が 1 ファイルに状態・通信・ダウンロード・画面を抱えている。SVG のアイコンが全ファイルに直書き（`lucide-react` は入っているのに使っていない） | `app/page.tsx` | 0005 |
| C-6 | 中 | `SentryFrontendError` を投げた直後に自分で `catch` しているので、Sentry には届いていない。一方で「PDF 以外を選んだ」という利用者の操作をエラーとして扱おうとしている | `components/file-uploader.tsx`、`app/page.tsx` | 0007 |
| C-7 | 低 | `useSentry` がマウントのたびに `diagnoseSdkConnectivity()` で通信するが、結果の `isConnected` はどこでも使っていない | `hooks/use-sentry.ts:11` | 0007 |
| C-8 | 低 | README は「Vercel Edge Runtime で結合している」と書いているが、実際は Node.js ランタイム | `README.md` | 0004 |
| C-9 | 低 | Next.js 15.1.9。最新は 16 系 | `package.json` | 0015 |
| C-10 | 低 | `public/lib/pdf.worker.min.js`（1MB）を手でコピーして置いている。`pdfjs-dist` の版と食い違っても気づけない | `public/lib/` | 0003 |
| C-11 | 低 | 使っていない `public/placeholder-*`、`components/theme-provider.tsx`、`.vscode/mcp.json` がリポジトリにある | 各ファイル | 0004 |

## 4. 品質ゲート（CI）

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| Q-1 | 高 | ユニットテストも E2E も `continue-on-error: true`。テストが落ちても CI は緑になる | `.github/workflows/*.yml:37,47` | 0006 |
| Q-2 | 中 | CI は `main` 向けの PR だけで走る。`develop` 向けの PR では何も走らない | `.github/workflows/*.yml` | 0006 |
| Q-3 | 中 | lint（biome）と型チェックを CI で実行していない | 同上 | 0006 |
| Q-4 | 低 | Storybook の a11y テストが `test: "todo"`（違反があっても落ちない） | `.storybook/preview.ts` | 0014 |

## 5. デザイン・UI/UX

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| D-1 | 中 | `<html className="dark">` で固定。OS のライトテーマの人にもダークを出す。`next-themes` は入っているが使っていない | `app/layout.tsx:43` | 0008 |
| D-2 | 中 | shadcn の既定（無彩色の neutral）のままで、ブランドの色・ロゴがない。ヘッダーは「PDF Merger」、メタデータは「PDF Merge App」と名前が揺れている | `styles/globals.css`、`components/header.tsx` | 0008 |
| D-3 | 中 | `--font-sans: "Geist"` を指定しているが、フォントを読み込んでいない（`next/font` なし）。環境ごとに違う書体で描かれる | `styles/globals.css`、`app/layout.tsx:44` | 0008 |
| D-4 | 中 | 「ご利用上の注意」ボタンが `destructive`（赤）。削除や危険な操作の色を案内に使っている | `components/header.tsx:58` | 0008 |
| U-1 | 中 | 開くたびに（タブごとに）注意事項のモーダルが出て、チェックを入れないと閉じられない。Esc でも閉じない。最初の操作までの手数が多い | `components/header.tsx`、`components/disclaimer-modal.tsx:34` | 0009 |
| U-2 | 中 | エラーを `alert()` で出す。どのファイルが悪いのか、何をすればよいのかが分からない | `app/page.tsx:77`、`components/file-uploader.tsx:21` | 0009 |
| U-3 | 中 | 結合の進み具合が「処理中...」の文字だけ。大きいファイルでは固まったように見える | `app/page.tsx` | 0009 |
| U-4 | 低 | プレビューの高さが 800px 固定、ビューアは `theme="dark"` 固定。スマートフォンでは画面より高い | `components/pdf-preview.tsx:51,53` | 0003 |
| U-5 | 低 | 各ファイルのページ数・サムネイルが出ないので、並び順の確認はファイル名頼み | `components/file-list.tsx` | 0009 |
| U-6 | 低 | ドロップできるのは点線の枠の中だけ。「すべてクリア」、出力ファイル名の変更がない | `components/file-uploader.tsx` | 0009 |

## 6. 計測（アナリティクス・パフォーマンス）

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| M-1 | 中 | Vercel Web Analytics はページビューだけ。「アップロード → 結合 → ダウンロード」のどこで離脱しているか、失敗がどれだけあるかが分からない | `app/layout.tsx` | 0011 |
| M-2 | 中 | Web Vitals（LCP / INP / CLS）を実利用者から取っていない。バンドルサイズや Lighthouse の値を追っていない | — | 0012 |
| M-3 | 低 | Sentry の `tracesSampleRate: 1`（全件）。量が増えると無料枠をすぐ使い切る | `instrumentation-client.ts:14` | 0007 |
| M-4 | 中 | ブラウザの Sentry の読み込みと初期化が、最初の表示の JS の処理の半分ほどを占め、ADR 0025 の基準の端末で TBT が関門（200 ms）を超える（223〜245 ms）。DSN のない CI では Sentry が無効なので、本番の利用者の体験より甘く測っている | `instrumentation-client.ts`、ADR 0026 の背景の計測（2026-10-03） | 0026 |

## 7. i18n・a11y・SEO

| ID | 重大度 | 内容 | 根拠 | ADR |
|---|---|---|---|---|
| I-1 | 中 | 文言がすべて日本語でコンポーネントに直書き。英語圏の利用者は使えない | 全コンポーネント | 0013 |
| A-1 | 中 | ドロップ領域・並び替えがキーボードで操作できない（B-7）。追加・削除・並び替え・結合完了がスクリーンリーダーに伝わらない（ライブリージョンなし） | `components/file-uploader.tsx`、`components/file-list.tsx` | 0014 |
| A-2 | 低 | 各ファイルの行に `aria-label="File List"`（英語・全行同じ）。削除ボタンの名前が「削除する」だけで、どのファイルか分からない | `components/file-list.tsx:51` | 0014 |
| S-1 | 中 | `openGraph.url` に `VERCEL_URL`（プロトコルなし・デプロイごとの URL）を入れている。`metadataBase` がないので OGP 画像の URL が正しく作られない可能性がある | `app/layout.tsx:17` | 0016 |
| S-2 | 低 | `robots.txt`、`sitemap.xml`、canonical、構造化データがない | — | 0016 |
| S-3 | 中 | 旧 URL `pdf-merge-app-nine.vercel.app` が 404（`DEPLOYMENT_NOT_FOUND`）。README のデモ URL と、よそに貼られたリンクが切れている。`www.pdf-merge.app` は 307（一時的なリダイレクト）で `pdf-merge.app` に転送されている | `curl` の結果（2026-09-27） | 0016 |
| S-5 | 中 | DNS にワイルドカードのレコード（`*`、プロキシあり）があり、どんなサブドメインも Vercel に届く。Vercel がサブドメインに出している証明書（`*.pdf-merge.app`、Let's Encrypt）は期限切れで、Cloudflare の SSL/TLS を Full (strict) にしたところ、`www` を含むすべてのサブドメインが 526 になった。`www` は Cloudflare の Redirect Rule で直した（ADR 0016 / 0018 の追記）。`www` 以外のサブドメインは 526 のまま | `curl` と `openssl s_client` の結果（2026-09-27） | 0016 |
| S-4 | 低 | `pdf-merge.app` は Cloudflare のプロキシ経由で Vercel に届いている。ブラウザ以外のクライアントは 403 になり、Vercel 側からは実際のリクエストの情報が見えにくい。→ Cloudflare は WAF として意図的に使っている（オーナーの回答 2026-09-27）。CSP・ヘッダ・計測との取り決めが要る | `curl` の結果（2026-09-27） | 0018 |
