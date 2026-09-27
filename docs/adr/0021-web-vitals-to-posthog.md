# 0021. 実利用者の Web Vitals は自分で測って、自分のドメイン経由で PostHog に送る

- 状態: 採用
- オーナーの確認: 2026-09-27（案 C を選択。細部は下の「オーナーに確認したいこと」）
- 日付: 2026-09-27
- 関連: ADR 0011 / 0012 / 0017 / 0019 / 0020

## 背景

ADR 0012 決定 1 は、実利用者の Web Vitals（LCP / INP / CLS の p75）を Vercel Speed Insights で見るとした。
v1.1.0 を出したあと、**Vercel の Hobby プランでは、Speed Insights の指標ごとの値（FCP / LCP / INP / CLS）が見られない**ことが分かった（2026-09-27）。見られるのは、それらをまとめた点数（Real Experience Score）だけ。指標ごとの値は Speed Insights Plus（Pro プランへの加入が必要。月 $33 相当）で、オーナーの判断で選択肢から外した。
ADR 0012 は、Hobby で何が見られるかを確かめずに決めていた。このままでは、決定 2 の LCP / INP / CLS の予算を確かめる手段がない。

### Web Vitals の取りこぼしの原因

実利用の計測の取りこぼしには、2 つの原因がある。

- **サンプリング**: 一部のアクセスだけを記録すると、残りは記録されない。
- **広告ブロッカー**: 解析サービスのドメインへの送信は、ブラウザの拡張機能で止められることがある。自分のドメインへ送れば避けられる（Speed Insights は `/_vercel/...` に送るので、この点で有利だった）。

## 検討した選択肢

| 案 | 費用 | サンプリング | 広告ブロッカー | 指標ごとの p75 | 手間 |
|---|---|---|---|---|---|
| A. Sentry の Web Vitals | 無料枠 | いまは 10%（`tracesSampler` で読み込みだけ 100% にできる） | `*.sentry.io` は止められやすい。`tunnelRoute` で避けられるが、送信のたびに Vercel の関数が動く | 見られる | 小 |
| B. Cloudflare Web Analytics | 無料 | 少ないアクセスでは実質なし | 止められやすい | 見られる | 小 |
| **C. `web-vitals` で測り、自分のドメイン経由で PostHog に送る** | 無料枠 | なし | 自分のドメイン経由なので避けられる | PostHog の集計で出せる | 中 |
| D. Speed Insights Plus | 月 $33 相当 | — | — | 見られる | なし |

C は、ADR 0019 で退けた「PostHog の SDK の Web Vitals の自動収集」とは別物。ADR 0019 が退けたのは、SDK を最初の操作のあとに読み込むので、何もせずに離脱した人が抜け落ちるためだった。C は SDK を使わず、ページを開いた時点から測る。

## 決定

**C を採る（オーナーの判断: 2026-09-27）。**

1. **測るのは Google の `web-vitals` の `onLCP` / `onINP` / `onCLS`。** ページ（`app/page.tsx`）に置いたクライアントのコンポーネントで、ページを開いた時点から測る。
2. **送るのは ADR 0012 の予算にある LCP / INP / CLS だけ。** FCP / TTFB / FID と Next.js の独自の値は送らない（使わないものを送らない）。1 つの指標が決まるたびに 1 つのイベントを送るので、1 回のページの読み込みで最大 3 件（INP は操作があったときだけ）。
3. **イベントは `web_vital`。** プロパティは次のとおり。ファイル名は含まない（`$pathname` はいまは `/` だけ）。

   | プロパティ | 値 |
   |---|---|
   | `metric` | `LCP` / `INP` / `CLS` |
   | `value` | 測った値（LCP と INP はミリ秒、CLS は単位なし）。p75 を出すために生の値で送る |
   | `rating` | `good` / `needs-improvement` / `poor`（`web-vitals` の判定） |
   | `navigation_type` | `navigate` / `reload` / `back-forward` など |
   | `device_class` | `mobile` / `desktop`（画面の幅 768px 未満を `mobile`）。Lighthouse はモバイルで測るので、実利用も分けて見る |
   | `$pathname` / `$current_url` | ページ |
   | `$process_person_profile` | `false`（人物のプロファイルを作らない） |

