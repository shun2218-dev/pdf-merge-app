# Architecture Decision Records

設計判断を 1 件 1 ファイルで記録する。3 ヶ月後の自分が一番の読者。
運用のルールそのものは [ADR 0001](0001-adr-and-dod.md) で決めている。

- **改善・新規追加は、実装を始める前に ADR を起票する。** 振る舞い・見た目・依存・構成・計測のどれかを変えるものはすべて対象。
  例外は「もともと意図していた振る舞いに戻すだけのバグ修正」だけ（再現テストは必須）。
- 状態は `提案 → 採用 → （置き換え済み / 取り下げ）` と進む。**オーナーが確認して「採用」にするまで実装しない。**
- 一度「採用」にした ADR の「決定」は書き換えない。判断を変えるときは新しい ADR を書き、古い方の状態を「置き換え済み（→ NNNN）」にする。
- 実装の途中で確定した詳細は、該当する ADR の「追記」節に日付付きで足す。
- 各 ADR の「完了条件（DoD）」をすべて満たし、チェックを付けてから「完了」とする。DoD には [ロードマップの共通 DoD](../roadmap.md#共通の完了条件dod) も含む。

## 一覧

| # | タイトル | 状態 | フェーズ |
|---|---|---|---|
| [0001](0001-adr-and-dod.md) | 改善は ADR と DoD で進める（運用・Git Flow・共通 DoD） | 採用 | 0 |
| [0002](0002-client-side-merge.md) | PDF の結合をブラウザ内で行い、サーバーへ送らない | 採用 | 3 |
| [0003](0003-pdf-preview-renderer.md) | プレビューを @react-pdf-viewer から最新の pdfjs-dist（react-pdf）へ移す | 採用 | 1（暫定策）/ 3 |
| [0004](0004-dependency-and-codebase-cleanup.md) | 依存とコードベースの整理（未使用の削除・版の固定・型チェックの有効化） | 採用 | 2 |
| [0005](0005-merge-workflow-state.md) | 結合の状態管理を 1 つのフックにまとめ、画面を分割する | 採用 | 2 |
| [0006](0006-ci-quality-gates.md) | CI の品質ゲート（落ちたら赤にする・develop でも走らせる） | 採用 | 1 |
| [0007](0007-error-monitoring-policy.md) | エラー監視（Sentry）の方針：PII を送らず、送るべきものだけ送る | 採用 | 1 |
| [0008](0008-design-tokens-and-theme.md) | デザイントークンの正本・ブランド・ライト / ダークのテーマ | 採用 | 4 |
| [0009](0009-screen-flow-and-feedback.md) | 画面の流れとフィードバック（注意事項・エラー・進捗・ページ情報） | 採用 | 4 |
| [0010](0010-reorder-with-dnd-kit.md) | ファイルの並び替えを dnd-kit にする（タッチ・キーボード対応） | 採用 | 4 |
| [0011](0011-product-analytics.md) | プロダクトのアナリティクス（イベント設計と計測基盤） | 採用 | 1 |
| [0012](0012-performance-budget.md) | パフォーマンスの計測と予算（RUM・Lighthouse CI・バンドル） | 採用 | 1 |
| [0013](0013-i18n.md) | 国際化（next-intl、日本語と英語） | 採用 | 5 |
| [0014](0014-accessibility.md) | アクセシビリティの目標（WCAG 2.2 AA）と検査の自動化 | 採用 | 1（検査）/ 4 |
| [0015](0015-nextjs-16-upgrade.md) | Next.js 16 に上げる | 採用 | 2 |
| [0016](0016-seo-and-metadata.md) | SEO とメタデータ（metadataBase・robots・sitemap・構造化データ） | 採用 | 5 |
| [0017](0017-security-headers.md) | セキュリティヘッダと CSP | 採用 | 3 |
| [0018](0018-cloudflare-waf-in-front-of-vercel.md) | Cloudflare を WAF として Vercel の前に置く（現状の記録と、ほかの ADR との取り決め） | 採用 | 1（設定）/ 5（国のブロックの見直し） |
| [0019](0019-posthog-auto-capture-features.md) | PostHog の自動の収集（ヒートマップ・Web Vitals・デッドクリックなど）を使うか | 採用 | 1（決定）/ 4（試し） |
| [0020](0020-posthog-geoip-country-only.md) | PostHog の位置情報は国だけ残す | 採用 | 1 |
| [0021](0021-web-vitals-to-posthog.md) | 実利用者の Web Vitals は自分で測って、自分のドメイン経由で PostHog に送る | 採用 | 1 |
| [0022](0022-drop-sentry-tracing.md) | Sentry のトレースをやめ、Sentry はエラーの監視だけに使う | 採用 | 2 |
| [0023](0023-performance-budget-from-user-experience.md) | パフォーマンスの予算を、利用者の体験の目標から決める | 採用 | 2 |
| [0024](0024-replace-sentry-replay-with-breadcrumbs.md) | Sentry の Session Replay をやめ、操作のパンくずを自分で残す | 採用 | 2 |
| [0025](0025-ci-lighthouse-reference-device.md) | CI の Lighthouse の基準の端末を固定し、温める回を捨てる | 採用 | 2 |
| [0026](0026-defer-sentry-until-after-load.md) | ブラウザの Sentry を、ページの読み込みのあとに読み込む | 提案 | 2 |

## テンプレート

新しい ADR は次の形で書く。番号は一覧の最後の次。ファイル名は `NNNN-英小文字とハイフン.md`。

```markdown
# NNNN. タイトル（何を決めたかが分かる文にする）

- 状態: 提案
- オーナーの確認: 未
- 日付: YYYY-MM-DD
- 関連: docs/assessment.md の ID / 関係する ADR

## 背景

いまどうなっていて、何が困るのか。根拠（ファイルと行、計測値）を書く。

## 検討した選択肢

| 案 | 良い点 | 悪い点 |
|---|---|---|

## 決定

何をするか。番号付きで、あとから「決定 2」と参照できるようにする。

## 結果

この決定で得るもの・失うもの・あとで困りうること。

## オーナーに確認したいこと

採用の前に決めてほしいこと。なければ「なし」。

## 完了条件（DoD）

- [ ] この ADR に固有の条件（計測できる形で書く）
- [ ] ロードマップの共通 DoD を満たした

## 追記

（実装で確定した詳細を日付付きで足す）
```
