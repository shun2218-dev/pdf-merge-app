import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";
import { scrubDeep } from "./scrub";

// クライアント・サーバー・Edge の 3 つの Sentry.init で共通の設定（ADR 0007）

type Env = Record<string, string | undefined>;

// `process.env.X` と直接書かないと、Next.js がクライアントのバンドルに値を埋め込まない
const defaultEnv: Env = {
	NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
	NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
};

export function sharedSentryOptions(env: Env = defaultEnv) {
	const dsn = env.NEXT_PUBLIC_SENTRY_DSN || undefined;

	return {
		dsn,
		// DSN のないローカルと CI では送信しない（決定 5）
		enabled: Boolean(dsn),
		environment: env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
		// IP アドレスなどを送らない（決定 1）
		sendDefaultPii: false,
		// トレースは使わない（ADR 0022）。tracesSampleRate を書かないとトレースは無効になる
		beforeSend: (event: ErrorEvent) => scrubDeep(event),
		beforeBreadcrumb: (breadcrumb) => scrubDeep(breadcrumb),
	} satisfies BrowserOptions;
}
