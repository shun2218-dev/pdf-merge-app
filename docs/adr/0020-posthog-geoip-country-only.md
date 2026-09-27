# 0020. PostHog の位置情報は国だけ残す

- 状態: 採用
- オーナーの確認: 2026-09-27
- 日付: 2026-09-27
- 関連: ADR 0011 / 0013 / 0018 / 0019

## 背景

v1.1.0 を出したあと、本番のイベント（`files_added`）のプロパティをオーナーが確かめたところ、アプリが送った 3 つ（`count_bucket` / `size_bucket` / `source`）のほかに、PostHog が付けた細かい位置情報があった（2026-09-27）。

- 市区町村（`$geoip_city_name`）、郵便番号（`$geoip_postal_code`）、緯度・経度（`$geoip_latitude` / `$geoip_longitude`、精度の半径 10km）、都道府県（`$geoip_subdivision_1_*`）

PostHog の「Discard client IP data」は IP アドレスそのものを保存しない設定で、IP から位置を推定する GeoIP の変換は、その前に PostHog の中で行われる。そのため、推定した位置は残る。
ADR 0011 の「送らないもの」は IP アドレスだけを挙げていて、そこから導かれる位置情報の細かさは検討していなかった。

### 必要かどうか

| 位置情報 | 使い道 | 判断 |
|---|---|---|
| 国（`$geoip_country_*`） | ADR 0013 決定 1「ほかの言語を足すかを国の分布で決める」。国ごとの完了率 | 残す |
| 大陸（`$geoip_continent_*`）・タイムゾーン（`$geoip_time_zone`） | 国より粗い | 残す（捨てる理由がない） |
| 都道府県・市区町村・郵便番号・緯度経度・精度の半径 | KPI にも ADR の判断にも使わない。端末の情報（ブラウザ・OS・画面の大きさ）と組み合わせると、人を絞り込む手がかりになりうる | 捨てる |

## 検討した選択肢

| 案 | 良い点 | 悪い点 |
|---|---|---|
| **A. GeoIP の変換のあとに Property Filter の変換を置き、国より細かいものを捨てる** | 国が残る。コードの変更が要らない | PostHog の管理画面の設定なので、コードのように履歴が残らない（この ADR に書いて補う） |
| B. イベントに `$geoip_disable: true` を付け、位置情報をまったく付けない | コードだけで確実 | 国も残らない。国の分布は Vercel Web Analytics で見るしかない |
| C. 今のまま | — | 使わない細かい位置情報を持ち続ける |

## 決定

**A を採る（オーナーの判断: 2026-09-27）。**

1. PostHog の Data pipelines → Transformations に **Property Filter** の変換を作り、**GeoIP の変換より後**に置く（変換は並んだ順に実行される）。
2. 捨てるプロパティは次のとおり（カンマで区切り、空白を入れない）。

   ```
   $geoip_city_name,$geoip_postal_code,$geoip_latitude,$geoip_longitude,$geoip_accuracy_radius,$geoip_subdivision_1_code,$geoip_subdivision_1_name,$geoip_subdivision_2_code,$geoip_subdivision_2_name,$geoip_subdivision_3_code,$geoip_subdivision_3_name
   ```

3. 人物のプロパティ（`$set` / `$set_once` で付く `$geoip_*` / `$initial_geoip_*`）は、ADR 0011 の `person_profiles: "identified_only"` と、`identify` を呼ばない作りによって、そもそも作られない。この前提を変えるとき（`identify` を使うなど）は、この ADR を見直す。
4. すでに保存されたイベント（v1.1.0 を出してからの確認のアクセス）の細かい位置情報は、件数がわずかで、オーナー自身の確認のアクセスなので消さない。
5. `docs/analytics.md` の「送らないもの」に、国より細かい位置情報を加える。

## 結果

- 良い点: 国の分布は残り、使わない細かい位置情報を持たなくなる。
- 悪い点: 管理画面の設定なので、PostHog のプロジェクトを作り直したら設定し直す必要がある（この ADR が手順になる）。

## オーナーに確認したいこと

なし。

## 完了条件（DoD）

- [ ] PostHog に Property Filter の変換があり、GeoIP の変換より後に並んでいる
- [ ] 設定後の新しいイベントに、決定 2 のプロパティがなく、`$geoip_country_code` が残っている
- [ ] `docs/analytics.md` の「送らないもの」を更新した
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
