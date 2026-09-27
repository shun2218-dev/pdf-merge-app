# 0017. セキュリティヘッダと CSP

- 状態: 提案
- オーナーの確認: 未
- 日付: 2026-09-27
- 関連: P-3 / B-3、ADR 0002 / 0003 / 0007 / 0011 / 0012 / 0016

## 背景

- セキュリティヘッダを何も返していない（P-3）。
- ADR 0002 で PDF の中身はブラウザの中だけで扱うようになる。そのとき、ページの中で動いた悪意あるスクリプト（依存に紛れ込んだもの、pdfjs の脆弱性（B-3）のようなもの）が、中身を外へ送ることを防ぐ手段が要る。
  **CSP の `connect-src` で送信先を絞れば、「ファイルを外へ送らない」という約束をブラウザにも守らせられる。**
- クリックジャッキング（別サイトの iframe に埋め込まれて操作させられる）への対策もない。

## 決定

1. **ヘッダは `next.config.ts` の `headers()` で全パスに付ける。**

   | ヘッダ | 値 |
   |---|---|
   | `Content-Security-Policy` | 下の決定 2 |
   | `X-Content-Type-Options` | `nosniff` |
   | `Referrer-Policy` | `strict-origin-when-cross-origin` |
   | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
   | `X-Frame-Options` | `DENY`（古いブラウザ向け。新しいブラウザは CSP の `frame-ancestors`） |
   | `X-Robots-Tag` | Preview だけ `noindex`（ADR 0016） |

   HSTS は Vercel が本番のドメインに付けるので、自分では付けない（独自ドメインにしたら見直す）。
2. **CSP の初期の値。**

   ```
   default-src 'self';
   script-src 'self' 'unsafe-inline' <アナリティクスの配信元>;
   style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob:;
   font-src 'self';
   worker-src 'self' blob:;
   connect-src 'self' <アナリティクス・Speed Insights・Sentry の送信先>;
   object-src 'none';
   frame-ancestors 'none';
   base-uri 'self';
   form-action 'self';
   ```

   - 送信先（`connect-src`）は ADR 0007（Sentry）・0011（アナリティクス）・0012（Speed Insights）で決めたものだけを列挙し、ワイルドカードを使わない。新しい送信先を足すときは、この ADR に「追記」してから足す。
   - `script-src` の `'unsafe-inline'` は、Next.js がページに埋め込むスクリプトのため。nonce を使えば外せるが、nonce はページを毎回サーバーで描く（静的に配信できなくなる）ことになり、ADR 0012 の性能と引き換えになる。まず `'unsafe-inline'` で始め、Next.js の SRI（ハッシュ）などで外せるかを実装時に調べて「追記」に書く。
   - PDF のプレビュー（ADR 0003）は blob URL と Worker を使うので、`worker-src` と `img-src` に `blob:` を入れる。
3. **最初は `Content-Security-Policy-Report-Only` で 1 週間出し、違反の報告を見てから本番で強制する。** 報告の送り先は Sentry の CSP レポートのエンドポイントにする（ADR 0007）。
4. **E2E で、ヘッダが付いていることと、主要な流れで CSP の違反が出ないこと（`securitypolicyviolation` のイベントが 0 件）を検査する。**

## 結果

- 良い点: ページの中で何かが動いても、決めた送信先以外へファイルの中身を送れなくなる。ADR 0002 の約束を技術的に裏付けられる。クリックジャッキングを防げる。
- 悪い点: 送信先を足すたびに CSP を直す必要がある（直し忘れると、その機能が本番で黙って動かない）。E2E の違反の検査で気づけるようにする。

## オーナーに確認したいこと

なし。

## 完了条件（DoD）

- [ ] 本番のレスポンスに決定 1 のヘッダがすべて付いている（E2E で検査）
- [ ] Report-Only の期間（1 週間）の違反の報告を確認し、想定外の違反がないことを確かめてから強制にした
- [ ] 主要な流れ（追加・並び替え・プレビュー・結合・ダウンロード）の E2E で CSP の違反が 0 件
- [ ] `connect-src` にワイルドカードがなく、列挙した送信先がすべて ADR に書かれている
- [ ] securityheaders.com か Mozilla Observatory の結果を PR に貼った
- [ ] ロードマップの共通 DoD を満たした

## 追記

（なし）
