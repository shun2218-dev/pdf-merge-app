import { getPageViewId } from "./page-view-id";

// 実利用者の Web Vitals を PostHog に送る（ADR 0021）。
// PostHog の SDK は最初の操作のあとに読み込むので（ADR 0011）、それを待たずに受け口へ直接送る。
// 送り先は自分のドメインの /ingest で、Next.js の rewrites で PostHog に転送する（広告ブロッカーで止められにくくするため）

// ADR 0012 の予算にある指標だけを送る（決定 2）
const REPORTED_METRICS = new Set(["LCP", "INP", "CLS"]);

// 画面の幅がこれより狭ければ mobile とする
const MOBILE_MAX_WIDTH = 768;

export type WebVitalMetric = {
	name: string;
	value: number;
	rating?: string;
	navigationType?: string;
};

type PageContext = { origin: string; pathname: string; viewportWidth: number };

type ReporterConfig = {
	enabled: boolean;
	apiKey?: string;
	endpoint: string;
	distinctId: () => string;
	getContext: () => PageContext;
	send: (endpoint: string, body: string) => void;
	debug?: (properties: Record<string, unknown>) => void;
};

export function createWebVitalsReporter(config: ReporterConfig) {
	return (metric: WebVitalMetric): void => {
		if (!REPORTED_METRICS.has(metric.name)) return;

		const context = config.getContext();
		const properties = {
			metric: metric.name,
			value: metric.value,
			rating: metric.rating,
			navigation_type: metric.navigationType,
			device_class: context.viewportWidth < MOBILE_MAX_WIDTH ? "mobile" : "desktop",
			// クエリ文字列は付けない（使わないものを送らない）
			$current_url: `${context.origin}${context.pathname}`,
			$pathname: context.pathname,
			$process_person_profile: false,
		};

		if (!config.enabled || !config.apiKey) {
			config.debug?.(properties);
			return;
		}

		config.send(
			config.endpoint,
			JSON.stringify({
				api_key: config.apiKey,
				event: "web_vital",
				distinct_id: config.distinctId(),
				properties,
				timestamp: new Date().toISOString(),
			}),
		);
	};
}

// ページを閉じる途中でも送り切れるよう keepalive を付ける。失敗してもアプリには影響させない
export function sendWithKeepalive(endpoint: string, body: string): void {
	void fetch(endpoint, {
		method: "POST",
		body,
		keepalive: true,
		headers: { "Content-Type": "application/json" },
	}).catch(() => {});
}

export const reportWebVital = createWebVitalsReporter({
	enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
	apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
	endpoint: "/ingest/i/v0/e/",
	distinctId: getPageViewId,
	getContext: () => ({
		origin: window.location.origin,
		pathname: window.location.pathname,
		viewportWidth: window.innerWidth,
	}),
	send: sendWithKeepalive,
	debug:
		process.env.NODE_ENV === "development"
			? (properties) => console.debug("[analytics]", "web_vital", properties)
			: undefined,
});
