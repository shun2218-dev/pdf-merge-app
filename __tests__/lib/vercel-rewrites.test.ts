import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { describe, expect, it } from "vitest";
import { WEB_VITALS_ENDPOINT } from "@/lib/analytics/web-vitals";

// vercel.json の rewrites が、Web Vitals の送り先を PostHog に転送するかを確かめる（ADR 0021 決定 5）。
// Vercel は source を path-to-regexp の strict（末尾の / を区別する）で照合する。
// `:path*` は末尾が / のパスに当たらず、本番で /ingest/i/v0/e/ が Next.js の 404 になっていた

type Rewrite = { source: string; destination: string };

const vercelConfig = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")) as {
	rewrites: Rewrite[];
};

function rewrite(pathname: string): string | null {
	for (const { source, destination } of vercelConfig.rewrites) {
		const keys: { name: string | number }[] = [];
		const match = pathToRegexp(source, keys, { strict: true, sensitive: true, delimiter: "/" }).exec(pathname);
		if (!match) continue;
		const params = new Map(keys.map((key, index) => [String(key.name), match[index + 1] ?? ""]));
		return destination.replace(/:(\w+)(?:\([^)]*\))?[*+?]?/g, (whole, name: string) => params.get(name) ?? whole);
	}
	return null;
}

describe("vercel.json の rewrites", () => {
	it("Web Vitals の送り先を、末尾の / を保ったまま PostHog の受け口に転送する", () => {
		expect(WEB_VITALS_ENDPOINT).toBe("/ingest/i/v0/e/");
		expect(rewrite(WEB_VITALS_ENDPOINT)).toBe("https://us.i.posthog.com/i/v0/e/");
	});

	it("末尾に / のないパスも転送する", () => {
		expect(rewrite("/ingest/decide")).toBe("https://us.i.posthog.com/decide");
	});

	it("/ingest の外は転送しない", () => {
		expect(rewrite("/")).toBeNull();
		expect(rewrite("/ingestion")).toBeNull();
	});
});
