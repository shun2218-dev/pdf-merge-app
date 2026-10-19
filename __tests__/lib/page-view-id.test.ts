import { afterEach, describe, expect, it, vi } from "vitest";
import { getPageViewId } from "@/lib/analytics/page-view-id";

describe("getPageViewId", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("同じページの読み込みの中では同じ ID を返す", () => {
		const first = getPageViewId();
		expect(first).toMatch(/^[0-9a-f-]{36}$/);
		expect(getPageViewId()).toBe(first);
	});

	it("crypto.randomUUID がない環境でも ID を返す（B-12）", async () => {
		vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
		vi.resetModules();
		const { getPageViewId: fresh } = await import("@/lib/analytics/page-view-id");
		expect(fresh()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});
