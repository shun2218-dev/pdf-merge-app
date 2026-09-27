import { describe, expect, it, vi } from "vitest";
import { countBucket, durationBucket, sizeBucket, totalSize } from "@/lib/analytics/buckets";
import { createAnalytics } from "@/lib/analytics/track";

const MB = 1024 * 1024;

describe("バケット", () => {
	it.each([
		[0, "0"],
		[1, "1"],
		[2, "2"],
		[3, "3-5"],
		[5, "3-5"],
		[6, "6-10"],
		[10, "6-10"],
		[11, "11-30"],
		[30, "11-30"],
		[31, "31+"],
	])("countBucket(%i) は %s", (count, expected) => {
		expect(countBucket(count)).toBe(expected);
	});

	it.each([
		[0, "<1MB"],
		[1 * MB - 1, "<1MB"],
		[1 * MB, "1-5MB"],
		[5 * MB, "5-20MB"],
		[20 * MB, "20-100MB"],
		[100 * MB, "100MB+"],
	])("sizeBucket(%i) は %s", (bytes, expected) => {
		expect(sizeBucket(bytes)).toBe(expected);
	});

	it.each([
		[0, "<1s"],
		[999, "<1s"],
		[1_000, "1-3s"],
		[3_000, "3-10s"],
		[10_000, "10-30s"],
		[30_000, "30s+"],
	])("durationBucket(%i) は %s", (milliseconds, expected) => {
		expect(durationBucket(milliseconds)).toBe(expected);
	});

	it("totalSize はファイルの大きさの合計", () => {
		expect(totalSize([{ size: 1 }, { size: 2 }, { size: 3 }])).toBe(6);
	});
});

function fakePostHog() {
	return { init: vi.fn(), capture: vi.fn() };
}

describe("createAnalytics", () => {
	it("無効のときは SDK を読み込まず、debug にだけ渡す", () => {
		const load = vi.fn();
		const debug = vi.fn();
		const { track } = createAnalytics({ enabled: false, apiKey: "phc_test", apiHost: "https://h", load, debug });

		track("preview_opened", {});

		expect(load).not.toHaveBeenCalled();
		expect(debug).toHaveBeenCalledWith("preview_opened", {});
	});

	it("キーがないときは、有効でも送らない", () => {
		const load = vi.fn();
		const { track } = createAnalytics({ enabled: true, apiKey: undefined, apiHost: "https://h", load });

		track("preview_opened", {});

		expect(load).not.toHaveBeenCalled();
	});

	it("最初のイベントで 1 回だけ読み込み、ページビュー → 貯めたイベントの順に送る", async () => {
		const posthog = fakePostHog();
		const load = vi.fn(() => Promise.resolve(posthog));
		const { track } = createAnalytics({ enabled: true, apiKey: "phc_test", apiHost: "https://h", load });

		// 読み込みが終わる前に 2 つ起きる
		track("files_added", { source: "drop", count_bucket: "2", size_bucket: "<1MB" });
		track("merge_started", { count_bucket: "2", size_bucket: "<1MB" });

		await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(3));

		expect(load).toHaveBeenCalledTimes(1);
		expect(posthog.init).toHaveBeenCalledWith(
			"phc_test",
			expect.objectContaining({
				api_host: "https://h",
				persistence: "memory",
				autocapture: false,
				capture_pageview: false,
				capture_dead_clicks: false,
				capture_heatmaps: false,
				capture_performance: false,
				capture_exceptions: false,
				disable_session_recording: true,
			}),
		);
		expect(posthog.capture.mock.calls.map(([name]) => name)).toEqual(["$pageview", "files_added", "merge_started"]);

		// 読み込んだあとは、そのまま送る
		track("preview_opened", {});
		expect(posthog.capture).toHaveBeenLastCalledWith("preview_opened", {});
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("ページの読み込みごとの ID を distinct_id として SDK に渡す（ADR 0021 決定 6）", async () => {
		const posthog = fakePostHog();
		const { track } = createAnalytics({
			enabled: true,
			apiKey: "phc_test",
			apiHost: "https://h",
			distinctId: () => "page-view-id",
			load: () => Promise.resolve(posthog),
		});

		track("preview_opened", {});

		await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
		expect(posthog.init).toHaveBeenCalledWith(
			"phc_test",
			expect.objectContaining({ bootstrap: { distinctID: "page-view-id" } }),
		);
	});

	it("SDK を読み込めなくても例外を投げない", async () => {
		const load = vi.fn(() => Promise.reject(new Error("blocked")));
		const { track } = createAnalytics({ enabled: true, apiKey: "phc_test", apiHost: "https://h", load });

		expect(() => track("preview_opened", {})).not.toThrow();
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
	});
});
