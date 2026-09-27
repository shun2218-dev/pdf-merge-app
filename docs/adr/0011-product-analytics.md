# 0011. プロダクトのアナリティクス（イベント設計と計測基盤）

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: M-1、ADR 0002 / 0005 / 0007 / 0009 / 0012

## 背景

- いまは Vercel Web Analytics（`<Analytics />`）でページビューだけを取っている（M-1）。
- 「ページを開いた人のうち、何割がファイルを追加し、何割が結合し、何割がダウンロードまで行ったか」「失敗はどれくらいで、理由は何か」「スマートフォンの利用はどれくらいか」が分からない。
- これから ADR 0002 / 0009 / 0010 で流れを大きく変える。**変える前の数字（ベースライン）がないと、良くなったのかを判定できない。** そのため、この ADR は UI の改善より先（Phase 1）に実装する。
- 一方で、このアプリは「ファイルの中身を扱わない」ことを売りにする（ADR 0002）。アナリティクスでファイル名や中身の手がかりを送ったら、その約束が崩れる。

## 検討した選択肢

| 案 | 良い点 | 悪い点 |
|---|---|---|
| **A. Vercel Web Analytics のカスタムイベント（`track`）** | すでに入っている。Cookie を使わない。追加の同意バナーが要らない | カスタムイベントを使えるプラン・上限の確認が要る。ファネル分析の機能は簡素 |
| **B. PostHog（Cookie なしのモード）** | ファネル・リテンション・機能フラグまで揃う。無料枠が大きい | SDK が重め（遅延読み込みが要る）。送信先が増える |
| C. Google Analytics 4 | 無料・定番 | Cookie を使うので同意の管理が要る。SDK が重い。プライバシーの印象が悪い |
| D. Plausible / Umami | 軽くプライバシーに配慮 | 有料か自前ホスト |

## 決定

1. **送信の窓口を `lib/analytics/` の 1 箇所に閉じ込める。** コンポーネントは `track("merge_succeeded", { ... })` だけを呼び、どのサービスに送るかを知らない。
   イベント名とプロパティは TypeScript の型（判別可能なユニオン）で定義し、定義にないイベントや型の違うプロパティはコンパイルエラーにする。
2. **送信先は B（PostHog）にする**（オーナーの回答 2026-09-27）。
   - 選んだ理由: ファネル分析が最初から入っている（決定 5 の完了率がそのまま見られる）。Cookie を使わずに動かせるので同意のバナーが要らない。無料枠（月 100 万イベント）に収まる。将来 UI の改善を A/B テストするときにも使える。
   - Cookie を使わない設定（`persistence: "memory"`）にし、自動収集（autocapture・Session Replay・ページ離脱の記録）は切って、決定 4 のイベントだけを送る。
   - SDK が大きいので、最初の操作（ファイルの追加）が起きてから遅延読み込みする。ページビューは読み込んだ時点で 1 回送る。
   - データの保管先（US / EU）は、利用者の分布を見て実装時に決め、「追記」に書く。
   - Vercel Web Analytics（ページビュー）は、PostHog のベースラインが取れるまで並行して残す。外すかどうかは Phase 1 の終わりに決めて「追記」に書く。
3. **送ってよいもの / いけないものを決める。**
   - 送らない: ファイル名・ファイルの中身・ページのテキスト・出力のファイル名・IP の生値（サービス側に任せ、自分で付けない）。
   - 数や大きさは**区間（バケット）に丸めて**送る。例: ファイル数 `1` / `2` / `3-5` / `6-10` / `11-30` / `31+`、合計サイズ `<1MB` / `1-5MB` / `5-20MB` / `20-100MB` / `100MB+`。個々のファイルを特定できないようにするため。
4. **イベントの正本は `docs/analytics.md` の表にする。** 型の定義と表を同じ PR で更新する。初期のイベントは次のとおり。

   | イベント | いつ | プロパティ |
   |---|---|---|
   | `files_added` | 一覧に追加したとき | `source`（picker / drop）、`count_bucket`、`size_bucket` |
   | `files_rejected` | 追加できなかったとき | `reason`（not_pdf / encrypted / corrupt）、`count_bucket` |
   | `file_removed` / `files_cleared` | 削除したとき | `remaining_bucket` |
   | `files_reordered` | 並びを確定したとき | `method`（pointer / touch / keyboard / menu / sort_by_name） |
   | `merge_started` | 結合を始めたとき | `count_bucket`、`size_bucket`、`pages_bucket` |
   | `merge_succeeded` | 結合できたとき | `duration_bucket`、`count_bucket`、`size_bucket` |
   | `merge_failed` | 結合に失敗したとき | `reason`（out_of_memory / worker_error / unknown） |
   | `preview_opened` | プレビューを開いたとき | — |
   | `download_clicked` | ダウンロードしたとき | `renamed`（出力名を変えたか）、`previewed`（プレビューを見たか） |
   | `size_warning_shown` | 大きさの警告を出したとき | `size_bucket` |
   | `theme_changed` / `locale_changed` | 切り替えたとき | `value` |

   端末の種類（モバイル / デスクトップ）・国・参照元はサービスが自動で付けるので、自分では送らない。
5. **KPI を決め、週に 1 回見る。**
   - 完了率 = `download_clicked` のあったセッション ÷ `files_added` のあったセッション
   - 失敗率 = `merge_failed` ÷ `merge_started`
   - 拒否率 = `files_rejected` ÷ (`files_added` + `files_rejected`)
   - モバイルの完了率（上の完了率を端末で分けたもの）
   ADR 0002 / 0009 / 0010 の完了後に、ベースラインと比べた結果をロードマップの Phase 6 に書く。
