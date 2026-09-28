// Lighthouse CI の結果（.lighthouseci/lhr-*.json）から、関門の指標の中央値を取り出す（ADR 0023）。
// CI では `node scripts/lighthouse-summary.ts` で実行し、値を GITHUB_OUTPUT に書いて PR のコメントに出す

import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type LighthouseResult = {
	categories: { performance: { score: number } };
	audits: {
		"largest-contentful-paint": { numericValue: number };
		"total-blocking-time": { numericValue: number };
		"cumulative-layout-shift": { numericValue: number };
		"resource-summary": { details: { items: { resourceType: string; transferSize: number }[] } };
	};
};

export type LighthouseSummary = {
	performance: number;
	lcp: number;
	tbt: number;
	cls: number;
	script: number;
};

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function scriptBytes(result: LighthouseResult): number {
	return (
		result.audits["resource-summary"].details.items.find((item) => item.resourceType === "script")?.transferSize ?? 0
	);
}

// 起動したばかりのサーバーで遅くなる 1 回目に引きずられないよう、指標ごとに中央値を取る
export function summarize(results: LighthouseResult[]): LighthouseSummary | null {
	if (results.length === 0) return null;
	return {
		performance: median(results.map((r) => r.categories.performance.score)),
		lcp: median(results.map((r) => r.audits["largest-contentful-paint"].numericValue)),
		tbt: median(results.map((r) => r.audits["total-blocking-time"].numericValue)),
		cls: median(results.map((r) => r.audits["cumulative-layout-shift"].numericValue)),
		script: median(results.map(scriptBytes)),
	};
}

function main() {
	const dir = process.argv[2] ?? ".lighthouseci";
	const results = readdirSync(dir)
		.filter((name) => /^lhr-.*\.json$/.test(name))
		.map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as LighthouseResult);
	const summary = summarize(results);
	if (!summary) {
		console.log("Lighthouse の結果がない");
		return;
	}

	const lines = [
		`performance=${summary.performance.toFixed(2)}`,
		`lcp=${Math.round(summary.lcp).toLocaleString("en-US")}`,
		`tbt=${Math.round(summary.tbt).toLocaleString("en-US")}`,
		`cls=${summary.cls.toFixed(3)}`,
		`script=${Math.round(summary.script).toLocaleString("en-US")}`,
	];
	console.log(lines.join("\n"));
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
