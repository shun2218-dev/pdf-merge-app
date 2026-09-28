# 0004. 依存とコードベースの整理（未使用の削除・版の固定・型チェックの有効化）

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: C-1 / C-2 / C-3 / C-4 / C-8 / C-11、ADR 0006 / 0008 / 0015

## 背景

v0 などの雛形から始めた名残で、使っていないものが多い。

- `components/ui/` に 59 ファイルあるが、アプリが使うのは button / card / checkbox / dialog / label だけ（C-2）。
- それに引きずられて、recharts・date-fns・embla-carousel-react・cmdk・vaul・react-hook-form・@hookform/resolvers・zod・input-otp・react-day-picker・react-resizable-panels・sonner などの依存も入っている。
- 依存の多くが `"latest"`（C-3）。`happy-dom`・`@vitest/runner`・`prettier`・`path`・`@edge-runtime/vm` が本番の `dependencies` にある。biome を使っているのに prettier もある。
- `app/globals.css` と `styles/globals.css`、`hooks/` と `components/ui/` の `use-mobile` / `use-toast` が重複している（C-4）。
- **`typescript.ignoreBuildErrors: true`（C-1）。** 型エラーがあっても本番にデプロイされる。
- ルートの `utils.ts`（テストの設定用の `dirname`）が、アプリのコードの `lib/utils.ts` と紛らわしい。

未使用のコードは、依存の更新や脆弱性の対応の手間を増やし、Next.js 16 への更新（ADR 0015）の障害にもなる。先に減らす。

## 決定

1. **未使用の shadcn/ui コンポーネントを削除する。** 残すのは使っているものだけ。今後の ADR（0009 の通知など）で要るものは、その時点で `shadcn add` で足す（雛形を先回りして置かない）。
2. **未使用の依存を削除する。** 削除の候補は `knip` で機械的に洗い出し、PR に結果を貼る。`knip` を devDependencies に入れ、CI でも未使用の依存・ファイル・export を検査する（ADR 0006）。
3. **版を固定する。** `"latest"` をやめ、その時点で入っている版を `^x.y.z` で書く。Radix は個別のパッケージではなく、shadcn の現行の推奨どおり `radix-ui` の 1 パッケージにまとめられるならまとめる。
   更新は Renovate（週 1 回・パッチとマイナーは自動でまとめる・メジャーは個別の PR）に任せる。
4. **テスト用の依存を devDependencies に移し、prettier と path と @edge-runtime/vm を消す。**
5. **CSS の正本を 1 つにする。** `app/globals.css` に一本化し（Next.js と shadcn の既定の置き場）、`styles/globals.css` を消す。`components.json`・`app/layout.tsx`・`.storybook/preview.ts` の参照を揃える。トークンの中身の見直しは ADR 0008。
6. **重複したフックを `hooks/` に一本化する。** 使っていないものは消す。
7. **`ignoreBuildErrors` を外し、`pnpm typecheck`（`tsc --noEmit`）を足す。** 外した時点で出る型エラーはこの ADR の中で直す。
8. **ルートの `utils.ts` を `tests/utils/dirname.ts` に移す**（テストの設定からしか使わないため）。
9. **使っていないファイルを消す。** `public/placeholder-*`、`components/theme-provider.tsx`（ADR 0008 で使う場合は作り直す）。`.vscode/mcp.json` は個人の設定なので `.gitignore` に入れる。
10. **README を実装に合わせる。** 「Edge Runtime で結合」の記述を直す（ADR 0002 の実装で最終的に書き直す）。

## 結果

- 良い点: 依存の数・`pnpm install` の時間・脆弱性の通知が減る。型エラーが本番に出なくなる。
- 悪い点: 将来 shadcn の部品が要るたびに追加の手間がかかる（1 コマンドなので許容する）。

## オーナーに確認したいこと

1. Renovate（GitHub App）の導入でよいか。Dependabot のほうがよければそれに合わせる。

**オーナーの回答（2026-09-27）**: すべて提案どおりでよい。依存の更新は Renovate でよい。

## 完了条件（DoD）

