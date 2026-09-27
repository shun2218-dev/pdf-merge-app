# 0006. CI の品質ゲート（落ちたら赤にする・develop でも走らせる）

- 状態: 提案
- オーナーの確認: 未
- 日付: 2026-09-27
- 関連: C-1 / Q-1 / Q-2 / Q-3、ADR 0001 / 0004 / 0012 / 0014

## 背景

- **ユニットテストも E2E も `continue-on-error: true` で、落ちても CI が緑になる（Q-1）。** PR にコメントは付くが、マージは止まらない。
- CI が走るのは `main` 向けの PR だけで、`develop` 向けの PR では何も走らない（Q-2）。ADR 0001 の Git Flow では、日々の PR はすべて `develop` 向けになる。
- biome の lint と型チェックを CI で実行していない（Q-3）。`ignoreBuildErrors` もあり（C-1）、型エラーが本番まで素通りする。
- E2E は 5 つのブラウザ（Chromium / Firefox / WebKit / Pixel 5 / iPhone 15）を毎回すべて回し、ワーカーは 1。遅いので結果を待たなくなりがち。

## 決定

1. **`continue-on-error` をやめ、テストが落ちたらジョブを失敗にする。** PR へのコメント（結果とカバレッジ）は残し、`if: always()` で失敗時にも付ける。
2. **`main` と `develop` 向けの PR、および両ブランチへの push で走らせる。**
3. **ワークフローを 1 つ（`ci.yml`）にまとめ、ジョブを分けて並列に走らせる。**

   | ジョブ | 内容 | 必須 |
   |---|---|---|
   | `lint` | `biome ci .`、`pnpm typecheck`、`pnpm knip`（ADR 0004） | ○ |
   | `unit` | Vitest の `unit` プロジェクト＋カバレッジ | ○ |
   | `storybook` | Vitest の `storybook` プロジェクト（a11y の違反で落とす。ADR 0014） | ○ |
   | `e2e` | Playwright。PR では Chromium と Mobile Safari（WebKit）の 2 つ、`develop` / `main` への push では 5 つすべて | ○ |
   | `lighthouse` | Lighthouse CI（予算を超えたら失敗。ADR 0012） | ○（ADR 0012 の完了後） |
   | `i18n` | 日本語と英語のキーの集合が一致するか（ADR 0013） | ○（ADR 0013 の完了後） |

4. **GitHub のブランチ保護を `main` と `develop` に設定する。** PR 必須・上の必須ジョブがすべて成功・直接の push 禁止・`main` は管理者も例外にしない。
5. **PR テンプレート（`.github/pull_request_template.md`）を置く。** 「何を・なぜ」「テスト内容」「関連する ADR / フェーズ」と、ロードマップの共通 DoD のチェックリストを入れる（ADR 0001 決定 2）。
6. **カバレッジのしきい値を設ける。** いまの値を測ってそれを下限にし（下げない）、`lib/` は 90% を目標にする。しきい値は `vitest.config.ts` の `coverage.thresholds` に書く。
7. Vercel の Preview デプロイの URL に対しても E2E を走らせるかは、ADR 0002 の完了後に検討する（いまは CI 内で `next start` した環境だけ）。

## 結果

- 良い点: 壊れたものが `develop` にも `main` にも入らなくなる。レビューで「テストは通っているか」を気にしなくてよくなる。
- 悪い点: いま落ちているテストがあれば、この ADR の実装時に直す必要がある。PR の E2E を 2 ブラウザに減らすので、Firefox 固有の問題は `develop` への push 時に見つかる（PR では見つからない）。

## オーナーに確認したいこと

1. PR の E2E を 2 ブラウザに絞ってよいか。
2. ブランチ保護の「管理者も例外にしない」でよいか（個人リポジトリなので、緊急時に自分で外すことはできる）。

## 完了条件（DoD）

- [ ] わざとテストを 1 つ落とした PR で、CI が赤になりマージできないことを確かめた（確かめたら戻す）
- [ ] `develop` 向けの PR で CI が走る
- [ ] lint / typecheck / unit / storybook / e2e がジョブとして分かれ、必須チェックに登録されている
- [ ] `main` と `develop` のブランチ保護が有効（Settings のスクリーンショットか `gh api` の結果を PR に貼る）
- [ ] PR テンプレートに共通 DoD のチェックリストがある
- [ ] カバレッジのしきい値が `vitest.config.ts` に書かれている
- [ ] PR 時の CI の所要時間が 10 分以内
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
