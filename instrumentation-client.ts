// ブラウザでの Sentry の初期化。方針は ADR 0007、読み込む時機は ADR 0026
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
// Session Replay は使わない。エラーの前の操作は、結合の操作のパンくずで追う（ADR 0024）

import { sentry } from "@/lib/sentry/browser";
import { runAfterLoad } from "@/lib/sentry/lazy";

// SDK の読み込みと初期化は、最初の表示の邪魔をしないよう、ページの load のあとに回す（ADR 0026 決定 1）。
// それまでに起きたエラーはためておき、初期化したら送る（決定 2）
sentry.captureEarlyErrors(window);
runAfterLoad(() => void sentry.start());