4. **SDK を使わず、PostHog の受け口（`/i/v0/e/`）に `fetch`（`keepalive: true`）で直接送る。** SDK の読み込み（ADR 0011 の遅延読み込み）とは関係なく、すべてのアクセスで送る。
5. **送り先は自分のドメインの `/ingest/*` にし、`vercel.json` の rewrites で PostHog（US）に転送する。** 広告ブロッカーで止められにくくするため。Vercel の配信網で転送され、関数は動かない。`next.config` には `skipTrailingSlashRedirect: true` を書く（PostHog の受け口は末尾が `/` のため）。
   - **この経路では、PostHog から見た接続元が Vercel になり、国の判定が狂うことがある**（PostHog のクラウド版は、転送のときに付く元の IP アドレスのヘッダを信用しない）。Web Vitals には国は要らないので、この経路を使う。
6. **`distinct_id` はページの読み込みごとの ID にし、PostHog の SDK にも同じ ID を渡す（`bootstrap`）。** 同じページの読み込みの Web Vitals と、製品のイベント（`files_added` など）を結びつけ、「表示の遅い人ほど完了しないか」を見られるようにする。SDK は Cookie も localStorage も使わない（ADR 0011）ので、ページの読み込みをまたいで人を追うことはない。
7. **送るのは、ADR 0011 と同じく本番で PostHog のキーがあるときだけ。** 開発中はコンソールに出す。
8. **ADR 0012 の予算のうち、LCP / INP / CLS の p75 は PostHog で見る。** Speed Insights は、まとめた点数（Real Experience Score）を見る用として残す。
9. **量の見積もり**: 1 回の読み込みで最大 3 件。PostHog の無料枠（月 100 万件）のうち、製品のイベント（操作をした人 1 回あたり 8〜10 件）と合わせて、月のページの読み込みが 20 万回ほどまでは収まる見込み。超えそうになったら、送る割合を下げることを検討する。

## 結果

- 良い点: 費用なしで、サンプリングも広告ブロッカーの取りこぼしも少なく、LCP / INP / CLS の p75 が見られる。同じページの読み込みの完了率と並べて見られる。
- 悪い点: 送る処理を自分で持つ（数十行）。PostHog の受け口の形式が変わったら直す必要がある。Web Vitals のイベントの国は正確でない。

## オーナーに確認したいこと

1. ~~製品のイベント（PostHog の SDK）も `/ingest` 経由に変えるか~~ → **直接送るまま（オーナーの回答: 2026-09-28）。** 国の正確さを優先する。

   以下は検討の材料として残す。**製品のイベント（PostHog の SDK）も `/ingest` 経由に変えるか。** 変えると広告ブロッカーの取りこぼしが減るが、上の決定 5 のとおり国の判定が狂うことがあり、ADR 0020 で残した国の情報（ADR 0013 で言語を足すかを決める材料）が不正確になる。いまは **SDK は直接送るまま**にしておく（国の正確さを優先）。国の分布は Vercel Web Analytics でも見られるので、SDK も `/ingest` 経由にしてよければそうする。

## 完了条件（DoD）

- [x] 本番で `web_vital` のイベントが `/ingest` 経由で PostHog に届く（ブラウザの開発者ツールの通信と、PostHog の Activity で確認）（2026-09-28。v1.2.1）
- [x] 送るのが LCP / INP / CLS だけで、プロパティにファイル名が含まれないことをテストで確かめた
- [x] 本番以外では送信されない
- [ ] 同じページの読み込みの `web_vital` と製品のイベントの `distinct_id` が同じ
- [ ] PostHog で、LCP / INP / CLS の p75 を端末（`device_class`）ごとに出す Insight を作った
- [x] ADR 0012 の追記と `docs/performance.md` を、RUM の値を PostHog で見るように直した
- [x] `docs/analytics.md` に `web_vital` のイベントを足した
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-27: 実装と、JS の大きさの予算

最初の実装は Lighthouse CI の JS の転送量の予算（250,000 バイト。ADR 0012）を超えた（256,073 バイト。ベースラインは 244,552 バイト）。バンドルアナライザで変更の前後を比べ、原因を 3 つに分けて直した。

