# 0018. Cloudflare を WAF として Vercel の前に置く（現状の記録と、ほかの ADR との取り決め）

- 状態: 提案
- オーナーの確認: 未（Cloudflare を WAF として使っていることは確認済み: 2026-09-27）
- 日付: 2026-09-27
- 関連: S-4、ADR 0002 / 0011 / 0012 / 0013 / 0016 / 0017

## 背景

`pdf-merge.app` の DNS は Cloudflare にあり、プロキシ（オレンジの雲）を通して Vercel に届いている（ADR 0016 の追記）。
オーナーに確かめたところ、**Cloudflare を WAF として意図的に使っている**。悪意のあるアクセスや特定の国からのアクセスが多く、ブロックしているため（2026-09-27）。

いまのカスタムルール（4 / 5 件、すべて Block・有効）:

| 順 | 名前 | 条件 |
|---|---|---|
| 1 | High Risk Countries | 国が BY / BR / CN / IR / KP / RU / TR / UA / VN / ID |
| 2 | CMS & Script Scans | パスに `wp-` / `.php` / `composer.json` を含む |
| 3 | Sensitive & Backup Files | パスに `.sql` / `.env` / `.git` / `.log` などを含む |
| 4 | Bad User Agents & HTTP/1.0 | User-Agent が空、HTTP/1.0、User-Agent に `curl` を含む など |

この構成は、これからの ADR のいくつかと関わる。

- ADR 0017（CSP）: Cloudflare の機能の一部（Email Address Obfuscation、Rocket Loader、Cloudflare Web Analytics の自動挿入、Zaraz）は、ページにスクリプトを差し込む。CSP を強制すると、それらが動かなくなるか、違反として報告される。
- ADR 0017（ヘッダ）: HSTS を Cloudflare（`max-age=15552000`）と Vercel（`max-age=63072000; includeSubDomains; preload`）の両方が付けうる。どちらが最終的に出るかが、設定によって変わる。
- ADR 0016 / 0017 の DoD: 「`curl` で確かめる」と書いたが、ルール 4 とボット対策で `curl` は 403 になる。
- ADR 0011 / 0012（計測）: Vercel から見える接続元は Cloudflare になる。Speed Insights は同じドメインへ送るので、国の判定がずれうる。PostHog はブラウザから直接送るので影響を受けない。
- ADR 0013（英語版）: ルール 1 は、ブラジル・インドネシア・トルコ・ベトナム・ウクライナなど、利用者の多い国を含む。英語版で海外の利用者に届けることと、国ごとのブロックは衝突しうる。
- ADR 0002（ブラウザ内で結合）: API がなくなると、サーバーで重い処理をさせる攻撃の対象がなくなる。静的なページとファイルだけになるので、ルール 1 の必要性が下がる。ルール 2〜4 は、もともと存在しないパスへのアクセスや機械的なアクセスを止めるだけなので、残しても利用者への影響はほとんどない。

## 決定

1. **Cloudflare のプロキシは外さない。** WAF の役目は Cloudflare に任せ、Vercel の Firewall は重ねて使わない。SSL/TLS のモードは「Full (strict)」にする。
2. **ページにスクリプトを差し込む Cloudflare の機能は使わない。** Email Address Obfuscation、Rocket Loader、Cloudflare Web Analytics の自動挿入、Zaraz を無効にする。ページに入るスクリプトは、すべてこのリポジトリのコードから出るようにする（ADR 0017 の CSP を守れるように）。
   Bot Fight Mode などのチャレンジの画面は、Cloudflare が自分で返すページなので、この決定の対象外。
3. **セキュリティヘッダはアプリ側（`next.config.ts`。ADR 0017）で付け、Cloudflare の Transform Rules では付けない。** HSTS だけは例外で、Cloudflare の設定を正とする。Cloudflare の HSTS を `max-age=63072000; includeSubDomains; preload` に揃え、アプリでは付けない。
4. **本番の応答の検査は、ブラウザの User-Agent で行う。** ADR 0016 / 0017 の DoD の「`curl` で確かめる」は、ブラウザの User-Agent を付けた `curl` か Playwright で行う。Cloudflare を通らない検査（Vercel の Preview の URL に対する E2E）と、通る検査（本番のドメイン）を分けて考える。
5. **国ごとのブロック（ルール 1）は、ADR 0002 と 0013 を本番に出したあと（Phase 5 の終わり）に見直す。** 見直すときの材料は次のとおり。
   - Cloudflare の Security Events で、ルール 1 がブロックしたリクエストのうち、ページの閲覧（`/`・`/en`）がどれだけあるか
   - API がなくなったあと、ルール 1 が守っているものが何か
   - 候補: ルール 1 を外す / Block を Managed Challenge に変える / 国を絞る
   それまではルール 1 をいまのまま残す。
6. **WAF のルールを変えたら、この ADR の「追記」に日付と内容を書く。** Cloudflare のダッシュボードの設定は、コードのように履歴が残らないため。

## 結果

- 良い点: WAF の現状と理由が記録に残る。CSP・ヘッダ・計測と WAF の設定が食い違わなくなる。
- 悪い点: Cloudflare とアプリの 2 箇所に設定があるので、変更するときに両方を見る必要がある（決定 3 と 6 で置き場所を分けて和らげる）。国ごとのブロックを残している間は、ブロックされた国の利用者を取りこぼす。

## オーナーに確認したいこと

1. 決定 2 の機能（Email Address Obfuscation・Rocket Loader・Web Analytics の自動挿入・Zaraz）を無効にしてよいか。すでに無効ならその旨。
2. 決定 5 のとおり、国ごとのブロックを Phase 5 の終わりに見直すことでよいか。
3. 5 件目のカスタムルールの枠を、いまは何に使う予定か（なければ空けておく）。

## 完了条件（DoD）

- [ ] 決定 2 の機能がすべて無効になっている（Cloudflare のダッシュボードのスクリーンショットを追記に貼る）
- [ ] SSL/TLS のモードが Full (strict)
- [ ] 本番の HSTS のヘッダが 1 つだけで、値が決定 3 のとおり（ブラウザの User-Agent で確認）
- [ ] 本番のページの HTML に、このリポジトリ由来ではないスクリプトがない
- [ ] （Phase 5 の終わり）国ごとのブロックを見直し、結論を追記に書いた
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
