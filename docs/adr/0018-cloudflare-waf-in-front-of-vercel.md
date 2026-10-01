# 0018. Cloudflare を WAF として Vercel の前に置く（現状の記録と、ほかの ADR との取り決め）

- 状態: 採用
- オーナーの確認: 2026-09-27
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

- ADR 0017（CSP）: Cloudflare の機能の一部は、Vercel から返った HTML を書き換えてスクリプトを差し込む。CSP を強制すると、それらが動かなくなるか、違反として報告される。
  2026-09-27 に本番の HTML を確かめたところ、差し込まれていたのは **Bot Fight Mode の JavaScript Detections**（インラインのスクリプトと `/cdn-cgi/challenge-platform/scripts/jsd/main.js`）だけだった。
  Rocket Loader・Cloudflare Web Analytics・Zaraz の痕跡はなかった。Email Address Obfuscation は、ページにメールアドレスがないので有効かどうかを HTML からは判断できない。
- ADR 0017（ヘッダ）: HSTS を Cloudflare（`max-age=15552000`）と Vercel（`max-age=63072000; includeSubDomains; preload`）の両方が付けうる。どちらが最終的に出るかが、設定によって変わる。
- ADR 0016 / 0017 の DoD: 「`curl` で確かめる」と書いたが、ルール 4 とボット対策で `curl` は 403 になる。
- ADR 0011 / 0012（計測）: Vercel から見える接続元は Cloudflare になる。Speed Insights は同じドメインへ送るので、国の判定がずれうる。PostHog はブラウザから直接送るので影響を受けない。
- ADR 0013（英語版）: ルール 1 は、ブラジル・インドネシア・トルコ・ベトナム・ウクライナなど、利用者の多い国を含む。英語版で海外の利用者に届けることと、国ごとのブロックは衝突しうる。
- ADR 0002（ブラウザ内で結合）: API がなくなると、サーバーで重い処理をさせる攻撃の対象がなくなる。静的なページとファイルだけになるので、ルール 1 の必要性が下がる。ルール 2〜4 は、もともと存在しないパスへのアクセスや機械的なアクセスを止めるだけなので、残しても利用者への影響はほとんどない。

## 決定

1. **Cloudflare のプロキシは外さない。** WAF の役目は Cloudflare に任せ、Vercel の Firewall は重ねて使わない。SSL/TLS のモードは「Full (strict)」にする。
2. **ページにスクリプトを差し込む Cloudflare の機能は、Bot Fight Mode の JavaScript Detections だけを残し、ほかは使わない。**
   - 使わない: Email Address Obfuscation（メールアドレスを隠す。`email-decode.min.js` を差し込む）、Rocket Loader（スクリプトの読み込みを書き換えて遅らせる。Next.js の hydration を壊しうる）、Cloudflare Web Analytics の自動設定（`static.cloudflareinsights.com` のビーコンを差し込む。PostHog と Speed Insights と重複する）、Zaraz（第三者のタグを差し込む）。
   - 残す: Bot Fight Mode の JavaScript Detections。ボット対策そのものなので外さない。読み込むファイルは同じオリジン（`/cdn-cgi/`）なので CSP の `'self'` で許され、インラインの部分は ADR 0017 の `'unsafe-inline'` で許される。ADR 0017 で nonce の CSP に移すときは、このインラインのスクリプトが動くかを本番で確かめる（Preview の URL は Cloudflare を通らないので、そこでは確かめられない）。
3. **セキュリティヘッダはアプリ側（`next.config.ts`。ADR 0017）で付け、Cloudflare の Transform Rules では付けない。** HSTS だけは例外で、Cloudflare の設定を正とする。Cloudflare の HSTS を `max-age=63072000; includeSubDomains; preload` に揃え、アプリでは付けない。
4. **本番の応答の検査は、ブラウザの User-Agent で行う。** ADR 0016 / 0017 の DoD の「`curl` で確かめる」は、ブラウザの User-Agent を付けた `curl` か Playwright で行う。Cloudflare を通らない検査（Vercel の Preview の URL に対する E2E）と、通る検査（本番のドメイン）を分けて考える。
5. **国ごとのブロック（ルール 1）は、ADR 0002 と 0013 を本番に出したあと（Phase 5 の終わり）に見直す。** それまではルール 1 をいまのまま残す（API がある間は、ブロックする理由があるため）。見直しは次の手順で行う。
   1. **ブロックの中身を見る。** Security Events をルール 1 で絞り、直近 30 日の件数を国・パス・User-Agent で分ける。ブロックされたのが `wp-` や `.env` などのスキャンばかりか、`/`・`/en` のようなページの閲覧が混ざっているかを見る。
   2. **ルール 1 の動作を Block から Managed Challenge に変えて 2 週間おく。** Managed Challenge は、人には確認の画面（たいていは自動で通る）を出し、ボットは止める。カスタムルールの一覧の「CSR」（Challenge Solve Rate: チャレンジを通過した割合）の列に数字が出る。
      - ルール 2〜4 はそのまま Block にしておくので、スキャンや怪しい User-Agent は国に関係なく止まり続ける。
   3. **CSR で決める。**
      | CSR | 意味 | 結論 |
      |---|---|---|
      | ほぼ 0% | 来ているのは、チャレンジを通れない機械のアクセスだけ | Block に戻す |
      | 数 % 以上 | チャレンジを通る人間が来ている | Managed Challenge のまま残すか、ルール 1 を外す。外すかどうかは、その期間に攻撃が増えたか（Security Events の総数、Vercel の転送量）で判断する |
   4. 結論と、その根拠の数字を「追記」に書く（決定 6）。
