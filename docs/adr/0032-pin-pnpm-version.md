# 0032. pnpm の版を package.json の packageManager で 1 つに固定し、CI・Vercel・手元でそろえる

- 状態: 採用
- オーナーの確認: 2026-10-13
- 日付: 2026-10-13
- 関連: ADR 0004 / 0006 / 0015、CLAUDE.md の「開発の注意」

## 背景

2026-10-12 に、#106 の CI の 5 つのジョブ（`lint` / `unit` / `storybook` / `e2e` / `lighthouse`）が、コードを動かす前にすべて落ちた。

- CI は `pnpm/action-setup@v4` に `version: "10"`（`.github/workflows/ci.yml` の `PNPM_VERSION`）を渡していて、そのたびに 10 系の最新を入れる。
- pnpm 10.34.7 が 06:05:15（UTC）に公開され、CI はその 15 秒後に取りに行った。レジストリにまだファイルがなく、`ERR_PNPM_FETCH_404` になった。走らせ直すと通った。

調べると、pnpm の版は 3 か所でばらばらだった（2026-10-13）。

| どこ | どう決まるか | 実際の版 |
|---|---|---|
| CI | `pnpm/action-setup` の `version: "10"`（10 系の最新） | 10.34.7（公開した当日） |
| Vercel（本番・Preview） | `pnpm-lock.yaml` の `lockfileVersion: '9.0'` とプロジェクトの作成日から、Vercel が選ぶ | 10.28.0（v1.4.0 のビルドのログ。「別の版を使うなら `package.json#packageManager` か `devEngines.packageManager` を書け」と出ている） |
| 手元 | `pnpm` は corepack 経由（mise の Node 24）で 12.6.0。CLAUDE.md のとおり `npx -y pnpm@10` を使うと 10 系の最新 | 12.6.0 / 10.34.7 |

困ること:

1. **公開した直後の版を、CI と手元が自動で使う。** 今回のように取れないことがあるうえ、CLAUDE.md の「依存は公開から 1 週間以上たった版にする」（サプライチェーンの対策。Renovate の `minimumReleaseAge: "7 days"`）が、いちばん強い権限で動くツール（pnpm）にだけかかっていない。
2. **CI で通ったものと、本番でビルドするものの pnpm が違う。** lockfile の解釈やビルドのスクリプトの扱い（pnpm 10 の `onlyBuiltDependencies` など）が版で変わると、CI では気づけない。
3. **手元の pnpm 12 で触ると壊れる**（CLAUDE.md の「開発の注意」の 1 つ目）。いまは人の注意で避けている。

作業用のフォルダで、`package.json` に `"packageManager": "pnpm@10.34.6"` を書いて手元の `pnpm`（corepack 経由の 12.6.0）を動かすと、corepack が 10.34.6 を取ってきて、その版で動いた。

### どの系にするか（2026-10-13 に調べた）

10 系は、前のメンテナーの設定を引き継いだもので、選び直したことはなかった。

| 系 | 出た時期 | いまの状況 | Vercel | このプロジェクトで要る変更 |
|---|---|---|---|---|
| 10 | 2025-01 | 修正が続いている（10.34.7 が 2026-10-12） | ドキュメントで対応（6〜10）。`lockfileVersion: 9.0` から自動で 10 を選ぶ | なし |
| 11 | 2026-04 | 11.28.x で落ち着いている | ドキュメントの対応表にない（2026-08-11 の更新）。ビルドのログには「9.x・10.x・11.x のどれかが作った lockfile」と出る | `.npmrc` の pnpm の設定（`optional-dependencies=false`）を `pnpm-workspace.yaml` に移す（CLAUDE.md の「`pnpm-workspace.yaml` ができたら消す」も逆になる）。ビルドのスクリプトの許可を `allowBuilds` に書き直す。Node 22 以上（いまは 24 なので満たす） |
| 12 | 2026-08 | Rust で書き直した。10 月も数日おきに出ていて、実験的な機能が続いている | ドキュメントの対応表にない | `--frozen-lockfile false` の書き方などの変更。挙動の差は試さないと分からない |

11 系には、公開から 1 日たっていない依存を入れない設定（`minimumReleaseAge`）が既定で入るなどの良い点がある。ただ、Vercel が公式に対応しているのは 10 系までで、11 系に上げると設定ファイルの置き場所も変わる。**この ADR では 10 系のまま版を固定し、11 系に上げるかは、Vercel が 11 系を対応表に載せたときか、10 系の修正が止まったときに、別の ADR で決める。** 版を `packageManager` の 1 か所で決めておけば、上げるときも 1 行の変更を CI と Preview で確かめるだけで済む。

## 検討した選択肢

