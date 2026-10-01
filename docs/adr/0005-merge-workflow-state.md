# 0005. 結合の状態管理を 1 つのフックにまとめ、画面を分割する

- 状態: 採用
- オーナーの確認: 2026-09-27
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

- [x] （先行の hotfix）プレビューせずに「ダウンロード」を 1 回押すと `merged.pdf` がダウンロードされる E2E があり、通る（`e2e/merge.spec.ts`。#83 の CI で通過）
- [x] reducer のすべての操作に、状態遷移のユニットテストがある（2026-10-01）
- [x] 一覧を変えたとき・アンマウント時に `URL.revokeObjectURL` が呼ばれることをテストした（2026-10-01）
- [x] 同じ名前のファイルを 2 つ入れて並び替えても、React の key の警告が出ない（2026-10-01。並び替えても同じ行が同じ要素のまま動くことも確かめた）
- [x] `app/page.tsx` に `"use client"` がない（2026-10-01）
- [x] コンポーネントの中に `<svg>` の直書きと `alert(` がない（`grep` で 0 件）（2026-10-01）
- [x] presentational コンポーネントの全状態のストーリーが Storybook にある（2026-10-01。`merge-preview` を除く。追記を参照）
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-10-01: 実装

オーナーの判断（2026-10-01）で、次の 2 つを決めてから実装した。

- **エラーの見せ方（決定 7）**: `alert()` をやめ、文言はそのままで、該当するカード（アップロード・結合）の中に赤い文字で出す。スクリーンリーダーにも伝わるよう `role="alert"` を付ける。見た目は ADR 0009（Phase 4）で作り直す。
- **状態の範囲（決定 1）**: いまの画面に要る分だけにした。`items`（`id` とファイル）・`phase`（`idle` / `merging` / `done` / `error`）・`result`（`{ url }`）・`error`（`not_pdf` / `merge_failed`）。暗号化（`encrypted`）・ページ数・進捗・大きさは、ADR 0002 / 0009 でその機能と一緒に足す（CLAUDE.md の「先回りして作らない」）。操作の `clear` も、「すべて削除」の UI ができる ADR 0009 で足す。

実装の詳細:

- `lib/merge-workflow/reducer.ts`（純粋な状態遷移）・`hooks/use-merge-workflow.ts`（通信・URL の解放・アナリティクス・Sentry）・`components/merge/`（`merge-workspace` と、props だけで描く `drop-zone` / `file-list` / `merge-actions` / `merge-preview`）・`app/page.tsx`（サーバーコンポーネント）に分けた。`components/file-uploader.tsx` と `components/file-list.tsx` は消した。
- PDF かどうかの判定と `files_added` / `files_rejected` の送信は、アップロードの部品からフックに移した（部品を props だけで描くため）。PDF 以外が混ざったら全部を受け付けない、いまの振る舞いは変えていない（見直しは ADR 0009）。
- フックの非同期の操作は、最新の状態を `useRef` で読む（setState の直後の state は古いため。B-1 と同じ理由）。
- **結合の結果があるときは、「プレビュー」を押し直しても結合し直さない。** ロードマップの「棚卸しに残っている小さな問題」の「プレビューのたびに結合し直す無駄」を、ここで直した。`merge_started` の数え方が変わるので、`docs/analytics.md` に書いた。
- URL の解放は、`result.url` が変わったとき（一覧の変更で結果を捨てたとき）とアンマウントのときに、`useEffect` の後片付けで行う。
- 決定 6: アイコンを `lucide-react`（`Upload` / `GripVertical` / `FileText` / `X` / `Eye` / `Download`）にした。どれも、これまで直書きしていた SVG と同じ lucide の形。この版の lucide は `aria-hidden` を付けないので、すべて明示した。ヘッダーと `components/ui/button.stories.tsx` の SVG も置き換えた。
- B-6 のテストは「key の警告が出ない」だけでは足りなかった（`ファイル名-位置` の key でも警告は出ない）。並び替えたあとも同じファイルの行が同じ DOM の要素のまま動くことを確かめるテストにした。古い key に戻すと失敗することを確かめた。
- `merge-preview` の Story は作っていない。ADR 0003 で置き換える PDF のビューア（`@react-pdf-viewer`）を包むだけで、Story では pdf.js の Worker の読み込みが要る。ビューアを置き換えるときに、読み込み中・表示・失敗の Story を作る。
- 移した `drop-zone` / `file-list` に、もとからあった `biome-ignore`（a11y のルール。ADR 0014 の「抑止しない」より前のもの）が残っている。キーボードでの操作を作る ADR 0010 / 0014 で消す。
- E2E の「PDF 以外を選んだとき」は、ダイアログではなく画面の文言を確かめる形にした。Next.js の route announcer も `role="alert"` を持つので、文言で絞る。
- 大きさ: `/` の First Load JS は 205 kB → 206 kB（ページの部分が +0.7 kB）。
