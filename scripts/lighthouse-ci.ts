// CI の Lighthouse（ADR 0023 / 0025）。`pnpm build` のあとに `pnpm lhci` で走らせる。
// 1 つのサーバーを起動したまま、温める 2 回を捨て（決定 1）、その benchmarkIndex の大きいほうから CPU の倍率を補正して（決定 2・3）、
// 3 回測って lighthouserc.json の関門で判定する。補正に使った値は GITHUB_OUTPUT にも書き、PR のコメントに出す（決定 4）

import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** 基準の端末の benchmarkIndex（CI のマシンの単位。ADR 0025 決定 3） */
export const B_REF = 440;
/** 判定に使わない、温める回数（ADR 0025 決定 1） */
export const WARMUP_RUNS = 2;

const RESULTS_DIR = ".lighthouseci";
const PORT = 3000;

// 温める回の benchmarkIndex から、測る回の CPU の倍率を決める。
// benchmarkIndex は下にだけ大きく外れるので、大きいほうを使う（ADR 0025 決定 2）
export function calibrate(benchmarkIndexes: number[], bRef = B_REF): { bci: number; multiplier: number } {
	const valid = benchmarkIndexes.filter((value) => Number.isFinite(value) && value > 0);
	if (valid.length === 0) throw new Error("温める回の benchmarkIndex がない");
	const bci = Math.max(...valid);
	return { bci, multiplier: Math.round((bci / bRef) * 100) / 100 };
}

// dir の lhr-*.json から benchmarkIndex を読む
export function readBenchmarkIndexes(dir: string): number[] {
	return readdirSync(dir)
		.filter((name) => /^lhr-.*\.json$/.test(name))
		.map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as { environment: { benchmarkIndex: number } })
		.map((lhr) => lhr.environment.benchmarkIndex);
}

// GITHUB_OUTPUT の形（key=value）。PR のコメントでそのまま読めるよう、桁区切りを付ける
export function formatCalibration({ bci, multiplier }: { bci: number; multiplier: number }): string[] {
	return [`bci=${Math.round(bci).toLocaleString("en-US")}`, `multiplier=${multiplier.toFixed(2)}`];
}

function lhci(...args: string[]) {
	execFileSync(join("node_modules", ".bin", "lhci"), args, { stdio: "inherit" });
}

async function startServer() {
	const server = spawn("node", [join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], {
		stdio: ["ignore", "pipe", "inherit"],
	});
	await new Promise<void>((resolve, reject) => {
		server.stdout.on("data", (chunk) => {
			process.stdout.write(chunk);
			if (String(chunk).includes("Ready in")) resolve();
		});
		server.on("exit", (code) => reject(new Error(`next start が終了した（${code}）`)));
	});
	return server;
}

async function main() {
	const server = await startServer();
	try {
		// collect は前の結果を消してから書くので、温める回の結果は測る回の前に読み終える
		lhci("collect", `--numberOfRuns=${WARMUP_RUNS}`);
		const calibration = calibrate(readBenchmarkIndexes(RESULTS_DIR));
		const lines = formatCalibration(calibration);
		console.log(`基準の端末への補正（ADR 0025）: ${lines.join(" ")}`);
		if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);

		lhci("collect", `--settings.throttling.cpuSlowdownMultiplier=${calibration.multiplier}`);
		// 関門を超えたときにもレポートを残すよう、判定の前に書き出す
		lhci("upload");
		lhci("assert");
	} finally {
		server.kill();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
