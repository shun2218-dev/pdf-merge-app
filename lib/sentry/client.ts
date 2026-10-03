// ブラウザで使う Sentry の関数だけを書き出す。ページの load のあとに、このファイルを動的な import で読み込む（ADR 0026 決定 1）。
// `import("@sentry/nextjs")` と直接書くと、使わない機能まで含めて SDK の全部が読み込まれる
export { addBreadcrumb, captureException, init } from "@sentry/nextjs";
