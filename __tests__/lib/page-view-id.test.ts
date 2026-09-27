import { describe, expect, it } from "vitest";
import { getPageViewId } from "@/lib/analytics/page-view-id";

describe("getPageViewId", () => {
	it("同じページの読み込みの中では同じ ID を返す", () => {
		const first = getPageViewId();
		expect(first).toMatch(/^[0-9a-f-]{36}$/);
		expect(getPageViewId()).toBe(first);
	});
});
