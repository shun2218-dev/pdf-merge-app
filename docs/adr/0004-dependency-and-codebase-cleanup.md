# 0004. 依存とコードベースの整理（未使用の削除・版の固定・型チェックの有効化）

- 状態: 提案
- オーナーの確認: 未
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

## 完了条件（DoD）

- [ ] `pnpm knip` が未使用の依存・ファイルを 0 件と報告する
- [ ] `package.json` に `"latest"` が 1 つもない
- [ ] `components/ui/` のファイルがすべてどこかから import されている
- [ ] `next.config.*` に `ignoreBuildErrors` がなく、`pnpm typecheck` が通る
- [ ] CSS の正本が `app/globals.css` の 1 つだけ
- [ ] 本番ビルドの First Load JS が整理の前より増えていない（数値を PR に貼る）
- [ ] 既存のユニット・Storybook・E2E のテストがすべて通る
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
