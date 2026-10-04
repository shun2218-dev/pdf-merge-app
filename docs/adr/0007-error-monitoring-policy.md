# 0007. エラー監視（Sentry）の方針：PII を送らず、送るべきものだけ送る

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: P-2 / C-6 / C-7 / M-3、ADR 0002 / 0011

## 背景

- **`sendDefaultPii: true`（P-2）。** 利用者の IP アドレスなどを Sentry に送っている。
- **Session Replay がセッションの 10%、エラー時は 100%。** 画面にはファイル名（「2026_源泉徴収票_山田.pdf」のような個人情報を含みうる）が映る。Replay の既定のマスクはテキストを隠すが、設定を明示していないので、将来の設定変更で漏れうる。
- **`tracesSampleRate: 1`（M-3）。** 全リクエストのトレースを送っている。
- **送りたいエラーは届いていない（C-6）。** `SentryFrontendError` を投げた直後に、同じ関数の `catch` で握りつぶしている。一方で「PDF 以外を選んだ」のような利用者の操作を、エラーとして送ろうとしている。これは不具合ではなく、アナリティクス（ADR 0011）で数えるものである。
- `useSentry` がマウントのたびに `diagnoseSdkConnectivity()` で通信するが、結果を誰も使っていない（C-7）。
- DSN が 3 つの設定ファイルに直書きされている。

## 決定

1. **PII を送らない。** `sendDefaultPii: false`。`beforeSend` でイベントの中のファイル名（`*.pdf` を含む文字列）を `[file]` に置き換える。
2. **Session Replay は、エラー時だけ・全マスクで使う。** `replaysSessionSampleRate: 0`、`replaysOnErrorSampleRate: 1.0`、`maskAllText: true`、`blockAllMedia: true`。PDF のプレビュー領域（canvas）は `block` にする。
3. **トレースは 10% にする。** `tracesSampleRate: 0.1`。本番の量を見て見直す。
4. **「エラー」と「利用者の操作の結果」を分ける。**
   - Sentry に送るのは、コードの前提が崩れたときだけ（想定外の例外・Worker の異常終了・ライブラリの内部エラー）。`Sentry.captureException` で明示的に送る。
   - PDF 以外を選んだ・暗号化された PDF を選んだ・端末のメモリが足りなかった、は Sentry に送らず、アナリティクスのイベント（ADR 0011）として数える。
   - `SentryFrontendError` と `useSentry` を削除する。
5. **DSN と環境を環境変数から読む。** `NEXT_PUBLIC_SENTRY_DSN`、`environment` は `VERCEL_ENV`（production / preview）。ローカルとテストでは DSN を空にして送らない。
6. **ADR 0002 で API がなくなったら、サーバーと Edge の Sentry の設定（`sentry.server.config.ts` / `sentry.edge.config.ts` / `instrumentation.ts`）を残すか見直す。** ページの描画のエラーを拾う役目は残るので、消すかどうかはその時点で決めて「追記」に書く。
7. **ソースマップのアップロードは続けるが、公開はしない**（`hideSourceMaps` 相当の既定のまま）。

## 結果

- 良い点: プライバシーの約束（ADR 0002「ファイルは端末の外へ送信されません」）と監視の設定が矛盾しなくなる。Sentry に本当に直すべきものだけが集まる。無料枠を使い切りにくくなる。
- 悪い点: エラー以外のセッションの Replay がなくなるので、「エラーにならない使いにくさ」は Replay では見られない。それはアナリティクスのファネル（ADR 0011）で見る。

## オーナーに確認したいこと

1. Replay をエラー時だけにしてよいか。

**オーナーの回答（2026-09-27）**: すべて提案どおりでよい。Session Replay はエラー時だけでよい。

## 完了条件（DoD）

- [x] 3 つの Sentry の設定で `sendDefaultPii` が `false`、DSN が環境変数から読まれている
- [x] `beforeSend` がファイル名を置き換えることをユニットテストで確かめた
- [x] Replay の設定が決定 2 のとおりで、Preview 環境でわざと例外を起こした Replay にファイル名と PDF の中身が映っていないことを目で確かめた
- [x] `SentryFrontendError` と `useSentry` がコードベースにない
- [x] PDF 以外を選んだときに Sentry へ何も送られない（ユニットテストで `captureException` が呼ばれないことを確認）
- [x] ローカルと CI では Sentry に送信されない
- [x] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-27: 実装

