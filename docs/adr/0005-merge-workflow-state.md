# 0005. 結合の状態管理を 1 つのフックにまとめ、画面を分割する

- 状態: 提案
- オーナーの確認: 未
- 日付: 2026-09-27
- 関連: B-1 / B-5 / B-6 / C-5、ADR 0002 / 0009 / 0010 / 0011

## 背景

`app/page.tsx` が、ファイルの一覧・並び替え・結合の通信・ダウンロード・画面の描画をすべて抱えている（C-5）。その結果、次のバグが本番に出ている。

- **B-1: プレビュー前に「ダウンロード」を押しても何も起きない。** `handleDownload` は `await handlePreview()` のあと `setTimeout` で `mergedPdfUrl` を読むが、読んでいるのは押した時点の state（`null`）である。
- **B-5:** `URL.createObjectURL` の URL を解放しない。
- **B-6:** 一覧の `key` が `ファイル名-index` で、並び替えるたびに変わる。

どれも「状態が散らばっていて、どの操作で何が変わるかが一箇所で読めない」ことから来ている。
ADR 0002（ブラウザ内の結合）・0009（ファイルごとのエラー・進捗）・0010（並び替え）・0011（イベントの送信）はすべてこの状態に手を入れるので、先に形を決める。

## 決定

1. **状態は `useReducer` の 1 つのフック `hooks/use-merge-workflow.ts` にまとめる。**
   - 状態: `items: MergeItem[]`（`{ id, file, status: "ready" | "invalid" | "encrypted", pageCount?, error? }`）、`phase: "idle" | "merging" | "done" | "error"`、`progress`、`result?: { url, size, pageCount }`。
   - 操作: `add` / `remove` / `move(from, to)` / `clear` / `merge` / `download`。
   - reducer は純粋な関数として別ファイル（`lib/merge-workflow/reducer.ts`）に置き、操作ごとの状態遷移をユニットテストする。
2. **各ファイルに `crypto.randomUUID()` で `id` を振り、`key` にも並び替えにも `id` を使う（B-6）。**
3. **一覧を変えたら（`add` / `remove` / `move` / `clear`）結果を捨て、その URL を `URL.revokeObjectURL` する。** アンマウント時にも解放する（B-5）。
4. **「ダウンロード」は、結果がなければ結合を待ってから、得た結果でダウンロードする。** `merge()` が結果を `return` し、`download()` はそれを使う。state を読み直さない（B-1）。
   B-1 はバグ修正なので、この ADR の採用を待たずに `hotfix/` で先に直す（ADR 0001 の例外）。そのときは失敗する再現テストを先に書く。
5. **画面は `app/page.tsx`（サーバーコンポーネント。見出しとメタデータ）と `components/merge/`（クライアントコンポーネント）に分ける。**
   `merge-workspace.tsx`（フックを持つ唯一のコンポーネント）の下に、`drop-zone` / `file-list` / `merge-actions` / `merge-preview` を presentational なコンポーネントとして置く。presentational なものは props だけで描き、Storybook に全状態のストーリーを置く。
6. **アイコンは `lucide-react` を使い、SVG の直書きをやめる。** 装飾のアイコンは `aria-hidden`、意味を持つものはボタンの `aria-label` で名前を付ける（ADR 0014）。
7. **`alert()` を使わない。** エラーは状態（`items[].error` と `phase: "error"`）として持ち、表示は ADR 0009 で決める。

## 結果

- 良い点: 状態遷移が reducer 1 つで読め、ユニットテストで固められる。後続の ADR が同じ場所に手を入れればよくなる。
- 悪い点: ファイル数が増える。いまの `__tests__/app/page.test.tsx`（412 行）は、reducer のテストとコンポーネントのテストに分けて書き直す。

## オーナーに確認したいこと

なし。

## 完了条件（DoD）

- [ ] （先行の hotfix）プレビューせずに「ダウンロード」を 1 回押すと `merged.pdf` がダウンロードされる E2E があり、通る
- [ ] reducer のすべての操作に、状態遷移のユニットテストがある
- [ ] 一覧を変えたとき・アンマウント時に `URL.revokeObjectURL` が呼ばれることをテストした
- [ ] 同じ名前のファイルを 2 つ入れて並び替えても、React の key の警告が出ない
- [ ] `app/page.tsx` に `"use client"` がない
- [ ] コンポーネントの中に `<svg>` の直書きと `alert(` がない（`grep` で 0 件）
- [ ] presentational コンポーネントの全状態のストーリーが Storybook にある
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
