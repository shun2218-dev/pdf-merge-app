# 0012. パフォーマンスの計測と予算（RUM・Lighthouse CI・バンドル）

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: M-2、ADR 0002 / 0003 / 0004 / 0006 / 0008 / 0011 / 0015

## 背景

- 実際の利用者の Web Vitals（LCP / INP / CLS）を取っていない。Lighthouse の値もバンドルサイズも追っていない（M-2）。
- 気になる点はいくつかあるが、数字がないので優先順位を付けられない。
  - `app/page.tsx` 全体が `"use client"` で、ページの HTML にほとんど中身がない
  - 未使用の依存が多い（ADR 0004）
  - プレビューのワーカー（1MB）とビューア
  - フォントを読み込んでいない（ADR 0008）ので、将来入れると CLS が起きうる
  - 結合の時間（いまはサーバーとの往復。ADR 0002 後は端末の性能）
- ADR 0011 と同じく、**変える前の数字を先に取る**必要がある。

## 決定

### 1. 3 種類の計測をする

| 種類 | 何を | 道具 |
|---|---|---|
| 実利用（RUM） | LCP / INP / CLS / FCP / TTFB を実際の利用者から | Vercel Speed Insights（`@vercel/speed-insights`） |
| 合成（ラボ） | Lighthouse のスコアと指標。PR ごと | Lighthouse CI（`@lhci/cli`、GitHub Actions で `next start` に対して、モバイルの設定で 3 回の中央値） |
| バンドル | ルートごとの First Load JS、チャンクの中身 | `@next/bundle-analyzer`（Next.js 16 で Turbopack のアナライザが使えるならそちら。ADR 0015） |

加えて、**結合の時間**を計る。

- ラボ: `docs/performance.md` に決めた固定のファイルの組（10 ファイル × 1MB、5 ファイル × 20MB、100 ファイル × 100KB）で、Playwright から結合の開始から完了までを `performance.mark` / `measure` で計る。
- 実利用: ADR 0011 の `merge_succeeded` の `duration_bucket`。

### 2. 予算（上限）を決め、CI で守る

初期の予算は次のとおり。**Phase 1 でベースラインを測り、ベースラインより悪い値は予算にしない**（予算がいまの値より緩ければ、いまの値に締める）。

| 指標 | 予算 | 測る場所 |
|---|---|---|
| Lighthouse Performance（モバイル） | 90 以上 | Lighthouse CI |
| Lighthouse Accessibility | 100 | Lighthouse CI（ADR 0014） |
| Lighthouse Best Practices / SEO | 95 以上 | Lighthouse CI |
| LCP | 2.5 秒以下（RUM の p75） | Speed Insights |
| INP | 200ms 以下（RUM の p75） | Speed Insights |
| CLS | 0.1 以下（RUM の p75） | Speed Insights |
| `/` の First Load JS | ベースラインから 20% 減（ADR 0004 の後に確定） | ビルドの出力 |
| 5 ファイル × 20MB の結合 | ベースラインの値（ADR 0002 の後に確定） | Playwright |

- Lighthouse CI の予算を超えたら PR を失敗にする（ADR 0006 の `lighthouse` ジョブ）。
- RUM の値は CI では守れないので、週に 1 回 Speed Insights を見て、p75 が予算を超えていたら assessment に足す。

### 3. 重いものは、要るときに読み込む

計測の結果にかかわらず、次は方針として守る。

- プレビュー（ADR 0003）・結合の Worker（ADR 0002）・サムネイルの描画は、それを使う操作が起きるまで読み込まない。
- ページの見出し・説明・ドロップ領域の見た目はサーバーで描き（ADR 0005 決定 5）、HTML に含める。
- 和文のウェブフォントを読み込まない（ADR 0008 決定 5）。

### 4. 結果を `docs/performance.md` に残す

ベースライン・予算・各 ADR の前後の値を表で残す。数字は PR にも貼る。

## 結果

- 良い点: 「速くなった / 遅くなった」を数字で言える。バンドルの肥大化を PR の時点で止められる。
- 悪い点: CI の時間が Lighthouse の分（2〜3 分）延びる。Speed Insights はプランによってデータ点数に上限がある。

## オーナーに確認したいこと

1. Speed Insights を有効にしてよいか（プランの上限の確認を含む）。

**オーナーの回答（2026-09-27）**: すべて提案どおりでよい。Speed Insights を有効にしてよい（プランのデータ点数の上限は、有効にするときに確かめる）。

## 完了条件（DoD）