- 3 つの `Sentry.init`（`instrumentation-client.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`）の共通の設定を `lib/sentry/options.ts` の `sharedSentryOptions()` にまとめた。
  - `enabled` は DSN があるときだけ `true`。CI とローカルには `NEXT_PUBLIC_SENTRY_DSN` を置かないので送信しない。
  - 環境の名前は `NEXT_PUBLIC_VERCEL_ENV`（Vercel が Next.js のプロジェクトに自動で渡す）。サーバーでもクライアントと同じ変数を使い、名前を 1 つにした。
  - これまでの `enableLogs: true` は、`Sentry.logger` を使っていないので外した。
- ファイル名の除去は `lib/sentry/scrub.ts`。どこに紛れ込むかを追うより、イベントとパンくずの全体の文字列を走査して `*.pdf` で終わる語を `[file]` に置き換える（`beforeSend` と `beforeBreadcrumb`）。元のオブジェクトは書き換えない。
- Session Replay は `maskAllText` / `maskAllInputs` / `blockAllMedia` に加えて `block: ["canvas"]`（PDF のプレビューは canvas に描かれるため）。
- 「エラー」と「利用者の操作の結果」の分け方（決定 4）は次のようにした。
  - PDF 以外を選んだ: `alert` だけ。Sentry にもコンソールにも出さない。`try` / `catch` もなくした（`onFilesSelected` の中で想定外の例外が起きたら、React のエラー境界（`global-error.tsx`）が Sentry に送る）。
  - サーバーが失敗を返した（`!response.ok`）: クライアントからは送らない。500 はサーバー側の Sentry（`onRequestError`）が記録し、413（大きすぎる）は利用者の操作の結果のため。
  - 通信の失敗などの想定外の例外: `Sentry.captureException` で送る。
- ソースマップの設定（`withSentryConfig`）は変えていない。
- **Vercel のプロジェクトに `NEXT_PUBLIC_SENTRY_DSN` を Production と Preview の両方で設定する必要がある。** 設定しないまま本番に出すと、Sentry が無効になる（送らない側に倒れる）。値はこれまで設定ファイルに直書きしていた DSN（公開してよい値）。

### 2026-09-27: Vercel の設定と Preview での確認

- オーナーが Vercel のプロジェクトに `NEXT_PUBLIC_SENTRY_DSN` を Production と Preview の両方で設定した。
- オーナーが PR #55 の Preview で、DevTools で `/api/merge-pdf` への通信を止めて想定外の例外（`TypeError: Failed to fetch`）を起こし、Sentry の Issue の詳細と Replay にファイル名が出ず、画面の文字が伏せられていることを確かめた。

### 2026-09-28: 決定 3 を ADR 0022 で置き換えた

- 決定 3（トレースは 10%）は、ADR 0022 で「トレースを使わず、トレースのコードをビルドから除く」に置き換えた。トレースで見るものがなく、表示の速さは PostHog の Web Vitals（ADR 0021）と Lighthouse CI（ADR 0012）で見ているため。`/` の First Load JS は 241 kB → 205 kB。
- ほかの決定（PII・Session Replay・送るエラーの範囲など）は変えていない。

### 2026-10-01: ソースマップが送られていなかった（B-10）

- ADR 0015（PR #81）の確認で、Preview で起こしたエラーの Issue のスタックトレースが、圧縮後のファイル名（`_next/static/chunks/…js`）のままだった。Next.js 15 のビルドから送られた Issue も同じだった。決定 7 の「ソースマップのアップロードは続ける」が、実際には行われていなかった。
- 原因は `next.config` に直接書いた組織名（`vercel-development`）とプロジェクト名（`pdf-merge-app`）。実際の組織とプロジェクト（Vercel の Sentry の連携が入れる環境変数 `SENTRY_ORG` / `SENTRY_PROJECT`）と違い、アップロードが 403 で失敗していた。設定の値が環境変数より優先される。
- 環境変数から読むように直した。再現テストは `__tests__/lib/next-config.test.ts`（直す前は失敗した）。
- Next.js 16（Turbopack）では、これとは別に Sentry の更新が要る（Vercel のビルドで JS の置き場所が変わるため。ADR 0015 の追記）。

### 2026-10-01: 決定 2 を ADR 0024 で置き換えた

- 決定 2（Session Replay をエラー時だけ・全マスクで使う）は、ADR 0024 で「Replay をやめ、結合の操作を Sentry のパンくずとして自分で残す」に置き換えた。Replay は JS で約 37 kB（gzip）と読み込みのときの処理をすべての利用者に負担させる一方、文字と画像を隠しているので分かるのは配置とクリックの位置くらいだった。`/` の First Load JS は 206 kB → 165 kB。
- ほかの決定（PII を送らない・送るエラーの範囲・ソースマップなど）は変えていない。
