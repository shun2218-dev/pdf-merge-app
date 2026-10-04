# 0015. Next.js 16 に上げる

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: C-9、ADR 0003 / 0004 / 0012 / 0013 / 0016 / 0017

## 背景

- いまは Next.js 15.1.9（脆弱性の対応で 15 系の中で上げたもの）。2026-09-27 時点の最新は 16.3 系。
- 15 系のままだと、今後の脆弱性の修正を受け取れる期間が短くなる。
- これからの ADR は 16 系の前提で書きたいものが多い。
  - ADR 0013（i18n）のロケールの判定は、16 で `middleware.ts` から名前が変わった `proxy.ts` に置く
  - ADR 0012（バンドル）は Turbopack の既定化とアナライザ
  - ADR 0017（ヘッダ）・0016（メタデータ）も 16 の書き方で書く
- `next.config.mjs` に webpack の独自設定（`canvas` の external）がある。16 はビルドも Turbopack が既定になる。

## 決定

1. **ADR 0004（整理）の直後、ADR 0002 / 0003 / 0013 より前に、Next.js 16 の最新のパッチに上げる。** 依存が減ってから上げたほうが壊れる箇所が少なく、後続の ADR を 16 の書き方で 1 回で書ける。
2. **公式の codemod（`@next/codemod upgrade`）を使い、差分を読んでから取り込む。** React も 19 系の最新にする。
3. **ビルドは Turbopack（16 の既定）にする。** webpack の独自設定は次のように扱う。
   - `canvas` の external は、pdfjs を SSR で読まない限り要らない（プレビューは `ssr: false`）。外してビルドとテストが通るなら消す。
   - 要る場合は `turbopack.resolveAlias` で `canvas` を空にする。
4. **Sentry・Storybook（`@storybook/nextjs-vite`）・Vercel Analytics が 16 と Turbopack に対応した版であることを確かめ、必要なら一緒に上げる。**
5. **`next.config.mjs` を `next.config.ts` にする**（型の補完のため）。
6. 振る舞いを変えない。見た目・機能の変更は、この ADR の PR に混ぜない。

## 結果

- 良い点: 以後の ADR を最新の書き方で実装できる。ビルドが速くなる。
- 悪い点: 16 の破壊的な変更（非同期の `params` / `cookies` などの API、キャッシュの既定の変化）に合わせる修正が要る。いまはページが 1 枚でサーバーの API も少ないので、影響は小さい見込み。

## オーナーに確認したいこと

なし。

## 完了条件（DoD）

- [x] `next` が 16 系の最新のパッチで、`pnpm build` が Turbopack で通る（2026-09-29。公開から 1 週間たった最新の 16.3.5。16.3.6 は公開から 6 日だった）
- [x] `next.config.ts` に webpack の独自設定がない（残す場合は理由を「追記」に書く）（2026-09-29）
- [x] 既存のユニット・Storybook・E2E のテストがすべて通る（2026-10-03。CI と手元）
- [x] Preview 環境で、ファイルの追加・並び替え・プレビュー・ダウンロードを手で確かめた（2026-10-04。オーナーが確かめた）
- [x] Sentry にソースマップ付きでエラーが届くことを Preview 環境で確かめた（2026-10-04。オーナーが確かめた）
- [ ] First Load JS と Lighthouse の値が上げる前より悪化していない（ADR 0012）（満たしていない。JS は +21%、ラボの LCP は約 +150 ms。TBT は同じくらい。関門（ADR 0023 / 0025）は 5 回とも通ったので、オーナーの判断で関門で判定した。追記を参照）
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-29: 実装

