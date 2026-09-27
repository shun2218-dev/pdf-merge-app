# 0001. 改善は ADR と DoD で進める（運用・Git Flow・共通 DoD）

- 状態: 採用
- オーナーの確認: 2026-09-27（「改善や新規追加に関しては必ず ADR を起票し、DoD でチェックする」という要望）
- 日付: 2026-09-27
- 関連: docs/assessment.md 全体 / 参考: shun2218-dev/hibari の `docs/adr/`・`docs/roadmap.md`

## 背景

pdf-merge-app は本番公開済みだが、設計判断がどこにも残っていない。README の説明（Edge Runtime で結合）と実装（Node.js ランタイム）が食い違っているのも、判断と実装を突き合わせる場所がないからである。
これからリファクタリング・デザイン・UI/UX・アナリティクス・パフォーマンス・i18n・a11y とアプリ全体に手を入れるので、次の 3 つを先に決める。

1. 判断をどこに・どの形で残すか
2. 「終わった」をどう判定するか
3. 本番を壊さずに進めるためのブランチ運用

## 決定

### 1. 設計判断は `docs/adr/` に 1 件 1 ファイルで残す

- 形式とテンプレートは `docs/adr/README.md`。hibari と同じく日本語で、「背景・検討した選択肢・決定・結果・オーナーに確認したいこと・完了条件（DoD）・追記」の節を持つ。
- **改善・新規追加は、実装の前に ADR を起票する。** 振る舞い・見た目・依存の追加 / 削除 / メジャー更新・構成・計測のどれかを変えるものが対象。
- ADR が要らないのは「もともと意図していた振る舞いに戻すバグ修正」だけ。その場合も、先に失敗する再現テストを書く。
- 状態が「採用」になるまで実装しない。採用はオーナーが ADR の「オーナーの確認」に日付を入れることで表す。

### 2. 「終わった」は DoD で判定する

- DoD は 3 層にする。
  1. **共通 DoD**（すべての PR）: `docs/roadmap.md` の「共通の完了条件」
  2. **ADR の DoD**: 各 ADR の「完了条件」。その ADR に固有の、計測できる条件
  3. **フェーズの DoD**: `docs/roadmap.md` の各フェーズ。フェーズの ADR がすべて完了し、フェーズの目的を満たしたか
- PR の説明に、該当する DoD をチェックリストとして貼り、満たしたものにチェックを付ける。未達のまま出すときは理由を書く。
- フェーズが終わるたびに `git diff` を読み、フェーズの DoD を確認してから次へ進む。

### 3. 現状の問題は `docs/assessment.md` に ID 付きで残す

- 問題（何が困るか）と判断（どう直すか）を分ける。ADR は「関連」に assessment の ID を書き、問題から ADR へ、ADR から問題へたどれるようにする。
- 新しい問題を見つけたら、ADR より先に assessment に足す。

### 4. Git Flow で運用する

hibari と同じ Git Flow にする。`develop` ブランチはすでにあるので、それを統合先にする。

| ブランチ | 役割 | 作成元 | マージ先 |
|---|---|---|---|
| `main` | 本番（Vercel の Production） | — | — |
| `develop` | 次のリリースの統合先（Vercel の Preview） | `main` | — |
| `feature/<内容>` | 改善・機能追加・ドキュメント | `develop` | `develop` |
| `bugfix/<内容>` | develop 上のバグ修正 | `develop` | `develop` |
| `release/vX.Y.Z` | リリース準備（版の更新だけ） | `develop` | `main` と `develop` |
| `hotfix/<内容>` | 本番の緊急修正 | `main` | `main` と `develop` |

- `main` と `develop` への直接の push は禁止し、PR のマージだけで取り込む（GitHub のブランチ保護で強制する。ADR 0006）。
- `feature/*` / `bugfix/*` → `develop` は squash マージ。`release/*` / `hotfix/*` は マージコミット。
- コミットと PR のタイトルは Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `build` / `ci` / `chore`）。
- PR の説明には「何を・なぜ」「テスト内容」「関連する ADR / フェーズ」「DoD のチェックリスト」を書く。

### 5. 計画の正本は `docs/roadmap.md`

フェーズの順番・各フェーズで扱う ADR・フェーズの DoD はロードマップに書く。ADR には「いつやるか」を書かない（順番が変わっても ADR を書き換えずに済むように）。

## 結果

- 良い点: 「なぜこうなっているか」を後から追える。DoD で完了の基準がぶれない。AI エージェント（Claude Code）に作業を頼むときも、CLAUDE.md から ADR とロードマップをたどらせれば同じ基準で動く。
- 悪い点: 小さな改善でも ADR を書く手間がかかる。小さいものは ADR を短く書いてよい（背景・決定・DoD だけでも可）。

## オーナーに確認したいこと

なし（要望そのものを記録した ADR のため）。

## 完了条件（DoD）

- [x] `docs/adr/README.md`（ルール・一覧・テンプレート）がある
- [x] `docs/assessment.md` に現状の問題が ID 付きで並び、各問題に担当の ADR がある
- [x] `docs/roadmap.md` に共通 DoD とフェーズごとの DoD がある
- [x] `CLAUDE.md` から ADR・ロードマップ・DoD の運用をたどれる
- [x] GitHub のブランチ保護を `main` と `develop` に設定した（ADR 0006 で実施）
- [x] PR テンプレート（`.github/pull_request_template.md`）に DoD のチェックリストを入れた（ADR 0006 で実施）
