# 0022. Sentry のトレースをやめ、Sentry はエラーの監視だけに使う

- 状態: 採用
- オーナーの確認: 2026-09-28（下の「背景」の根拠を確かめたうえで、提案どおりでよい）
- 日付: 2026-09-28
- 関連: M-3、ADR 0002 / 0004 / 0007 / 0011 / 0012 / 0021

## 背景

ADR 0007 決定 3 は、Sentry のトレースを全件（`tracesSampleRate: 1`。雛形の既定）から 10% に減らした。減らすことは決めたが、**トレースで何を見るのかは、どの ADR でも決めていない。**

ADR 0021 の追記で、Sentry の SDK がトレースのために独自の Web Vitals のコードを持ち、`web-vitals` と役割が重なることが分かった。ADR 0004 の整理のときに、トレースのコードを除いてビルドして大きさを測った（`withSentryConfig` の `bundleSizeOptimizations.excludeTracing`）。

| | `/` の First Load JS | 共通のチャンク |
|---|---|---|
| いま | 241 kB | 211 kB |
| トレースのコードを除く | 205 kB（−36 kB、−15%） | 175 kB |

Lighthouse CI の JS の転送量の予算（250,000 バイト。ADR 0012）に対して、いまは 247,934 バイトで余裕がほとんどない。

Sentry のトレースでできることを 1 つずつ挙げ、このアプリで要るか、ほかの道具で足りているかを確かめた。

| Sentry のトレースでできること | このアプリでの扱い |
|---|---|
| 実際の利用者の表示の速さ（LCP / INP / CLS） | 重なっている。PostHog の `web_vital` で測っている（ADR 0021） |
| 表示が遅いときに、何に時間がかかったかの内訳 | 重なっている。ページは 1 つだけで中身も決まっているので、Lighthouse CI とバンドルアナライザ（ADR 0012）の計測で足りる |
| 結合にかかった時間 | 重なっている。PostHog のイベントの `duration_bucket` で数えている（ADR 0011） |
| `/api/merge-pdf` の応答時間 | 重なっている。Vercel のログに処理時間が出る。API 自体も ADR 0002 でなくなる |
| エラーが起きる直前の操作 | トレースは要らない。Session Replay（エラー時だけ。ADR 0007 決定 2）と、操作の記録（breadcrumb）で見られる。どちらもトレースとは別の機能 |
| ブラウザからサーバーまでをまたいだ追跡 | 要らない。API が 1 つだけで、それもなくなる |

このアプリで、Sentry のトレースだけが担う役割はない。

## 検討した選択肢

| 案 | 良い点 | 悪い点 |
|---|---|---|
| A. いまのまま（10%） | 変更がない | JS が 36 kB 多いまま。役割がほかと重なっている |
| B. `tracesSampleRate` を 0 にするだけ | 送る量が 0 になる | トレースのコードはバンドルに残るので、JS は減らない |
| **C. トレースのコードをビルドから除き、トレースの設定を消す** | JS が 36 kB 減る。Sentry の役割がエラーの監視に絞られる | あとでトレースが要るようになったら、設定を戻して ADR を書き直す |

## 決定

1. **Sentry のトレースをやめる。** Sentry はエラーの監視（エラーの送信・Session Replay・breadcrumb）だけに使う。ADR 0007 決定 3（トレースは 10%）をこの ADR で置き換える。
2. **トレースのコードをビルドから除く。** `withSentryConfig` に `bundleSizeOptimizations: { excludeTracing: true }` を足す。この設定はブラウザだけでなく、サーバーと Edge のビルドにも効く（`@sentry/nextjs` の webpack のプラグインが 3 つのビルドのすべてに入る）。
3. **トレースの設定を消す。** `lib/sentry/options.ts` の `tracesSampleRate` と、`instrumentation-client.ts` の `onRouterTransitionStart`（画面遷移のトレースを始めるためのもの）を消す。
4. **表示の速さは PostHog の Web Vitals（ADR 0021）と Lighthouse CI（ADR 0012）で見る。** Sentry の Performance の画面は使わない。

## 結果

- 良い点: `/` の First Load JS が約 36 kB 減り、JS の予算に余裕ができる。表示の速さを見る場所が PostHog に 1 つになる。Sentry に送る量が減る。
- 悪い点: ブラウザからサーバーまでをまたいだ遅さの調査ができなくなる（いまの構成では必要がない）。
- あとで困りうること: サーバーのエラーの送信は、Next.js の SDK の中でトレースの仕組み（OpenTelemetry）とつながっている。トレースのコードを除いても、サーバーのエラーが届くことを確かめる（DoD）。ADR 0007 決定 6 で、ADR 0002 のあとにサーバーの Sentry を残すかを見直すときにも、この ADR を前提にする。

## オーナーに確認したいこと

なし（2026-09-28 に上の根拠で確認済み）。

## 完了条件（DoD）

- [x] `next.config.mjs` に `excludeTracing: true` があり、`tracesSampleRate` と `onRouterTransitionStart` がコードにない（2026-09-28）
- [x] `/` の First Load JS が 241 kB から 30 kB 以上減っている（数値を PR に貼る）（2026-09-28。205 kB）
- [x] ブラウザで起きた想定外のエラーが Sentry に届く（ローカルで偽の受け口に送って確かめる）（2026-09-28）
- [x] サーバーで起きた想定外のエラーが Sentry に届く（同上）（2026-09-28）
- [x] 送られるエラーのイベントにトレースのデータ（transaction）がなく、ファイル名が `[file]` に置き換わっている（2026-09-28）
- [x] ADR 0007 に、決定 3 をこの ADR で置き換えたことを追記した（2026-09-28）
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-28: 実装と確認

- 決定 2 / 3 のとおりに `next.config.mjs`・`lib/sentry/options.ts`・`instrumentation-client.ts` を変えた。`__tests__/lib/sentry.test.ts` は、共通の設定に `tracesSampleRate` と `tracesSampler` がないことを確かめる形にした（変更の前は失敗した）。
- **大きさ**: `/` の First Load JS は 241 kB → 205 kB、共通のチャンクは 211 kB → 175 kB。`docs/performance.md` のベースライン（238 kB）からは 14% 減。First Load JS の予算（ベースラインから 20% 減）は、ADR 0004 のあとに決める予定のまま。
- **エラーが届くことの確認**: ローカルで、受け取った中身をファイルに書くだけの偽の Sentry の受け口を立て、DSN をそこに向けてビルドし、`next start` で確かめた。
  - サーバー: 例外を投げるだけの一時的なルート（確かめたあとに消した。コミットしていない）を開き、`onRequestError` から `event` が届いた。メッセージの `secret.pdf` は `[file]` になっていた。
  - ブラウザ: ページで例外を投げ、`event` が届いた（`client check [file]`）。エラー時の Session Replay（`replay_event` / `replay_recording`）も届いた。
  - 届いたものの中に、`transaction` と `span` は 1 つもなかった。

### 2026-09-29: Turbopack では `compiler.define` で除く（ADR 0015）

- Sentry の `bundleSizeOptimizations.excludeTracing` は webpack のビルドにしか効かない。Next.js 16 で Turbopack にしたところ、トレースのコードが残った。Next.js の `compiler.define` で `__SENTRY_TRACING__: false`（文字列ではなく boolean）を渡すと除けた。決定 2 の「トレースのコードをビルドから除く」は変えていない。
