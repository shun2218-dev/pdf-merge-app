import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	B_REF,
	calibrate,
	formatCalibration,
	readBenchmarkIndexes,
	SENTRY_SINK_PORT,
	startSentrySink,
	WARMUP_RUNS,
} from "@/scripts/lighthouse-ci";

const root = resolve(__dirname, "../..");

describe("calibrate（ADR 0025 決定 2・3）", () => {
	it("基準の端末は benchmarkIndex 440、温める回は 2 回", () => {
		expect(B_REF).toBe(440);
		expect(WARMUP_RUNS).toBe(2);
	});

	it("温める回の benchmarkIndex の大きいほうを B_ci にし、B_ci ÷ 440 を倍率にする", () => {
		expect(calibrate([2109, 2419])).toEqual({ bci: 2419, multiplier: 5.5 });
	});

	it("倍率は小数 2 桁に丸める", () => {
		expect(calibrate([2487.5]).multiplier).toBe(5.65);
		expect(calibrate([3147]).multiplier).toBe(7.15);
	});

	it("値がなければ止める（補正せずに測らない）", () => {
		expect(() => calibrate([])).toThrow();
		expect(() => calibrate([Number.NaN, 0])).toThrow();
	});
});

describe("readBenchmarkIndexes", () => {
	it("lhr-*.json の benchmarkIndex だけを読む", () => {
		const dir = mkdtempSync(join(tmpdir(), "lhci-"));
		writeFileSync(join(dir, "lhr-1.json"), JSON.stringify({ environment: { benchmarkIndex: 2357.5 } }));
		writeFileSync(join(dir, "lhr-2.json"), JSON.stringify({ environment: { benchmarkIndex: 2453 } }));
		writeFileSync(join(dir, "manifest.json"), JSON.stringify([]));
		expect(readBenchmarkIndexes(dir).sort()).toEqual([2357.5, 2453]);
	});
});

describe("formatCalibration（決定 4）", () => {
	it("PR のコメントに出す形にする", () => {
		expect(formatCalibration({ bci: 2487.5, multiplier: 5.65 })).toEqual(["bci=2,488", "multiplier=5.65"]);
	});
});

describe("CI の設定", () => {
	const lighthouserc = JSON.parse(readFileSync(join(root, "lighthouserc.json"), "utf8")) as {
		ci: { collect: Record<string, unknown> };
	};
	const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
	const lighthouseJob = workflow.slice(workflow.indexOf("  lighthouse:"), workflow.indexOf("  report:"));

	it("サーバーは scripts/lighthouse-ci.ts が 1 つだけ起動する（温める回と測る回で同じサーバーを使う。決定 1）", () => {
		expect(lighthouserc.ci.collect.startServerCommand).toBeUndefined();
		expect(lighthouserc.ci.collect.numberOfRuns).toBe(3);
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
		expect(pkg.scripts.lhci).toBe("node scripts/lighthouse-ci.ts");
	});

	it("Sentry を有効にして測る。DSN は手元の受け口を指す（ADR 0025 の追記）", () => {
		expect(lighthouseJob).toMatch(
			new RegExp(`NEXT_PUBLIC_SENTRY_DSN: "http://[0-9a-f]+@127\\.0\\.0\\.1:${SENTRY_SINK_PORT}/1"`),
		);
	});

	it("補正に使った値を PR のコメントに出す（決定 4）", () => {
		expect(lighthouseJob).toMatch(/bci: \$\{\{ steps\.lhci\.outputs\.bci \}\}/);
		expect(lighthouseJob).toMatch(/multiplier: \$\{\{ steps\.lhci\.outputs\.multiplier \}\}/);
		expect(workflow).toContain("needs.lighthouse.outputs.bci");
		expect(workflow).toContain("needs.lighthouse.outputs.multiplier");
	});
});

describe("startSentrySink（ADR 0025 の追記）", () => {
	it("Sentry の送信を受け取って 200 を返す（ブラウザから送れるよう CORS も許す）", async () => {
		const sink = await startSentrySink(0);
		try {
			const address = sink.address();
			const port = typeof address === "object" && address ? address.port : 0;
			const response = await fetch(`http://127.0.0.1:${port}/api/1/envelope/?sentry_version=7`, {
				method: "POST",
				body: '{"type":"session"}',
			});
			expect(response.status).toBe(200);
			expect(response.headers.get("access-control-allow-origin")).toBe("*");
		} finally {
			sink.close();
		}
	});
});