- [ ] Speed Insights が本番で有効で、データが届いている
- [x] Lighthouse CI が PR ごとに走り、予算を超えると失敗する
- [x] バンドルアナライザを `pnpm analyze` で起動できる
- [x] 結合の時間を計る Playwright のテストがあり、`docs/performance.md` に固定のファイルの組が書かれている
- [ ] `docs/performance.md` にベースライン（Lighthouse・First Load JS・結合の時間・RUM の p75）と予算がある
- [ ] CI での Lighthouse の Performance を 10 回ほど集め、その最小値に予算を締めた
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-27: 実装

- Speed Insights は `app/layout.tsx` に `<SpeedInsights />` を置いた。Vercel Web Analytics の `<Analytics />` と一緒に、表示の条件を「本番ビルドのとき」（`NODE_ENV === "production"`）から「Vercel の上で動いているとき」（`VERCEL === "1"`）に変えた。
  - どちらのスクリプト（`/_vercel/insights/script.js` と `/_vercel/speed-insights/script.js`）も Vercel の上でしか配信されず、ローカルや CI の `next start` では 404 になる。この 404 がコンソールのエラーになり、Lighthouse の Best Practices を 0.96 に下げていた。本番の動作は変わらない。
  - Speed Insights は、Vercel のダッシュボードのプロジェクトの Speed Insights のタブで有効にしてから、データが届くようになる。
- Lighthouse CI は `lighthouserc.json` に設定を書き、CI に `lighthouse` ジョブを足した（`next build` → `lhci autorun`。ubuntu-latest に入っている Google Chrome を使う）。予算は次のとおり。
  - Accessibility / Best Practices / SEO は、ベースライン（すべて 1.00）に締めた。どれも点数が揺れない監査なので、そのまま予算にできる。
  - **Performance は、ADR の目標値の 0.90 を仮の予算にした。** 決定 2 は「ベースライン（ローカルで 0.97）に締める」だが、点数は実行のたびに揺れ（ローカルで 0.94〜0.97）、CI のマシンでの値もまだ分からない。そのまま 0.97 にすると、コードと関係なく CI が落ちうる。CI での値を 10 回ほど集め、その最小値に締める（DoD に足した）。
  - ラボの CLS は 0.1 以下、JS の転送量（`resource-summary:script:size`）は 250,000 バイト以下（ベースラインは 244,546 バイト）。後者は増えていないことの見張りで、20% 減の予算は ADR 0004 の後に決める。
  - どれも 3 回の中央値（`aggregationMethod: "median-run"`）で判定する。
- バンドルアナライザは `@next/bundle-analyzer`（Next.js 本体と同じ 15.1.9）。`ANALYZE=true` のときだけ有効にし、`pnpm analyze` で起動する。
- 結合の時間は `perf/merge-timing.spec.ts` と `playwright.perf.config.ts`。大きな PDF はリポジトリに入れず、テストの中で `pdf-lib` を使って一時フォルダに作る（内容のストリームに PDF のコメント行を詰めて大きさを合わせる）。時間がかかるので CI には入れず、`pnpm test:perf` でローカルで実行する。
  - 決定 1 は `performance.mark` / `measure` で計るとしていたが、計りたいのは「押してから結合した PDF を受け取り終えるまで」なので、Playwright の側で時刻を取った。ブラウザ内の結合（ADR 0002）に移したら、Worker の中の処理の時間を `performance.measure` で取ることを検討する。
- 追加した依存は、どれも公開から 1 週間以上たった版（`@vercel/speed-insights@2.0.0`、`@lhci/cli@0.15.1`、`@next/bundle-analyzer@15.1.9`）。
- ベースラインは `docs/performance.md`。

### 2026-09-27: CI での値と必須チェック

- `.lighthouseci` はドットで始まる隠しフォルダなので、`actions/upload-artifact@v4` が既定で除外し、最初はレポートが artifact に残っていなかった。`include-hidden-files: true` を指定した。
- CI（GitHub Actions の ubuntu-latest）での 1 回目の Performance は 0.90 / 0.95 / 0.97（中央値 0.95）。ローカル（0.94〜0.97）より揺れが大きく、予算をローカルの 0.97 に締めていたら落ちていた。仮の予算 0.90 のまま、CI の値を集め続ける（集めた値は `docs/performance.md`）。
- PR #57 のマージ後、ブランチ保護のルールセット「protect」の必須チェックに `lighthouse` を加えた（`lint` / `unit` / `storybook` / `e2e` / `lighthouse`）。