6. **WAF のルールを変えたら、この ADR の「追記」に日付と内容を書く。** Cloudflare のダッシュボードの設定は、コードのように履歴が残らないため。

## 結果

- 良い点: WAF の現状と理由が記録に残る。CSP・ヘッダ・計測と WAF の設定が食い違わなくなる。
- 悪い点: Cloudflare とアプリの 2 箇所に設定があるので、変更するときに両方を見る必要がある（決定 3 と 6 で置き場所を分けて和らげる）。国ごとのブロックを残している間は、ブロックされた国の利用者を取りこぼす。

## オーナーに確認したいこと

1. ~~決定 2 の「使わない」4 つを無効にしてよいか~~ → Email Address Obfuscation はオーナーが Off にした（2026-09-27）。Rocket Loader・Web Analytics・Zaraz は HTML の上では無効と見られる。
2. 決定 5 のとおり、国ごとのブロックを Phase 5 の終わりに見直すことでよいか。
3. ~~5 件目のカスタムルールの枠の予定~~ → 特になし（オーナーの回答 2026-09-27）。空けておく。

## 完了条件（DoD）

- [x] 決定 2 の「使わない」4 つがすべて無効になっている（Cloudflare のダッシュボードのスクリーンショットを追記に貼る）（2026-10-02）
- [x] SSL/TLS のモードが Full (strict)
- [x] 本番の HSTS のヘッダが 1 つだけで、値が決定 3 のとおり（ブラウザの User-Agent で確認。値は 2026-09-27 の追記で改めたもの）
- [x] 本番のページの HTML に、このリポジトリ由来ではないスクリプトが、Bot Fight Mode の JavaScript Detections 以外にない（2026-09-28。ブラウザと `Accept: text/html` 付きの `curl` で確認）
- [ ] （Phase 5 の終わり）国ごとのブロックを見直し、結論を追記に書いた
- [ ] ロードマップの共通 DoD を満たした

## 追記

### 2026-09-27: Email Address Obfuscation を Off にした

- オーナーが Cloudflare の Security → Settings で Email Address Obfuscation を Off にした（既定では On）。
- 本番の HTML に `email-decode.min.js` がないことを確かめた（ページにメールアドレスがないため、Off にする前から差し込まれてはいなかった）。
- 将来 `/about` に連絡先を載せるときは、メールアドレスではなく GitHub の Issues へのリンクにする。

### 2026-09-27: 決定 3 の HSTS の値を改める

決定 3 は「Cloudflare の HSTS を `max-age=63072000; includeSubDomains; preload` に揃える」としていたが、これは Vercel が出していた値を写しただけで、次の 2 点を確かめていなかった（オーナーの Cloudflare の画面で判明）。

1. **Cloudflare の HSTS の `max-age` は最長 12 か月**で、2 年は選べない。
2. **`.app` の TLD は、丸ごとブラウザの HSTS preload リストに入っている。** 主要なブラウザは `*.app` を最初から HTTPS でしか開かないので、自分のドメインに `preload` を付けて preload リストに登録しても、何も変わらない。

そこで値を次のように改めた。「Cloudflare の設定を HSTS の正にし、アプリでは付けない」という決定 3 の判断そのものは変えていないので、新しい ADR ではなくこの追記で直した（オーナーの判断: 2026-09-27）。

| 項目 | 値 | 理由 |
|---|---|---|
| `max-age` | 31536000（12 か月） | Cloudflare で選べる最長。1 年は HSTS で一般に推奨される長さ |
| `includeSubDomains` | 付ける | サブドメインは `www` だけで、HTTPS で `pdf-merge.app` へ転送している。`.app` はもともと全サブドメインが HTTPS 専用 |
| `preload` | 付けない | 上の 2 のとおり意味がない |

- オーナーが Cloudflare で上の値に保存し、本番の応答が `strict-transport-security: max-age=31536000; includeSubDomains` になったことを確かめた（2026-09-27）。Vercel の HSTS は Cloudflare の値で置き換えられ、ヘッダは 1 つだけ。
- 同じ画面の No-Sniff Header（`X-Content-Type-Options: nosniff`）は On。