- [x] `pnpm knip` が未使用の依存・ファイルを 0 件と報告する（2026-09-28）
- [x] `package.json` に `"latest"` が 1 つもない（2026-09-28）
- [x] `components/ui/` のファイルがすべてどこかから import されている（2026-09-28）
- [x] `next.config.*` に `ignoreBuildErrors` がなく、`pnpm typecheck` が通る（2026-09-28）
- [x] CSS の正本が `app/globals.css` の 1 つだけ（2026-09-28）
- [x] 本番ビルドの First Load JS が整理の前より増えていない（数値を PR に貼る）（2026-09-28。`/` は 241 kB のまま）
- [ ] 既存のユニット・Storybook・E2E のテストがすべて通る
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-28: 削除を伴わない部分を先に実装した（その 1）

ファイルの削除は、オーナーの判断で後の PR に分けた。この PR では削除を伴わないものだけを入れた。

- **knip（決定 2）**: `knip@6.37.0`（2026-09-18 公開）を devDependencies に入れ、`pnpm knip` を足した。`knip.json` は 2 つだけ設定した。
  - `ignoreFiles` に `public/lib/pdf.worker.min.js`（`components/pdf-preview.tsx` が URL の文字列で読むので、import をたどっても見つからない。ADR 0003 で置き換える）。
  - `ignoreExportsUsedInFile: true`（shadcn の部品は、同じファイルの中で使う `buttonVariants` なども export している）。
  - knip が依存する `smol-toml` の最新（1.9.0）は公開から 6 日だったので、`pnpm install --config.minimum-release-age=10080` で 1.8.0 にした。`pnpm update --depth Infinity` を使うと、関係のない依存まで解決し直されるので使わない。
  - CI に knip を足すのは、削除が済んで 0 件になってから（いま足すと CI が赤になる）。
- **版の固定（決定 3）**: `"latest"` の 45 個を、いま入っている版の `^x.y.z` にした。解決される版は 1 つも変わっていない（lockfile のパッケージの一覧を前後で比べた）。Radix の `radix-ui` への一本化は、残る部品（button / card / checkbox / dialog / label）が決まってから、削除の PR で行う。
- **Renovate（決定 3）**: `renovate.json` を置いた。週 1 回（月曜の 9 時まで、日本時間）、パッチとマイナーは 1 つの PR にまとめ、メジャーは個別の PR。PR の向き先は `develop`、公開から 7 日たった版だけ（`minimumReleaseAge`）。pnpm は 10 系に固定した（`constraints`）。Renovate が別の版の pnpm で lockfile を作ると、`node_modules` の置き場所の食い違いなどが起きるため（CLAUDE.md の「開発の注意」）。GitHub App の導入はオーナーが行う。
- **テスト用の依存（決定 4）**: `happy-dom` と `@vitest/runner` を devDependencies に移した。どちらもコードからは使っていないので、削除の PR で消す候補。
- **CSS（決定 5）**: `styles/globals.css` にだけあった規則（開いたダイアログの閉じるボタンを隠す）を `app/globals.css` に移し、`app/layout.tsx` と `.storybook/preview.ts` を `app/globals.css` に向けた。2 つのファイルはいまは中身が同じで、`styles/globals.css` はどこからも読まれていない（削除の PR で消す）。
- **型チェック（決定 7）**: `next.config.mjs` から `typescript.ignoreBuildErrors` を外した。`next build` の型の検査で、エラーは出なかった。
- **`utils.ts`（決定 8）**: `tests/utils/dirname.ts` を作り、`vitest.config.ts`・`playwright.config.ts`・`e2e/merge.spec.ts` をそちらに向けた。ファイルの場所が変わると `__dirname` が指す場所も変わるので、中身はリポジトリのルートを返す `rootDir` にした。ルートの `utils.ts` は削除の PR で消す。
- **README（決定 10）**: 「Edge Runtime で結合」の記述を、実際の Vercel Functions（Node.js）と 4.5MB の上限に直した。
- **First Load JS（DoD）**: 整理の前の `/` は 241 kB（共通 211 kB）。この PR のあとも同じ。

