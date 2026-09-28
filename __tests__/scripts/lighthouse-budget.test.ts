import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type LighthouseResult, summarize } from "@/scripts/lighthouse-summary";

// Lighthouse CI の関門が ADR 0023 の値になっているかを確かめる

type Assertion = [string, { maxNumericValue?: number; minScore?: number; aggregationMethod?: string }];

const lighthouserc = JSON.parse(readFileSync(resolve(__dirname, "../../lighthouserc.json"), "utf8")) as {
	ci: { assert: { assertions: Record<string, Assertion> } };
};
const assertions = lighthouserc.ci.assert.assertions;

describe("lighthouserc.json の関門（ADR 0023）", () => {
	it.each([
		["largest-contentful-paint", 2500],
		["total-blocking-time", 200],
		["cumulative-layout-shift", 0.1],
		// 決定 2 の条件で、LCP の予算の中に JS を送りきれる量から逆算した上限（決定 4）
		["resource-summary:script:size", 350000],
	])("%s は %d 以下で、3 回の中央値で判定する", (audit, max) => {
		const [level, options] = assertions[audit];
		expect(level).toBe("error");
		expect(options.maxNumericValue).toBe(max);
		expect(options.aggregationMethod).toBe("median-run");
	});

	it("Performance は 0.90 以上のまま（決定 3）", () => {
		expect(assertions["categories:performance"][1].minScore).toBe(0.9);
	});
});

function lhr(values: { performance: number; lcp: number; tbt: number; cls: number; script: number }): LighthouseResult {
	return {
		categories: { performance: { score: values.performance } },
		audits: {
			"largest-contentful-paint": { numericValue: values.lcp },
			"total-blocking-time": { numericValue: values.tbt },
			"cumulative-layout-shift": { numericValue: values.cls },
			"resource-summary": {
				details: {
					items: [
						{ resourceType: "document", transferSize: 5000 },
						{ resourceType: "script", transferSize: values.script },
					],
				},
			},
		},
	};
}

describe("summarize", () => {
	it("指標ごとに中央値を取る（起動直後の遅い 1 回目に引きずられない）", () => {
		const summary = summarize([
			lhr({ performance: 0.79, lcp: 2742, tbt: 688, cls: 0, script: 211637 }),
			lhr({ performance: 0.99, lcp: 1810, tbt: 65, cls: 0, script: 211637 }),
			lhr({ performance: 1, lcp: 1814, tbt: 58, cls: 0, script: 211637 }),
		]);
		expect(summary).toEqual({ performance: 0.99, lcp: 1814, tbt: 65, cls: 0, script: 211637 });
	});

	it("偶数個のときは真ん中の 2 つの平均にする", () => {
		const summary = summarize([
			lhr({ performance: 0.9, lcp: 2000, tbt: 100, cls: 0.02, script: 200000 }),
			lhr({ performance: 1, lcp: 1000, tbt: 50, cls: 0, script: 100000 }),
		]);
		expect(summary).toEqual({ performance: 0.95, lcp: 1500, tbt: 75, cls: 0.01, script: 150000 });
	});

	it("結果が 1 つもないときは null を返す", () => {
		expect(summarize([])).toBeNull();
	});
});