- **版**: `next` 16.3.5・`react` / `react-dom` 19.3.0・`@types/react` / `@types/react-dom` 19.3.0。どれも公開から 1 週間以上たった版（16.3.6 は公開から 6 日だったので避けた）。`pnpm install --config.minimum-release-age=10080` で入れた。Sentry（10.22.0）・Storybook（`@storybook/nextjs-vite` 10.0.2）・Vercel Analytics / Speed Insights は、peer の範囲が 16 を含むので上げていない（決定 4）。Sentry と Storybook の更新は Renovate に任せる。
- **codemod（決定 2）**: `@next/codemod upgrade` は依存の入れ直しにグローバルの pnpm（12 系）を使うので、使わなかった（CLAUDE.md の「開発の注意」）。版は pnpm 10 で上げ、15.1.9 から 16.3.5 の間の codemod（`next-experimental-turbo-to-turbopack`・`middleware-to-proxy`・`remove-unstable-prefix`・`remove-experimental-ppr`）を 1 つずつ走らせた。書き換えた箇所は 0。非同期の `params` / `cookies` なども使っていなかった。`next-lint-to-eslint-cli` と Cache Components 向けの 2 つは、使っていない機能なので走らせていない。
- **Turbopack（決定 3）**: `canvas` の external を外しても、Turbopack のビルドとテストが通った（webpack では `canvas` を解決できずに失敗する）。
- **webpack 専用の設定の置き換え**: Sentry の `bundleSizeOptimizations.excludeTracing`（ADR 0022）と `disableLogger` は webpack のビルドにしか効かず、Turbopack ではトレースのコードが残っていた。`compiler.define` で `__SENTRY_TRACING__` と `__SENTRY_DEBUG__` を `false` に置き換えた。値を文字列の `"false"` にすると真と見なされてコードが残るので、boolean にする。`automaticVercelMonitors`（Vercel の Cron の監視。webpack 専用）は、Cron がないので外した。`__tests__/lib/next-config.test.ts` で確かめる。
- **バンドルアナライザ**: `@next/bundle-analyzer` は webpack 専用なので外し、`pnpm analyze` を Next.js 16 の `next experimental-analyze` にした（ADR 0012 決定 1 の「Turbopack のアナライザが使えるならそちら」）。
- **`next.config.ts`（決定 5）**: `next.config.mjs` から移した。包む前の設定を `nextConfig` として export し、テストから読む（`withSentryConfig` は自分で webpack の関数を足すため）。
- **型**: Next.js 16 は `next-env.d.ts` に `.next/types/` の import を書くので、ビルドしていない CI の `lint` ジョブで型チェックが落ちる。`next-env.d.ts` を git の追跡から外して `.gitignore` に入れ、`pnpm typecheck` を `next typegen && tsc --noEmit` にした。`tsconfig.json` は Next.js が書き換えた `jsx: "react-jsx"` と `.next/dev/types/**/*.ts` を取り込み、もとからあった誤った書き方の `".next\\dev/types/**/*.ts"` を消した。
- **Sentry**: 画面遷移のトレースは使わないので（ADR 0022）、`onRouterTransitionStart` がないという警告を `suppressOnRouterTransitionStartWarning` で止めた。ローカルで偽の受け口に送らせ、サーバーとブラウザのエラーが届き（ファイル名は `[file]`）、エラー時の Session Replay も届き、トレースのデータがないことを確かめた（ADR 0022 と同じ方法）。
- **大きさと Lighthouse（DoD の 6 つ目）**: `/` が読み込む JS（gzip、polyfills を含む）は 242.1 kB → 296.9 kB。Next.js 16 と React 19.3 の本体で約 +28 kB、Turbopack で約 +29 kB（Sentry のデバッグ用のログを除いて −2 kB）。ローカルの Lighthouse の比較は ADR 0023 の背景の表。「上げる前より悪化していない」は満たさないが、ADR 0023 で予算を利用者の体験の目標から決め直したので、この PR の CI の関門（LCP・TBT・CLS・JS の転送量）で判定する。
- **ビルドの警告**: `app/opengraph-image.tsx` と `app/twitter-image.tsx` の Edge Runtime が 16 で非推奨になった（S-6 として `docs/assessment.md` に足した。ADR 0016 で扱う）。`metadataBase` の警告は前からある（S-1）。

### 2026-09-30: Preview でのソースマップの確認と B-10

- オーナーが PR #81 の Preview で `/api/merge-pdf` への通信を止めてエラーを起こしたところ、Sentry に届いた（環境は preview）が、スタックトレースが圧縮後のファイル名のままだった。
- Turbopack のせいではなかった。Sentry 10.22 は `TURBOPACK` の環境変数（Next.js 16 のビルドでは `auto`）で Turbopack と見分け、ブラウザのソースマップを作り、ビルドの最後（`runAfterProductionCompile`）で送る。送ったあとにはソースマップを消す（`deleteSourcemapsAfterUpload` の既定）。
- 原因は、`next.config` に直接書いた Sentry の組織名とプロジェクト名が実際と違い、アップロードが 403 で失敗していたこと（B-10。ADR 0007 の追記）。環境変数から読むようにした。
- これで手元の `pnpm build` も、`.env` の `SENTRY_AUTH_TOKEN` で本物の Sentry にソースマップを送るようになる。送りたくないときは `SENTRY_AUTH_TOKEN=` を付けてビルドする（CLAUDE.md の「開発の注意」）。
- B-10 を直したあとの Preview でも、まだ圧縮後のファイル名のままだった（2026-10-01）。Vercel でビルドすると、Next.js 16.3 は Turbopack の JS を `.next/static/immutable/chunks` に置く（`supportsImmutableAssets`。手元のビルドでは `.next/static/chunks` のまま）。Sentry 10.22 は `.next/static/chunks` しか送らないので、ソースマップが 1 つも送られていなかった。`.next/static/immutable/chunks` にも対応した `@sentry/nextjs` 10.75.3（2026-09-23 公開）に上げた（決定 4）。`withSentryConfig` の import 元も、10.75 の推奨の `@sentry/nextjs/config` にした。
- Sentry 10.75 で、`/` が読み込む JS は 296.9 kB → 279.8 kB（gzip）になった。

### 2026-10-01: CI の TBT の関門で落ち、マージを保留した

