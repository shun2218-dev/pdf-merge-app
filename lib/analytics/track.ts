import type { PostHogConfig } from "posthog-js";
import type { EventName, EventProperties } from "./events";
import { getPageViewId } from "./page-view-id";

// アナリティクスの送信の窓口（ADR 0011 決定 1）。コンポーネントは track() だけを呼び、送信先を知らない。
//
// 送信先は PostHog（決定 2）。SDK が大きいので、最初のイベントが起きてから読み込む。
// 読み込みが終わるまでに起きたイベントは貯めておき、読み込んだあとに順に送る。

type PostHogClient = {
	init: (apiKey: string, config: Partial<PostHogConfig>) => unknown;
	capture: (event: string, properties?: Record<string, unknown>) => unknown;
};

type AnalyticsConfig = {
	enabled: boolean;
	apiKey?: string;
	apiHost: string;
	/** ページの読み込みごとの ID。Web Vitals のイベントと同じ distinct_id にする（ADR 0021 決定 6） */
	distinctId?: () => string;
	load: () => Promise<PostHogClient>;
	debug?: (name: string, properties: Record<string, unknown>) => void;
};

type Queued = { name: string; properties: Record<string, unknown> };

export function createAnalytics(config: AnalyticsConfig) {
	let client: PostHogClient | null = null;
	let loading: Promise<void> | null = null;
	const queue: Queued[] = [];

	const ensureLoaded = () => {
		if (loading) return loading;
		loading = config
			.load()
			.then((posthog) => {
				posthog.init(config.apiKey as string, {
					api_host: config.apiHost,
					// Cookie も localStorage も使わない。そのため「セッション」は 1 回のページの読み込みになる
					persistence: "memory",
					// 決定 4 のイベントだけを送る。自動の収集・録画・アンケートは使わない。
					// PostHog はプロジェクトの設定（管理画面）でもこれらを有効にできるので、
					// 管理画面の設定に左右されないよう、コードで明示的に切る
					autocapture: false,
					capture_pageview: false,
					capture_pageleave: false,
					capture_dead_clicks: false,
					capture_heatmaps: false,
					capture_performance: false,
					capture_exceptions: false,
					disable_session_recording: true,
					disable_surveys: true,
					// 匿名の利用者の人物プロファイルを作らない
					person_profiles: "identified_only",
					...(config.distinctId ? { bootstrap: { distinctID: config.distinctId() } } : {}),
				});
				client = posthog;
				// ページビューは読み込んだ時点で 1 回だけ送る
				posthog.capture("$pageview");
				for (const event of queue.splice(0)) {
					posthog.capture(event.name, event.properties);
				}
			})
			.catch(() => {
				// 広告ブロッカーなどで読み込めなくても、アプリの動作には影響させない
				queue.length = 0;
			});
		return loading;
	};

	function track<N extends EventName>(name: N, properties: EventProperties<N>): void {
		const payload = properties as Record<string, unknown>;

		if (!config.enabled || !config.apiKey) {
			config.debug?.(name, payload);
			return;
		}

		if (client) {
			client.capture(name, payload);
			return;
		}

		queue.push({ name, properties: payload });
		void ensureLoaded();
	}

	return { track };
}

// 本番（Vercel の Production）だけで送る。それ以外は開発中にコンソールへ出すだけ（決定 6）
const analytics = createAnalytics({
	enabled: process.env.NEXT_PUBLIC_VERCEL_ENV === "production",
	apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
	apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
	distinctId: getPageViewId,
	load: () => import("posthog-js").then((module) => module.default as unknown as PostHogClient),
	debug:
		process.env.NODE_ENV === "development"
			? (name, properties) => console.debug("[analytics]", name, properties)
			: undefined,
});

export const track = analytics.track;
