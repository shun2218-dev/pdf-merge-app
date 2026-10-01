# pdf-merge-app

ブラウザで複数の PDF を 1 つに結合する Web アプリ。Next.js（App Router）で作り、Vercel で本番公開している（https://pdf-merge.app/）。

## 進め方の正本

| ファイル | 役割 |
|---|---|
| `docs/roadmap.md` | フェーズの順番・共通の完了条件（DoD）・フェーズごとの DoD |
| `docs/adr/` | 設計判断の記録。ルールとテンプレートは `docs/adr/README.md` |
| `docs/assessment.md` | 現状の問題の一覧（ID 付き）。ADR はここの ID を参照する |
| `docs/ui/` | 見た目の正本（Phase 4 で作成。ADR 0008） |
| `docs/analytics.md` | アナリティクスのイベントと KPI の正本（Phase 1 で作成。ADR 0011） |
| `docs/performance.md` | パフォーマンスのベースラインと予算（Phase 1 で作成。ADR 0012） |

これらと矛盾する実装をしない。設計を変えたくなったら、**実装する前に**指摘してオーナーの確認を取る。

## ADR と DoD の運用（ADR 0001）

- **改善・新規追加は、実装を始める前に ADR を起票する。** 振る舞い・見た目・依存・構成・計測のどれかを変えるものはすべて対象。
  例外は「もともと意図していた振る舞いに戻すバグ修正」だけで、その場合も先に失敗する再現テストを書く。
- ADR の状態が「採用」（オーナーの確認の日付が入っている）になるまで、その ADR の実装をしない。
- 採用した ADR の「決定」は書き換えない。変えるときは新しい ADR を書き、古い方を「置き換え済み（→ NNNN）」にする。実装で決まった詳細は「追記」に日付付きで足す。
- 作業を終える前に、**共通 DoD（`docs/roadmap.md`）・ADR の DoD・フェーズの DoD** を確かめ、満たしたものにチェックを付ける。満たせないものは理由を書く。
- 現在のフェーズの範囲外のものを先回りして作らない。

## 技術スタック

- Next.js（App Router）/ React 19 / TypeScript（strict）
- スタイル: Tailwind CSS v4 + shadcn/ui（new-york）。トークンの正本は CSS 変数（ADR 0008）
- PDF: `pdf-lib`（結合）、`pdfjs-dist`（描画。ADR 0003 で `react-pdf` に移行予定）
- テスト: Vitest（`unit` と `storybook` の 2 プロジェクト）/ Testing Library / Storybook 10 / Playwright
- lint / format: Biome
- 監視: Sentry、Vercel Web Analytics
- パッケージ管理: pnpm（Node は `package.json` の `volta` の版）

## コマンド

```
pnpm dev              # 開発サーバー
pnpm check            # biome の lint と format（書き換えあり）
pnpm test:unit        # Vitest（unit + storybook）
pnpm test:e2e         # Playwright（事前に pnpm build）
pnpm storybook        # Storybook
```

## 開発の注意（これまでにはまったこと）

- **pnpm は 10 系を使う**（CI は `pnpm/action-setup` の version 10）。ローカルに pnpm 12 などが入っていると、`node_modules` の置き場所が食い違ったり、`pnpm-workspace.yaml` が勝手に作られたりする。迷ったら `npx -y pnpm@10 <コマンド>` を使い、`pnpm-workspace.yaml` ができたら消す。
- **依存を足すときは、公開から 1 週間以上たった版にする**（pnpm の `minimumReleaseAge` の考え方。サプライチェーン対策）。
- ファイルを動かしたり import を変えたりしたら、最後に必ず `biome ci .` と `pnpm typecheck` をかけ直す。
- 本番の確認で `curl` を使うときは、ブラウザの User-Agent を付ける（Cloudflare の WAF が `curl` を止める。ADR 0018）。Cloudflare が HTML にスクリプトを差し込むかを見るときは `Accept: text/html` も付けるか、ブラウザで確かめる（付けないと差し込まれない応答が返る。ADR 0018 の追記）。
- `vercel.json` の rewrites の `source` は、Vercel では末尾の `/` を区別して照合される（`next.config` の rewrites とは違う）。`:path*` は末尾が `/` のパスに当たらない（B-9）。変えたら `__tests__/lib/vercel-rewrites.test.ts` に足す。
- ローカルの E2E: ポート 3000 をほかのプロジェクトが使っていると、Playwright はそのサーバーを使ってしまう（`reuseExistingServer`）。また、ローカルの既定の reporter（`html`）は失敗するとレポートのサーバーを開いて待ち続ける。別のポートと `--reporter=line` の設定を、リポジトリの外（scratchpad など。`{"type":"module"}` の `package.json` を横に置く）に作って走らせる。
- 依存の一部だけを別の版にするときに `pnpm update --depth Infinity` を使わない（関係のない依存まで解決し直される）。新しく足す依存に 1 週間の条件をかけるなら `pnpm install --config.minimum-release-age=10080`（ADR 0004 の追記）。
- 手元の `pnpm build` は、`.env` の `SENTRY_AUTH_TOKEN` で本物の Sentry にソースマップを送る（B-10 を直したあと）。確認のためのビルドなどで送りたくないときは `SENTRY_AUTH_TOKEN= pnpm build` のように空にして走らせる。
- **外部のサービスの機能を使う・勧める前に、その機能が必要か、何を送るか、いまのプランで何が使えるかを確かめる。** ヒートマップ（ADR 0019）・HSTS の値（ADR 0018 の追記）・Speed Insights の Hobby の制限（ADR 0021）で、確かめずに決めて直すことになった。

## 守ること

- **PDF の中身・ファイル名を、アナリティクス・Sentry・ログに送らない**（ADR 0007 / 0011）。
- テストのない実装をコミットしない。バグ修正は、先に失敗する再現テストを書く。
- コンポーネントに色・余白・サイズの値や Tailwind の任意値（`h-[800px]` など）を直書きしない（ADR 0008 の実装後）。
- `alert()` を使わない。エラーは状態として持ち、画面に出す（ADR 0005 / 0009）。
- biome の a11y のルールを `biome-ignore` で抑止しない（ADR 0014）。
- 依存を `"latest"` で追加しない（ADR 0004）。

## Git 運用（Git Flow。ADR 0001 決定 4）

- `main`（本番）と `develop`（統合先）に直接コミット・push しない。取り込みは PR のマージだけ。
- 作業は `develop` の最新から `feature/<内容>` / `bugfix/<内容>` を切る。本番の緊急修正は `main` から `hotfix/<内容>`。
- `feature/*` / `bugfix/*` → `develop` は squash マージ。`release/*` / `hotfix/*` → `main` と `develop` はマージコミット。
- コミットと PR のタイトルは Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `build` / `ci` / `chore`）。要約は日本語で可。
- PR の説明に「何を・なぜ」「テスト内容」「関連する ADR / フェーズ」「DoD のチェックリスト」を書く。