- #81 の CI で TBT が 204 ms になり、ADR 0023 の関門（200 ms）を超えた。同じコードでも CI のマシンの速さ（Lighthouse の benchmarkIndex）で TBT が大きく変わる（`develop` で約 4,300 のとき 58〜65 ms、約 2,440 のとき 157〜161 ms）。Lighthouse の既定の「4 倍遅い CPU」は、測るマシンを基準にした倍率なので、基準の端末が実行のたびに変わっていた。
- Lighthouse の文書では、既定の 4 倍は「高性能なデスクトップ（benchmarkIndex 1,500〜2,000）から中位のスマートフォンへ」の倍率。手元で、倍率をマシンの速さに合わせて 8.3 倍（benchmarkIndex 約 440 の端末に相当）にして、4 つのビルドを 8 回ずつ測った。手元のマシンの状態で結果が 2 つの群に分かれ、差を正確には言えないが、同じ群の中で比べると次の傾向だった。
  - `develop` → Next 16 + webpack で TBT が増える（+17〜87 ms）
  - Next 16 の webpack → Turbopack は同じか少し多い（+5〜45 ms）
  - Sentry の Session Replay を外すと、TBT が 28〜38 ms、`/` の JS（gzip）が 39 kB 減る
  - LCP（中央値）は `develop` 2,591 ms、16 + webpack 2,625 ms、16 + Turbopack 2,777 ms、Replay なし 2,623 ms。この端末の条件では、いまの `develop` でも LCP の関門（2,500 ms）を超える
- オーナーの判断（2026-10-01）: 基準の端末は、実際の利用者の値（PostHog の p75。2026-10-05 以降にたまる）で決め、CI の CPU の倍率の補正と合わせて新しい ADR にする。それまでこの PR はマージしない。B-10 の修正は #82 として切り出して先に出す。

### 2026-10-01: `develop`（ADR 0005 / 0024）を取り込んだ

- ADR 0005（画面の分割）と ADR 0024（Session Replay をやめる）の入った `develop` を、このブランチにマージした。衝突は、両方に書いた B-10 の記録と `next.config.mjs`（このブランチでは `.ts` に移した）だけだった。
- `/` が読み込む JS（gzip、polyfills を含む。測り方は ADR 0023 の背景と同じ）は、`develop`（Next.js 15）が 203.1 kB、このブランチ（Next.js 16 + Turbopack）が 241.3 kB（+38 kB）。ユニット・Storybook（207 件）と E2E（Chromium 14 件）は通った。判定は、基準の端末を決める ADR の関門で行う。

### 2026-10-03: ADR 0025 の関門で判定し、通った

ADR 0025（基準の端末に補正）・0026（Sentry を load のあとに読み込む）・0027（注意事項のモーダルをやめる）の入った `develop` を取り込み、ADR 0025 の条件（温める 2 回を捨て、倍率を benchmarkIndex 440 に補正し、Sentry 有効で 3 回の中央値）で判定した。

**この PR の CI の `lighthouse` ジョブを 5 回**（同じコード。4 回は走らせ直し）

| 回 | B_ci | 倍率 | TBT | LCP | JS の転送量 |
|---|---|---|---|---|---|
| 1 | 2,471 | 5.62 | 154 ms | 1,667 ms | 193,191 B |
| 2 | 4,248 | 9.65 | 152 ms | 1,664 ms | 193,191 B |
| 3 | 2,477 | 5.63 | 155 ms | 1,669 ms | 193,191 B |
| 4 | 4,473 | 10.17 | 185 ms | 1,663 ms | 193,191 B |
| 5 | 2,433 | 5.53 | 148 ms | 1,668 ms | 193,191 B |

5 回とも、関門（LCP 2,500 ms・TBT 200 ms・CLS 0.1・JS 350,000 B・Performance 0.90）の内だった。オーナーの判断（2026-10-01。関門で判定する）と、2026-10-03 の指示（関門を通ったらマージする）により、マージする。

**`develop` との差**（同じマシンに並べて交互に 7 回ずつ。3 台。一時的なワークフロー。マージせずに消した）

| マシン | TBT（`develop` → 16） | LCP（`develop` → 16） |
|---|---|---|
| AMD EPYC 7763 | 149 → 148 ms | 1,516 → 1,667 ms |
| Intel Xeon Platinum 8370C | 149 → 158 ms | 1,514 → 1,666 ms |
| Intel Xeon Platinum 8573C | 171 → 167 ms | 1,514 → 1,665 ms |

- TBT はほぼ変わらない。LCP は 3 台とも約 150 ms 増えた（ラボの値。2 つの山の低いほうどうしの比較）。
- JS の転送量は 160,234 B → 193,198 B（+21%）。手元で `/` が読み込む JS（gzip、polyfills を含む）を比べると、`develop`（15・webpack）168.8 kB、16・webpack 194.3 kB、16・Turbopack 199.0 kB で、増えた分の大半は Next.js 16 そのもの（Turbopack の分は 5 kB ほど）。webpack に戻しても大きくは減らない。
- 増えた LCP と JS を減らすのは、ADR 0002（結合をブラウザの中に移す）や ADR 0009（画面の作り直し）で、JS の読み込み方を見直すときに扱う。

