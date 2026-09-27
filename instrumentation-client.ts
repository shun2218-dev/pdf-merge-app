// ブラウザでの Sentry の初期化。方針は ADR 0007
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry/options";

Sentry.init({
	...sharedSentryOptions(),

	// Session Replay はエラーが起きたセッションだけ、画面の文字と画像をすべて隠して記録する（決定 2）。
	// ファイル名は一覧の文字として、PDF の中身はプレビューの canvas として画面に出るため
	integrations: [
		Sentry.replayIntegration({
			maskAllText: true,
			maskAllInputs: true,
			blockAllMedia: true,
			block: ["canvas"],
		}),
	],
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
