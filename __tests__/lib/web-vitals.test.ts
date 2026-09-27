import { describe, expect, it, vi } from "vitest";
import { createWebVitalsReporter, sendWithKeepalive } from "@/lib/analytics/web-vitals";

const context = { origin: "https://pdf-merge.app", pathname: "/", viewportWidth: 1280 };

function setup(overrides: Partial<Parameters<typeof createWebVitalsReporter>[0]> = {}) {
	const send = vi.fn();
	const debug = vi.fn();
	const report = createWebVitalsReporter({
		enabled: true,
		apiKey: "phc_test",
		endpoint: "/ingest/i/v0/e/",
		distinctId: () => "page-view-id",
		getContext: () => context,
		send,
		debug,
		...overrides,
	});
	const sentBodies = () => send.mock.calls.map(([, body]) => JSON.parse(body as string));
	return { report, send, debug, sentBodies };
}

describe("createWebVitalsReporter", () => {
	it("LCP を PostHog の受け口に web_vital として送る", () => {
		const { report, send, sentBodies } = setup();

		report({ name: "LCP", value: 1234.5, rating: "good", navigationType: "navigate" });

		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0]).toBe("/ingest/i/v0/e/");
		expect(sentBodies()[0]).toEqual({
			api_key: "phc_test",
			event: "web_vital",
			distinct_id: "page-view-id",
			properties: {
				metric: "LCP",
				value: 1234.5,
				rating: "good",
				navigation_type: "navigate",
				device_class: "desktop",
				$current_url: "https://pdf-merge.app/",
				$pathname: "/",
				$process_person_profile: false,
			},
			timestamp: expect.any(String),
		});
	});

	it.each(["INP", "CLS"])("%s も送る", (name) => {
		const { report, send } = setup();
		report({ name, value: 0.1 });
		expect(send).toHaveBeenCalledTimes(1);
	});

	it.each(["FCP", "TTFB", "FID", "Next.js-hydration"])("予算にない %s は送らない", (name) => {
		const { report, send, debug } = setup();
		report({ name, value: 100 });
		expect(send).not.toHaveBeenCalled();
		expect(debug).not.toHaveBeenCalled();
	});

	it("画面の幅が 768px 未満なら mobile", () => {
		const { report, sentBodies } = setup({ getContext: () => ({ ...context, viewportWidth: 767 }) });
		report({ name: "CLS", value: 0.05 });
		expect(sentBodies()[0].properties.device_class).toBe("mobile");
	});

	it("無効のとき・キーがないときは送らず、debug にだけ渡す", () => {
		for (const overrides of [{ enabled: false }, { apiKey: undefined }]) {
			const { report, send, debug } = setup(overrides);
			report({ name: "LCP", value: 1000 });
			expect(send).not.toHaveBeenCalled();
			expect(debug).toHaveBeenCalledWith(expect.objectContaining({ metric: "LCP" }));
		}
	});

	it("クエリ文字列を URL に含めない", () => {
		const { report, sentBodies } = setup({ getContext: () => ({ ...context, pathname: "/en" }) });
		report({ name: "LCP", value: 1000 });
		expect(sentBodies()[0].properties.$current_url).toBe("https://pdf-merge.app/en");
	});
});

describe("sendWithKeepalive", () => {
	it("keepalive を付けて JSON を POST する", () => {
		const fetchMock = vi.fn(() => Promise.resolve(new Response()));
		vi.stubGlobal("fetch", fetchMock);

		sendWithKeepalive("/ingest/i/v0/e/", '{"a":1}');

		expect(fetchMock).toHaveBeenCalledWith("/ingest/i/v0/e/", {
			method: "POST",
			body: '{"a":1}',
			keepalive: true,
			headers: { "Content-Type": "application/json" },
		});
		vi.unstubAllGlobals();
	});

	it("送信に失敗しても例外を投げない", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
		);

		expect(() => sendWithKeepalive("/ingest/i/v0/e/", "{}")).not.toThrow();
		await Promise.resolve();
		vi.unstubAllGlobals();
	});
});
