# PDF Merge App

ブラウザ上で複数のPDFファイルを簡単に結合できるWebアプリケーションです。ドラッグ＆ドロップによる直感的な操作で、ファイルのアップロードや並び替えが可能です。

**デモURL:** <https://pdf-merge.app/>

## 概要

このプロジェクトは、Next.js 16 (App Router) と `pdf-lib` ライブラリを使用して構築したPDF結合ツールです。PDFはブラウザの中（Web Worker）で結合し、端末の外へ送りません。

## 主な機能

* **ドラッグ＆ドロップによるファイルアップロード:**
  * `.pdf` ファイルのみを受け付けるフィルタリング機能
  * Sentry と連携したエラーハンドリング
* **ファイルの並び替え:**
  * アップロードしたファイルをドラッグ＆ドロップで直感的に並び替え可能
* **リアルタイムプレビュー:**
  * 結合後のPDFをブラウザの中で生成し、`@react-pdf-viewer` でプレビュー表示（ビューアの置き換えは `docs/adr/0003-pdf-preview-renderer.md`）
* **読めないファイルの扱い:**
  * パスワード付きのPDF・壊れたPDFは結合から外し、名前と理由を表示して残りで結合
* **ファイルのダウンロード:**
  * 結合されたPDFを `merged.pdf` としてダウンロード

## アーキテクチャと技術スタック

### ブラウザの中でのPDF処理

PDFの結合は、利用者のブラウザの中（Web Worker）で行う。PDFの中身をサーバーへ送らない（`docs/adr/0002-client-side-merge.md`）。

* **結合:** `lib/pdf/merge.ts` の純粋な関数が、`pdf-lib` で 1 ファイルずつ読み、並び順どおりにページをコピーして結合する。パスワード付きのPDFと読み込めないファイル（先頭に `%PDF-` がないものを含む）は飛ばし、残りで結合する。飛ばしたファイルの名前と理由は画面に出す（`docs/adr/0030-client-side-merge-premises.md`）
* **Web Worker:** `workers/merge.worker.ts` が結合を行い、1 ファイルごとに進捗を返す。ファイルの中身（`ArrayBuffer`）はコピーせずに Worker へ渡す。Worker は結合を始めたときに作るので、`pdf-lib`（gzip で約 175 KB）は最初のページの読み込みに入らない。Worker を作れないブラウザでは、メインスレッドで結合する
* **大きさ:** サーバーの上限（4.5MB）はなくなり、端末のメモリだけが上限になる。合計 300MB または 100 ファイルを超えると、時間がかかるか失敗しうると警告する（結合は止めない）
* **旧API:** サーバーで結合していた `/api/merge-pdf` は、戻せるように 1 リリースだけ残し、次のリリースで消す

### モダンなフロントエンド構成

* **Next.js 16 (App Router):** `page.tsx` に `"use client"` を明記し、React Server Components (RSC) のアーキテクチャを意識したクライアントコンポーネントとして構築
* **React 19:** 最新のReactの機能を採用
* **TypeScript:** 型安全な開発を徹底
* **Tailwind CSS & shadcn/ui:** モダンでレスポンシブなUIを効率的に構築

### 堅牢なテストスイート

* **Vitest:** `__tests__` ディレクトリで、コンポーネントのロジックやAPIルートのユニットテストを管理。`vi.mock` を活用し、`pdf-lib` や Sentry などの外部依存を分離したテストを実行
* **Storybook:** `play` 関数を用いたインタラクションテスト（ドラッグ＆ドロップ、ファイル削除など）を実装し、UIコンポーネントの分離とカバレッジ向上を実現
* **GitHub Actions:** プルリクエストごとに lint・型チェック・ユニットテスト・Storybook のテスト・E2E テスト・Lighthouse CI を実行し、コードの品質を自動で担保（`docs/adr/0006-ci-quality-gates.md`）

### 使用技術一覧

* **フレームワーク:** Next.js 16 (App Router)
* **言語:** TypeScript
* **スタイリング:** Tailwind CSS, shadcn/ui
* **PDF処理:** `pdf-lib`
* **テスト:** Vitest, Storybook (v10), Playwright, Testing Library
* **リンター/フォーマッター:** Biome.js
* **デプロイ:** Vercel (Functions)
* **パッケージ管理:** pnpm（10 系）。依存の更新は Renovate

## ローカル開発環境セットアップ

1. リポジトリをクローン
```bash
git clone [https://github.com/shun2218-dev/pdf-merge-app.git](https://github.com/shun2218-dev/pdf-merge-app.git)
cd pdf-merge-app
```
2. 依存関係をインストール
```bash
pnpm install
```
3. 開発サーバーを起動
```bash
pnpm dev
```
ブラウザで `http://localhost:3000` を開く
### テストの実行
* **ユニットテスト (Vitest):**
```bash
pnpm run test:unit
```
* **コンポーネントテスト (Storybook):**
```bash
pnpm run storybook
```
* **E2Eテスト (Playwright):**
```bash
pnpm run test:e2e
```