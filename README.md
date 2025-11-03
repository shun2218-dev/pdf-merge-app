# PDF Merge App

ブラウザ上で複数のPDFファイルを簡単に結合できるWebアプリケーションです。ドラッグ＆ドロップによる直感的な操作で、ファイルのアップロードや並び替えが可能です。

**デモURL:** <https://pdf-merge-app-nine.vercel.app/>

## 概要

このプロジェクトは、Next.js 15 (App Router) と `pdf-lib` ライブラリを使用して構築したPDF結合ツールです。モダンなフロントエンド技術とサーバーレスアーキテクチャ（Vercel Edge Functions）の実践的な活用を目的として開発しました。

## 主な機能

* **ドラッグ＆ドロップによるファイルアップロード:**
  * `.pdf` ファイルのみを受け付けるフィルタリング機能
  * Sentry と連携したエラーハンドリング
* **ファイルの並び替え:**
  * アップロードしたファイルをドラッグ＆ドロップで直感的に並び替え可能
* **リアルタイムプレビュー:**
  * 結合後のPDFをサーバーサイド（Edge）で生成し、`@react-pdf-viewer` を使ってクライアントでプレビュー表示
* **ファイルのダウンロード:**
  * 結合されたPDFを `merged.pdf` としてダウンロード

## アーキテクチャと技術スタック

### Edge Runtime によるPDF処理

従来のサーバーレス（Node.js）ではなく、**Vercel Edge Runtime** 上でPDFの結合処理（`/api/merge-pdf`）を実行

* **高速な API 応答:** ユーザーに近いエッジサーバーで動作するため、コールドブートがほぼ発生せず、高速なレスポンスを実現
* **バイナリデータの取り扱い:** Edge Runtime 上で `pdf-lib` を動作させ、`File` オブジェクトの `arrayBuffer()` を処理し、結合後のPDFバイナリデータをストリーミングで返却

### モダンなフロントエンド構成

* **Next.js 15 (App Router):** `page.tsx` に `"use client"` を明記し、React Server Components (RSC) のアーキテクチャを意識したクライアントコンポーネントとして構築
* **React 19:** 最新のReactの機能を採用
* **TypeScript:** 型安全な開発を徹底
* **Tailwind CSS & shadcn/ui:** モダンでレスポンシブなUIを効率的に構築

### 堅牢なテストスイート

* **Vitest:** `__tests__` ディレクトリで、コンポーネントのロジックやAPIルートのユニットテストを管理。`vi.mock` を活用し、`pdf-lib` や Sentry などの外部依存を分離したテストを実行
* **Storybook:** `play` 関数を用いたインタラクションテスト（ドラッグ＆ドロップ、ファイル削除など）を実装し、UIコンポーネントの分離とカバレッジ向上を実現
* **GitHub Actions:** プルリクエストごとにユニットテスト (`test:unit`) とE2Eテスト (`test:e2e`) を実行し、コードの品質を自動で担保

### 使用技術一覧

* **フレームワーク:** Next.js 15 (App Router)
* **言語:** TypeScript
* **スタイリング:** Tailwind CSS, shadcn/ui
* **PDF処理:** `pdf-lib`
* **テスト:** Vitest, Storybook (v10), Playwright, Testing Library
* **リンター/フォーマッター:** Biome.js
* **デプロイ:** Vercel (Edge Functions)
* **パッケージ管理:** pnpm

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