| 案 | 良い点 | 悪い点 |
|---|---|---|
| A. `ci.yml` の `PNPM_VERSION` を `"10.34.6"` のように固定する | 変更が小さい | CI しかそろわない。Vercel（10.28.0）と手元（12）は違うまま。版を上げるのを人が覚えておく必要がある（Renovate は `ci.yml` の `env` の値を上げない） |
| **B. `package.json` に `packageManager: "pnpm@10.34.6+sha512.…"` を書き、CI の `pnpm/action-setup` はそれを読む（`version` を渡さない）** | 版の正本が 1 か所になる。CI・Vercel（ログが案内している）・手元（corepack）がそろう。Renovate が `packageManager` を上げる PR を出し、`minimumReleaseAge` の 7 日もかかる。ハッシュ付きなので、取ってきたファイルがすり替わっていたら止まる | Vercel が `packageManager` をどこまで尊重するかは、ドキュメント（corepack を有効にする環境変数が要るとある）とビルドのログの案内が食い違っていて、Preview のビルドで確かめる必要がある |
| C. `devEngines.packageManager` を使う | npm の新しい標準 | pnpm 10 と `pnpm/action-setup@v4` がどこまで読むか分からない。今回の問題を解くのに新しい仕組みに頼る理由がない |

## 決定

1. **`package.json` に `packageManager` を書き、pnpm の版の正本にする。** 値は、公開から 1 週間以上たった 10 系の最新（いまは `10.34.6`、2026-09-28 公開）に、npm のレジストリの `sha512` のハッシュを付けたもの（`pnpm@10.34.6+sha512.…`）。
2. **CI は `packageManager` を読む。** `ci.yml` の `pnpm/action-setup@v4` から `version` を外し、`PNPM_VERSION` を消す（両方あると action が版の食い違いで止まるため）。
3. **Vercel でも同じ版を使うかを、Preview のビルドのログで確かめる。** ログに `pnpm v10.34.6` と出れば終わり。出なければ、Vercel のプロジェクトの環境変数 `ENABLE_EXPERIMENTAL_COREPACK=1` を足すかをオーナーに相談する（環境変数の設定はオーナーが行う。足さない場合は、Vercel だけ別の版になることを、この ADR の追記に残す）。
4. **10 系のまま、版を上げるのは Renovate に任せる。** `packageManager` は Renovate が上げる対象で、`minimumReleaseAge: "7 days"` がそのままかかる。10 系の中の更新は、ほかのパッチ・マイナーと同じ PR にまとまる。11 系以上へのメジャーの PR が来たら、別の判断にする（いまの `constraints.pnpm: "10.x"` のとおり、lockfile は 10 系で作る）。
5. **CLAUDE.md の「開発の注意」を直す。** 「pnpm は 10 系を使う。迷ったら `npx -y pnpm@10`」を、「`pnpm` は `packageManager` の版で動く（corepack）。`npx -y pnpm@10` は 10 系の最新を使ってしまうので使わない」に改める。

## 結果

- 良い点: 公開した直後の pnpm を CI が使わなくなり、今回の 404 は起きなくなる。サプライチェーンの対策（公開から 1 週間）が pnpm にもかかる。CI・本番・手元の pnpm がそろい、手元の pnpm 12 の落とし穴もなくなる。
- 悪い点: pnpm を上げるには Renovate の PR（または手で `packageManager` を書き換える）が要る。
- あとで困りうること: corepack は Node 25 以降で Node に同梱されなくなる予定。Node を 26 系に上げるとき（ADR 0004 の Node の版の扱い）に、CI・Vercel・手元で corepack をどう入れるかを見直す。

## オーナーに確認したいこと

1. 案 B（`package.json` の `packageManager` を正本にし、CI もそれを読む）でよいか。
2. Vercel が `packageManager` を読まなかった場合に、Vercel のプロジェクトに環境変数 `ENABLE_EXPERIMENTAL_COREPACK=1` を足すか（決定 3。足すときはオーナーが Vercel の画面で行う）。

**オーナーの回答（2026-10-13）**: 案 B でよい。環境変数は、必要なら足す。pnpm の系は、上の比べた結果のとおり 10 系のままにする。

## 完了条件（DoD）

- [ ] `package.json` に、ハッシュ付きの `packageManager`（公開から 1 週間以上たった 10 系）がある
- [ ] `ci.yml` から `PNPM_VERSION` と `pnpm/action-setup` の `version` を消し、CI のすべてのジョブのログで同じ版の pnpm が使われている
- [ ] Vercel の Preview のビルドのログで使われた pnpm の版を確かめ、この ADR の追記に書いた（決定 3）
- [ ] 手元の `pnpm --version`（corepack 経由）が `packageManager` の版になり、`pnpm install` で `pnpm-lock.yaml` が変わらず、`pnpm-workspace.yaml` もできない
- [ ] CLAUDE.md の「開発の注意」を、決定 5 のとおりに直した
- [ ] ロードマップの共通 DoD を満たした

## 追記

（実装で確定した詳細を日付付きで足す）
