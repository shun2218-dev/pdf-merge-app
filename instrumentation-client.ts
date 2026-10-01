// ブラウザでの Sentry の初期化。方針は ADR 0007
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry/options";

Sentry.init({
	...sharedSentryOptions(),

	// Session Replay は使わない。エラーの前の操作は、結合の操作のパンくずで追う（ADR 0024）
});
