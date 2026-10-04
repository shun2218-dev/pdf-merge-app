# パフォーマンス

パフォーマンスの計測と予算の正本。決めごとの理由は [ADR 0012](adr/0012-performance-budget.md)。

## 計測の方法

| 種類 | 道具 | どこで | 実行 |
|---|---|---|---|
| 実利用（RUM）の LCP / INP / CLS | `web-vitals` で測り、PostHog に `web_vital` として送る（ADR 0021） | 本番 | 自動。PostHog の Insight で p75 を見る |
| 実利用（RUM）のまとめた点数 | Vercel Speed Insights（Hobby プランでは Real Experience Score だけが見られる） | 本番 | 自動。Vercel のダッシュボードで見る |
| 合成（ラボ） | Lighthouse CI（モバイルの設定・Sentry 有効。温める 2 回を捨て、CPU の倍率を基準の端末（benchmarkIndex 440）に補正した 7 回の指標ごとの中央値。ADR 0025 / 0028） | CI の `lighthouse` ジョブ（PR ごと） | `NEXT_PUBLIC_SENTRY_DSN=http://0123456789abcdef0123456789abcdef@127.0.0.1:3001/1 SENTRY_AUTH_TOKEN= pnpm build && pnpm lhci`（手元の値は、マシンが違うので関門の判定には使わない） |
| バンドル | `next experimental-analyze`（Turbopack のアナライザ。ADR 0015） | ローカル | `pnpm analyze`（ブラウザで開く。`-o` でファイルに書くだけにもできる） |
| 結合の時間 | Playwright（`perf/merge-timing.spec.ts`） | ローカル（時間がかかるので CI には入れない） | `pnpm build && pnpm test:perf` |

### 結合の時間の固定のファイルの組

`perf/merge-timing.spec.ts` がテストの中で作る。変えるときはテストも直す。

| 組 | 内容 |
|---|---|
| A | 10 ファイル × 1MB |
| B | 5 ファイル × 20MB |
| C | 100 ファイル × 100KB |

- 1 ページの PDF の内容のストリームに、PDF のコメント行を詰めて大きさを合わせる（描画はされないが、結合ではページと一緒にコピーされる）。
- 計るのは「プレビュー」を押してから、結合した PDF を受け取り終えるまで。各組 3 回の中央値。

## 予算

決め方は ADR 0023。最上位の目標は実際の利用者の p75 の LCP / INP / CLS で、CI の関門はそれを Lighthouse のモバイルの設定（遅い 4G・4 倍遅い CPU）に当てはめたもの。`lighthouserc.json` と CI で守る。RUM の値は週に 1 回 PostHog で見る。

| 指標 | 予算 | 測る場所 | 状態 |
|---|---|---|---|
| Lighthouse Performance（モバイル） | 0.90 以上 | Lighthouse CI | Lighthouse の「良い」（緑）の線（ADR 0023 決定 3） |
| Lighthouse Accessibility | 1.00 | Lighthouse CI | ベースラインに締めた |
| Lighthouse Best Practices | 1.00 | Lighthouse CI | ベースラインに締めた（目標は 0.95） |
| Lighthouse SEO | 1.00 | Lighthouse CI | ベースラインに締めた（目標は 0.95） |
| LCP（ラボ） | 2,500 ms 以下 | Lighthouse CI | 実際の利用者の LCP の目標をラボに当てはめた（ADR 0023 決定 3） |
| TBT（ラボ） | 200 ms 以下 | Lighthouse CI | INP の代わり（ADR 0023 決定 3） |
| CLS（ラボ） | 0.1 以下 | Lighthouse CI | |
| JS の転送量（ラボ、`resource-summary:script:size`） | 350,000 バイト以下 | Lighthouse CI | 超えたら LCP の関門を必ず満たせない上限。(2,500 − FCP 約 760 ms) × 1.6 Mbps から逆算（ADR 0023 決定 4） |
| LCP | 2.5 秒以下（RUM の p75） | PostHog（`web_vital`） | |
| INP | 200ms 以下（RUM の p75） | PostHog（`web_vital`） | |
| CLS | 0.1 以下（RUM の p75） | PostHog（`web_vital`） | |
| 結合（組 B） | ベースラインの値 | Playwright | ADR 0002 の後に確定 |

## 変える前のラボの値（2026-10-04。ADR 0029 決定 2）

本番のアクセスがほとんどなく、実利用の「変える前」が取れないので、本番の版（`main`。v1.2.1）と、リリースの前の `develop`（9311fbe）を、いまの CI の条件（ADR 0025 / 0028。温める 2 回を捨て、CPU の倍率を benchmarkIndex 440 に補正し、Sentry 有効で 7 回の指標ごとの中央値）で測った。測る仕組みは `develop` の `scripts/lighthouse-ci.ts` と `lighthouserc.json` を両方に使い、同じマシンで続けて測った（一時的なワークフロー。マージせずに消した）。Phase 6 の効果の検証では、まずこの値と比べる。

