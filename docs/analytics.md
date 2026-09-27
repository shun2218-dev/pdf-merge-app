# アナリティクス

プロダクトのアナリティクスの正本。決めごとの理由は [ADR 0011](adr/0011-product-analytics.md)。
イベントを足す・変えるときは、`lib/analytics/events.ts` の型とこの表を同じ PR で更新する。

## 仕組み

- 送信先は PostHog。コンポーネントは `lib/analytics` の `track()` だけを呼ぶ。
- 送るのは本番（`NEXT_PUBLIC_VERCEL_ENV === "production"`）で、`NEXT_PUBLIC_POSTHOG_KEY` があるときだけ。開発中はブラウザのコンソールに `[analytics]` として出す。
- SDK は最初のイベントが起きてから読み込む。読み込んだ時点で `$pageview` を 1 回送り、それまでに起きたイベントを順に送る。
- Cookie も localStorage も使わない（`persistence: "memory"`）。そのため **「セッション」は 1 回のページの読み込み**で、再読み込みや別のタブは別の人として数えられる。
- 自動の収集（autocapture）・画面の録画・アンケート・ページ離脱の記録は使わない（ADR 0011）。ヒートマップ・Web Vitals・デッドクリック・例外の自動収集も無効にしている（ADR 0019。ヒートマップとデッドクリックは Phase 4 で 2 週間試す）。
  - PostHog はプロジェクトの設定（管理画面）でもこれらを有効にできるので、コードでも明示的に切っている。
  - 管理画面（Settings → Project）でも、Autocapture・Heatmaps・Web vitals autocapture・Session replay を Off にしておく。Web Vitals は Vercel Speed Insights で測る（ADR 0012）。エラーは Sentry で見る（ADR 0007）。
- ページビューそのものは、引き続き Vercel Web Analytics でも数えている（PostHog のページビューは、何か操作をした人だけ）。

## 送らないもの

- ファイル名・ファイルの中身・ページのテキスト・出力のファイル名
- IP アドレス（PostHog のプロジェクトの設定「Discard client IP data」を有効にする）
- 数や大きさの生の値。すべて下の区間に丸める

| 区間 | 値 |
|---|---|
| 数（`*_bucket` のうち数のもの） | `0` / `1` / `2` / `3-5` / `6-10` / `11-30` / `31+` |
| 大きさ（`size_bucket`） | `<1MB` / `1-5MB` / `5-20MB` / `20-100MB` / `100MB+` |
| 時間（`duration_bucket`） | `<1s` / `1-3s` / `3-10s` / `10-30s` / `30s+` |

## イベント

| イベント | いつ | プロパティ | 状態 |
|---|---|---|---|
| `files_added` | PDF を一覧に追加したとき | `source`（`picker` / `drop`）、`count_bucket`、`size_bucket` | 実装済み |
| `files_rejected` | 追加できなかったとき | `reason`（いまは `not_pdf` だけ）、`count_bucket`（断ったファイルの数） | 実装済み |
| `file_removed` | 1 つ削除したとき | `remaining_bucket` | 実装済み |
| `files_reordered` | ドラッグを終えて並びが変わっていたとき（1 回のドラッグで 1 回） | `method`（いまは `pointer` だけ） | 実装済み |
| `merge_started` | 結合を始めたとき（プレビュー・ダウンロードのどちらからでも） | `count_bucket`、`size_bucket` | 実装済み |
| `merge_succeeded` | 結合できたとき | `duration_bucket`、`count_bucket`、`size_bucket` | 実装済み |
| `merge_failed` | 結合に失敗したとき | `reason`（`payload_too_large` / `server_error` / `network_error`） | 実装済み |
| `preview_opened` | 「プレビュー」を押して、プレビューが開いたとき | — | 実装済み |
| `download_clicked` | ダウンロードしたとき | `renamed`（いまは常に `false`）、`previewed`（押した時点でプレビューを見ていたか） | 実装済み |
| `files_cleared` | すべて削除したとき | `remaining_bucket` | 未実装（ADR 0009 で UI ができたら） |
| `size_warning_shown` | 大きさの警告を出したとき | `size_bucket` | 未実装（ADR 0002 / 0009） |
| `theme_changed` / `locale_changed` | 切り替えたとき | `value` | 未実装（ADR 0008 / 0013） |

今後の予定:

- `files_rejected` の `reason` に `encrypted` / `corrupt` を足す（ADR 0002 でブラウザ内で PDF を読むようになったら）。
- `merge_failed` の `reason` を `out_of_memory` / `worker_error` / `unknown` に置き換える（ADR 0002）。
- `merge_started` などに `pages_bucket` を足す（ブラウザ内でページ数を数えるようになったら）。
- `files_reordered` の `method` に `touch` / `keyboard` / `menu` / `sort_by_name` を足す（ADR 0010）。

## KPI

週に 1 回見る（ADR 0011 決定 5）。「セッション」は上のとおり 1 回のページの読み込み。

| KPI | 定義 |
|---|---|
| 完了率 | `download_clicked` のあったセッション ÷ `files_added` のあったセッション |
| 失敗率 | `merge_failed` の数 ÷ `merge_started` の数 |
| 拒否率 | `files_rejected` の数 ÷ (`files_added` の数 + `files_rejected` の数) |
| モバイルの完了率 | 完了率を、PostHog が付ける端末の種類（`$device_type`）で分けたもの |

## ベースライン

改善の前の値。本番で 1 週間分を取ってから書く（ADR 0011 の DoD）。Phase 6 で改善後の値と比べる。

| KPI | 値 | 期間 |
|---|---|---|
| 完了率 | （未計測） | |
| 失敗率 | （未計測） | |
| 拒否率 | （未計測） | |
| モバイルの完了率 | （未計測） | |