**残り（削除の PR）**: knip が未使用とした 56 ファイル（`components/ui/` の 51 ファイル、`hooks/` の 2 つ、`components/theme-provider.tsx`、`styles/globals.css`、`utils.ts`）と `public/placeholder-*` の削除、未使用の依存 39 個と `prettier`・`path`・`@edge-runtime/vm`・`happy-dom`・`@vitest/runner` の削除、`CardAction` と `lib/analytics/index.ts` の型の再 export（どちらも未使用）の削除、`postcss.config.mjs` の型の注釈（`postcss-load-config` を依存に持たないまま参照している）、`.vscode/mcp.json` の追跡をやめて `.gitignore` に入れる、Radix の一本化、CI への knip の追加。ADR 0021 の追記にある、Sentry のブラウザのトレースと `web-vitals` の重なりの見直しもこのときに行う。

### 2026-09-28: 削除を実装した（その 2）

オーナーの許可を得て、Claude Code が `git rm` と `pnpm remove` で消した。

- **ファイル（決定 1 / 5 / 6 / 8 / 9）**: knip が未使用とした 56 ファイル（`components/ui/` の 51、`hooks/` の 2、`components/theme-provider.tsx`、`styles/globals.css`、`utils.ts`）と `public/placeholder-*` の 5 つを消した。`hooks/` と `styles/` はディレクトリごとなくなった。`components/ui/` に残ったのは button / card / checkbox / dialog / label（と button と card の Story）。
- **依存（決定 2 / 4）**: knip が未使用とした 39 個と、`prettier`・`@edge-runtime/vm`・`happy-dom`・`@vitest/runner` を消した（`path` は knip の 39 個に入っている）。lockfile のパッケージは 1245 → 1149。新しく入った版・版の変わったものは 0（前後の lockfile のパッケージの一覧を比べた）。
- **未使用の export**: `components/ui/card.tsx` の `CardAction` と、`lib/analytics/index.ts` の型の再 export（`AnalyticsEvent` / `EventName` / `EventProperties`。使う側は `./events` から直接読んでいる）を消した。
- **`postcss.config.mjs`**: 依存に持っていない `postcss-load-config` を指す JSDoc の型の注釈を消した。
- **`.vscode/mcp.json`（決定 9）**: 追跡をやめ、`.gitignore` に足した。ファイルは各自の手元に残る。
- **CI（決定 2 / ADR 0006）**: `lint` ジョブに `pnpm knip` のステップを足した。
- **First Load JS（DoD）**: `/` は 241 kB、共通は 211 kB で、整理の前と同じ。
- **Radix の一本化（決定 3）は見送った。** `radix-ui@1.6.7`（2026-07-24 公開）にまとめて試したところ、`/` が 241 kB → 243 kB に増えた。`radix-ui` は `sideEffects: false` で、使う部品だけがバンドルに入る。増えたのは、`radix-ui@1.6.7` が中の部品を新しい版にする（dialog 1.1.15 → 1.1.23、checkbox 1.3.3 → 1.3.11 など）ため。この ADR の DoD（First Load JS を増やさない）に反し、Lighthouse CI の JS の転送量の予算（250,000 バイト。いまは約 247,934 バイト。ADR 0012 / 0021）も超えるおそれがあるので、この PR では個別のパッケージのままにした。Renovate が Radix を上げる PR で同じだけ増えるはずなので、そのときに一本化も合わせて判断する。
  - オーナーは Radix にこだわりがない（2026-09-28）。JS を減らすなら、Radix をまとめるより、Radix への依存そのものを減らす（ブラウザ標準の `<dialog>` や `<input type="checkbox">` にする）ほうが早い可能性がある。部品の作り直しになるので、デザインのリニューアル（Phase 4。ADR 0008 / 0009）で判断する。
- **Sentry のブラウザのトレース（ADR 0021 の追記）**: `withSentryConfig` に `bundleSizeOptimizations: { excludeTracing: true }` を足して試しにビルドすると、`/` が 241 kB → 205 kB、共通が 211 kB → 175 kB になった（−36 kB）。トレースをやめるのは ADR 0007 の決定 3 を変えることになるので、この PR には入れず、別の ADR で決める。
