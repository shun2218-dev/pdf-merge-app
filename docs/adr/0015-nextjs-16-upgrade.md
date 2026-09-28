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
- [ ] 既存のユニット・Storybook・E2E のテストがすべて通る
- [ ] Preview 環境で、ファイルの追加・並び替え・プレビュー・ダウンロードを手で確かめた
- [ ] Sentry にソースマップ付きでエラーが届くことを Preview 環境で確かめた
- [ ] First Load JS と Lighthouse の値が上げる前より悪化していない（ADR 0012）
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
