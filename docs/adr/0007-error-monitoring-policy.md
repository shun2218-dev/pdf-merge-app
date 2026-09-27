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

- [ ] 3 つの Sentry の設定で `sendDefaultPii` が `false`、DSN が環境変数から読まれている
- [ ] `beforeSend` がファイル名を置き換えることをユニットテストで確かめた
- [ ] Replay の設定が決定 2 のとおりで、Preview 環境でわざと例外を起こした Replay にファイル名と PDF の中身が映っていないことを目で確かめた
- [ ] `SentryFrontendError` と `useSentry` がコードベースにない
- [ ] PDF 以外を選んだときに Sentry へ何も送られない（ユニットテストで `captureException` が呼ばれないことを確認）
- [ ] ローカルと CI では Sentry に送信されない
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
