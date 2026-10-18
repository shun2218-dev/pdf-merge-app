import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "@/lib/random-id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomId", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("crypto.randomUUID があればそれを使う", () => {
		expect(randomId()).toMatch(UUID_V4);
	});

	it("crypto.randomUUID がなければ getRandomValues から UUID v4 の形で作る（B-12）", () => {
		vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
		const ids = new Set(Array.from({ length: 100 }, () => randomId()));
		expect(ids.size).toBe(100);
		for (const id of ids) expect(id).toMatch(UUID_V4);
	});
});