### 2026-09-27: SSL/TLS を Full (strict) にした

- オーナーが SSL/TLS のモードを Full (strict) に変えた（それまでは Full (strict) ではなかった）。Cloudflare が Vercel の証明書を検証するようになった。
- その結果、Vercel の期限切れのワイルドカード証明書（`*.pdf-merge.app`）を使っていた `www` が 526 になった。Cloudflare の Redirect Rule で `www` を `pdf-merge.app` に 301 で転送して直した（ADR 0016 の追記、S-5）。
- 同日の時点で使っている Cloudflare のルール: カスタムルール 4 件（WAF）、Redirect Rule 1 件（`www` → `pdf-merge.app`）。
- 教訓: Full (strict) に変えるなど、証明書の検証を強める変更の前に、すべてのホスト名（サブドメインを含む）で接続先の証明書が有効かを確かめる（`openssl s_client -connect <Vercel の IP>:443 -servername <ホスト名>`）。決定 3 では HSTS 以外のヘッダはアプリで付けるので、ADR 0017 でアプリから付けるときに、Cloudflare 側を Off にするか二重のままにするかを決める（同じヘッダが 2 つあっても害はない）。

### 2026-09-28: Cloudflare Web Analytics のビーコンが差し込まれていた（P-5）

- 2026-09-27 の「Rocket Loader・Web Analytics・Zaraz は HTML の上では無効と見られる」は誤りだった。確認に使った `curl` は `Accept: text/html` を付けておらず、Cloudflare はその応答にはビーコンを差し込んでいなかった。
- ブラウザで本番を開くと（`curl` でも `Accept: text/html` を付けると）、HTML の末尾に `static.cloudflareinsights.com/beacon.min.js` が差し込まれ、`/cdn-cgi/rum` への送信が 2 回ある（読み込み時と離脱時）。決定 2 で「使わない」とした Cloudflare Web Analytics の自動設定が有効になっている。
- オーナーに、Cloudflare のダッシュボードの Web Analytics（または Speed → Observatory の RUM）で、`pdf-merge.app` の自動の差し込みを Off にしてもらう。Off にしたあと、`Accept: text/html` を付けた `curl` とブラウザの両方で、ビーコンがないことを確かめて、ここに追記する。
- 教訓: Cloudflare が HTML を書き換えるかの確認は、ブラウザと同じ `Accept` を付けた `curl` か、ブラウザそのもので行う。
- オーナーが Cloudflare の設定で自動の差し込みを Off にした（2026-09-28）。そのあと、`Accept: text/html` を付けた `curl`（3 回）とブラウザの両方で、ビーコンの読み込みと `/cdn-cgi/rum` への送信がないことを確かめた。差し込まれているのは Bot Fight Mode の JavaScript Detections だけで、Email Address Obfuscation と Rocket Loader の痕跡もない。

### 2026-10-02: 決定 2 の「使わない」4 つが無効になっていることを、ダッシュボードで確かめた

オーナーが Cloudflare のダッシュボード（`pdf-merge.app` のゾーン、Free プラン）のスクリーンショットを撮った。

| 機能 | 場所 | 状態 | 画像 |
|---|---|---|---|
| Email Address Obfuscation | Security → Settings の「Client side abuse」 | Off | [画像](assets/0018/2026-10-02-email-address-obfuscation-off.webp) |
| Rocket Loader | Speed → Settings → Content Optimization | Off | [画像](assets/0018/2026-10-02-rocket-loader-off.webp) |
| Cloudflare Web Analytics の自動の差し込み | Delivery & performance → Analytics → Web Analytics | 「RUM is currently disabled for this zone.」 | [画像](assets/0018/2026-10-02-web-analytics-rum-disabled.webp) |
| Zaraz | Web tag management → Tag setup | ツールが 1 つも設定されていない（始めの画面） | [画像](assets/0018/2026-10-02-zaraz-no-tools.webp) |

- 同じ日に、本番の HTML をブラウザの User-Agent と `Accept: text/html` を付けた `curl` で取り、Zaraz・Rocket Loader・Email Address Obfuscation・Web Analytics の差し込みが 0 件で、差し込まれているのは Bot Fight Mode の JavaScript Detections（`/cdn-cgi/challenge-platform`）の 1 件だけであることを確かめた（決定 2 の「残す」）。
- Security → Settings の同じ画面の Continuous script monitoring と Hotlink Protection も Off だった（決定 2 の対象外）。
- Cloudflare のダッシュボードは、2026-09 時点のドキュメントと場所の名前が少し違った（Web Analytics がゾーンの「Delivery & performance → Analytics」の下にある、など）。次に確かめるときは、ダッシュボードの検索で機能の名前を探す。