| 指標 | `main`（v1.2.1） | `develop`（9311fbe） | 関門 |
|---|---|---|---|
| Performance | 0.85〜0.87 | 0.98 | 0.90 以上 |
| LCP | 1,814〜1,815 ms | 1,665〜1,668 ms | 2,500 ms 以下 |
| TBT | 495〜568 ms | 145〜165 ms | 200 ms 以下 |
| CLS | 0 | 0 | 0.1 以下 |
| JS の転送量 | 247,958 B | 193,193 B | 350,000 B 以下 |

- 3 台（AMD EPYC 7763・EPYC 9V45・Intel Xeon Platinum 8370C）の値の範囲。同じ日に別の 3 台（EPYC 9V74・Xeon Platinum 8573C・EPYC 7763）で測った `develop` の TBT は 134〜167 ms で、`main` はそこでも TBT と Performance の関門を超えた。
- いまの本番は、TBT と Performance で関門を超えている。`develop` を出すと、TBT が約 7 割、LCP が約 150 ms、JS が約 22% 減る見込み。

## ベースライン（2026-09-27）

`develop`（ADR 0011 のアナリティクスまで入ったもの）に Speed Insights を足した状態。

### Lighthouse（ローカル、MacBook、モバイルの設定・3 回）

| 指標 | 3 回の値 | 中央値 |
|---|---|---|
| Performance | 0.97 / 0.97 / 0.96 | 0.97 |
| Accessibility | 1 / 1 / 1 | 1.00 |
| Best Practices | 1 / 1 / 1 | 1.00 |
| SEO | 1 / 1 / 1 | 1.00 |
| LCP | 2,673 / 2,653 / 2,678 ms | 2,673 ms |
| TBT | 63 / 46 / 71 ms | 63 ms |
| CLS | 0 / 0 / 0 | 0 |
| JS の転送量 | 244,546 バイト | 244,546 バイト |

- Performance はローカルの別の回で 0.94 も出た。点数は実行のたびに揺れる。
- LCP はラボの値（遅い回線と CPU を模擬したもの）で、予算の 2.5 秒（RUM の p75）とは比べない。
- CI（GitHub Actions）での値は下の表に集める。

### Lighthouse（CI、GitHub Actions の ubuntu-latest、モバイルの設定・3 回）

Performance の予算を締めるために、10 回ほど集める（ADR 0012 の DoD）。締める値は、集めた中央値の最小値。

| # | 日付 | PR | Performance（3 回） | 中央値 | LCP の中央値 | TBT の中央値 |
|---|---|---|---|---|---|---|
| 1 | 2026-09-27 | #57 | 0.90 / 0.95 / 0.97 | 0.95 | 1,815 ms | 253 ms |
| 2 | 2026-09-27 | #61 | 0.89 / 0.97 / 0.97 | 0.97 | 1,819 ms | 187 ms |
| 3 | 2026-09-27 | #62 | 0.81 / 0.97 / 0.97 | 0.97 | 1,825 ms | 199 ms |
| 4 | 2026-09-27 | #68 | 0.78 / 0.96 / 0.96 | 0.96 | 1,821 ms | 211 ms |

- どの回も 1 回目だけが遅い（起動したばかりのサーバーが温まっていないため）。判定は 3 回の中央値なので、予算の判定には影響しない。

### ビルド

| 指標 | 値 |
|---|---|
| `/` の First Load JS | 238 kB（ページ 27.2 kB + 共有 211 kB） |

### 結合の時間（ローカル、`next start`、3 回）

| 組 | 3 回の値 | 中央値 |
|---|---|---|
| A: 10 ファイル × 1MB | 113 / 80 / 71 ms | 80 ms |
| B: 5 ファイル × 20MB | 450 / 331 / 335 ms | 335 ms |
| C: 100 ファイル × 100KB | 122 / 100 / 102 ms | 102 ms |

- いまはサーバーで結合しているので、ローカルの値にはネットワークの往復が入っていない。本番では、組 B（合計 100MB）は Vercel のリクエストの上限（4.5MB）を超えるので失敗する（B-2）。
- ADR 0002 でブラウザ内の結合に移したら、同じ組で測り直し、組 B を予算にする。

### 実利用（RUM）

ADR 0021 を本番に出してから 1 週間分を PostHog で取って書く予定だったが、本番のアクセスがほとんどないため、端末ごとに LCP の `web_vital` が 100 件たまってから書く（ADR 0029 決定 3）。件数は週に 1 回見る。

- 2026-10-04 の時点: Vercel Web Analytics の本番の閲覧は、2026-09-20〜10-04 で 36 回（デスクトップ 32・モバイル 4）。ほとんどがオーナー自身の確認（2026-09-27 に 26 回）。実利用の値としては使えない。

| 指標 | p75（desktop） | p75（mobile） | 期間 |
|---|---|---|---|
| LCP | （未計測） | （未計測） | |
| INP | （未計測） | （未計測） | |
| CLS | （未計測） | （未計測） | |