6. **本番（`VERCEL_ENV === "production"`）以外では送らない。** 開発中は `console.debug` に出すだけにする。
7. **`/about`（ADR 0009）に、何を計測しているかを書く。**

## 結果

- 良い点: 改善の効果を数字で判定できる。ページ単位の操作（ADR 0009 決定 3 で見送り）を作るべきかどうかも、データで判断できる。
- 悪い点: イベントを足すたびに型・表・テストを更新する手間がある。バケットに丸めるので、細かい分布は見えない。

## オーナーに確認したいこと

1. ~~送信先~~ → **PostHog でよい（オーナーの回答 2026-09-27）**。決定 2 に反映した。
2. KPI（決定 5）の定義でよいか。

**オーナーの回答（2026-09-27）**: すべて提案どおりでよい。KPI は決定 5 の定義でよい。

## 完了条件（DoD）

- [x] `docs/analytics.md` に決定 4 のイベントの表と KPI の定義がある
- [x] イベントの型が定義され、定義にないイベントを送るとコンパイルエラーになる
- [x] 各イベントが、決定 4 の「いつ」で 1 回だけ送られることをユニット / コンポーネントテストで確かめた（いまの UI にあるイベントについて）
- [x] 送るプロパティにファイル名が含まれないことをテストで確かめた（ファイル名にしか現れない文字列を使ったテスト）
- [x] 本番以外では送信されない
- [ ] 本番で 1 週間分のベースライン（KPI の値）を取り、`docs/analytics.md` に書いた
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-27: 実装

- 窓口は `lib/analytics/`。`events.ts`（イベントの型）・`buckets.ts`（区間への丸め）・`track.ts`（PostHog への送信）。コンポーネントは `track()` だけを呼ぶ。
- `track` の引数はイベント名ごとにプロパティの型が決まり、定義にないイベント名や、違う型のプロパティはコンパイルエラーになる。
- PostHog の SDK（`posthog-js`）は、最初のイベントが起きてから `import()` で読み込む。読み込むまでのイベントは貯めて、読み込んだあとに `$pageview` → 貯めたイベントの順に送る。広告ブロッカーなどで読み込めなくても、アプリの動作には影響させない。
  - `posthog-js` は、公開から 1 週間以上たった `1.434.2` にした。最新の `1.434.15` は公開から 1 日たっておらず、pnpm の「公開直後の版は入れない」ルール（`minimumReleaseAge`）に引っかかったため。
- 設定は `persistence: "memory"`（Cookie も localStorage も使わない）、`autocapture` / `capture_pageview` / `capture_pageleave` を切り、`disable_session_recording` / `disable_surveys`、`person_profiles: "identified_only"`。
  - その結果、**「セッション」は 1 回のページの読み込み**になる。KPI の定義（`docs/analytics.md`）もこの前提で読む。
- 送るのは `NEXT_PUBLIC_VERCEL_ENV === "production"` で、`NEXT_PUBLIC_POSTHOG_KEY` があるときだけ。送信先は `NEXT_PUBLIC_POSTHOG_HOST`（未設定なら US の `https://us.i.posthog.com`）。
- いまの UI（サーバーで結合している）に合わせて、決定 4 の表から次を変えた。
  - `merge_failed` の `reason` は、サーバーとの通信の結果で `payload_too_large`（413）/ `server_error` / `network_error` に分ける。ADR 0002 でブラウザ内の結合に移したら、決定 4 の値に置き換える。
  - `pages_bucket` は、ページ数をブラウザで数えるようになるまで送らない。
  - `files_rejected` の `reason` は `not_pdf` だけ、`files_reordered` の `method` は `pointer` だけ。
  - `files_cleared` / `size_warning_shown` / `theme_changed` / `locale_changed` は、UI ができたときに足す。
  - `preview_opened` は「プレビュー」を押して開いたときだけ。プレビューせずに「ダウンロード」を押したときも結合の結果としてプレビューが開くが、利用者が求めたものではないので数えない。
- 並び替えは、ドラッグ中に `dragover` のたびに並びが変わるので、`FileList` に `onReorderEnd` を足し、1 回のドラッグで並びが変わっていたときだけ `files_reordered` を送る。
- Vercel Web Analytics（ページビュー）は並行して残している（決定 2）。
- PostHog はプロジェクトの設定（管理画面）で autocapture・ヒートマップ・Web Vitals などを有効にでき、SDK は起動時にそれを読みに来る。管理画面の設定に左右されないよう、コードでも `capture_heatmaps` / `capture_performance` / `capture_dead_clicks` / `capture_exceptions` を `false` にした。
  - **ヒートマップ・Web Vitals・デッドクリック・例外の自動収集は、この ADR で検討していなかった。** 上の無効化は、必要かどうかを評価しないまま入れたもので、**ADR 0019 で決めるまでの仮の設定**として残す（オーナーの指摘と判断: 2026-09-27）。`init` に渡す設定は `posthog-js` の `PostHogConfig` の型で書き、オプション名の打ち間違いを型チェックで見つけられるようにした。
- オーナーが PostHog のプロジェクトを作った（2026-09-27）。オンボーディングでは Product Analytics だけを選び、SDK のウィザード（`npx @posthog/wizard@latest`）は使わず、Autocapture・Heatmaps・Web vitals autocapture・Session Replay を Off にした（ヒートマップと Web Vitals は、ADR 0019 で決めるまでの仮の設定）。