| 原因 | 大きさ（圧縮後） | 対応 |
|---|---|---|
| `next.config` の rewrites。Next.js が、ブラウザ側の画面遷移で rewrites を解決するためのコード（`path-to-regexp` など）を共通のチャンクに入れる | 約 6 KB | 転送の設定を `vercel.json` の rewrites に移した。このアプリはブラウザ側で `/ingest` に遷移しないので、ブラウザ側の解決は要らない |
| ルートの `layout.tsx` にクライアントのコンポーネントを置いた（それまで layout にはブラウザの JS がなかった） | 約 3 KB | ページ（`app/page.tsx`）に置いた。いまはページが 1 つだけなので、測れる範囲は変わらない。ページが増えたら（ADR 0013）、共通のクライアントのコンポーネントに移す |
| Next.js の `useReportWebVitals` は、使わない FCP / TTFB / FID まで読み込む | 小さい | `web-vitals@6.2.2`（公開から 1 週間以上たった版）を直接使い、`onLCP` / `onINP` / `onCLS` だけを読み込む |

- 直したあとは 247,934 バイト（ベースラインから +3.4 KB）で、予算の範囲内。内訳は `web-vitals` が 3.0 KB、送信の処理などが 0.5 KB。Lighthouse の Performance は 0.97 のまま。`/` の First Load JS は 238 kB → 241 kB。
- ローカルで `NEXT_PUBLIC_VERCEL_ENV=production` と偽のキーでビルドし、`/ingest/i/v0/e/` への送信が PostHog まで転送され（応答 200）、LCP / INP / CLS の 3 件が決定 3 のプロパティで送られることを確かめた。このときは `next.config` の rewrites で確かめた。`vercel.json` の rewrites は `next start` では効かないので、本番で確かめる（DoD の 1 つ目）。
- Sentry の SDK も、トレースのために独自の Web Vitals のコードを持っている（`@sentry-internal/browser-utils`）。`web-vitals` と役割が重なるので、Sentry のブラウザのトレースを続けるかは、依存の整理（ADR 0004）のときに見直す。

### 2026-09-28: 本番で `/ingest/i/v0/e/` が 404 だったのを直す（B-9）

v1.2.0 のリリース後の確認（DoD の 1 つ目）で、本番の `POST /ingest/i/v0/e/` が PostHog に転送されず、Next.js の 404 になっていることが分かった。`web_vital` は 1 件も届いていなかった。

- 原因: Vercel は `vercel.json` の rewrites の `source` を path-to-regexp の strict（末尾の `/` を区別する）で照合する。`/ingest/:path*` は `/ingest/i/v0/e`（末尾の `/` なし）には当たるが、`/ingest/i/v0/e/` には当たらない。ローカルの確認は `next.config` の rewrites で行っており（上の追記）、Next.js は末尾の `/` を区別しないので気づけなかった。
- 直し方: `source` を `/ingest/:path(.*)`、`destination` を `https://us.i.posthog.com/:path` にした（PostHog の Vercel 向けの案内と同じ形）。末尾の `/` も含めて転送される。決定 5 の「`vercel.json` の rewrites で転送する」は変えていない。
- 再現テスト: `__tests__/lib/vercel-rewrites.test.ts`。`vercel.json` を読み、Vercel と同じ strict の照合で、`WEB_VITALS_ENDPOINT` が末尾の `/` を保って PostHog に転送されることを確かめる。直す前は失敗した。
- 1 週間分のベースライン（ADR 0011 / 0012 の DoD）の RUM の値は、この修正が本番に出た日から数え直す。

### 2026-09-28: v1.2.1 で本番に届いたことを確かめた

- ブラウザで本番を開き、`POST /ingest/i/v0/e/` が 200 になることを確かめた（開発者ツールの通信）。
- オーナーが PostHog の Activity で `web_vital` を 1 件確かめた（`metric: INP`、`value: 40`、`rating: good`、`device_class: desktop`、`navigation_type: navigate`、`$pathname: /`、`$process_person_profile: false`）。プロパティは決定 3 のとおりで、ファイル名などは含まれていない。
- このとき国は JP と判定されていたが、Vercel の転送も東京（hnd1）を通るので、決定 5 の「国の判定が狂うことがある」が起きないかどうかは、この 1 件では分からない。
- 確かめたブラウザのタブは読み込んだ時点で裏にあったので、`web-vitals` の仕様で LCP と CLS は測られなかった（ページが最初に描かれる前に隠れていると、LCP を報告しない）。実利用のタブでは起きない。
- 残り: 同じページの読み込みの `web_vital` と `files_added` の `distinct_id` が同じか、端末ごとの p75 の Insight（DoD の 4 つ目と 5 つ目）。
