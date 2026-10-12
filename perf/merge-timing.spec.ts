import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "@playwright/test";
import { createPdf } from "@/tests/utils/pdf-fixtures";

// docs/performance.md の「固定のファイルの組」。変えるときは docs/performance.md も直す
const FILE_SETS = [
	{ name: "A: 10 ファイル × 1MB", count: 10, bytes: 1 * 1024 * 1024 },
	{ name: "B: 5 ファイル × 20MB", count: 5, bytes: 20 * 1024 * 1024 },
	{ name: "C: 100 ファイル × 100KB", count: 100, bytes: 100 * 1024 },
	{ name: "D: 4 ファイル × 5MB", count: 4, bytes: 5 * 1024 * 1024 },
] as const;

const ITERATIONS = 3;

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

let workDir: string;

test.beforeAll(() => {
	workDir = mkdtempSync(join(tmpdir(), "pdf-merge-perf-"));
});

test.afterAll(() => {
	rmSync(workDir, { recursive: true, force: true });
});

declare global {
	interface Window {
		__longTasks: { startTime: number; duration: number }[];
	}
}

for (const set of FILE_SETS) {
	test(`結合の時間: ${set.name}`, async ({ page }, testInfo) => {
		const dir = join(workDir, String(set.count));
		mkdirSync(dir, { recursive: true });
		const pdf = await createPdf({ padToBytes: set.bytes });
		const paths = Array.from({ length: set.count }, (_, i) => {
			const path = join(dir, `file-${String(i).padStart(3, "0")}.pdf`);
			writeFileSync(path, pdf);
			return path;
		});

		// メインスレッドが 50ms 以上ふさがった区間（Long Task）を残す（ADR 0002 の DoD）
		await page.addInitScript(() => {
			window.__longTasks = [];
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					window.__longTasks.push({ startTime: entry.startTime, duration: entry.duration });
				}
			}).observe({ type: "longtask", buffered: true });
		});

		const durations: number[] = [];
		const longestTasks: number[] = [];
		for (let i = 0; i < ITERATIONS; i++) {
			await page.goto("/");
			await page.locator('[data-testid="file-input"]').setInputFiles(paths);

			// 「プレビュー」を押してから、ブラウザの中で結合を終えて結果を持つまで（ADR 0002）。
			// Worker と pdf-lib の読み込みを含む。プレビューの描画（pdf.js）は含めない
			const startedAt = await page.evaluate(() => performance.now());
			await page.getByRole("button", { name: /プレビュー/ }).click();
			// expect の待ち（100 / 250 / 500ms ごと）では終わりの時刻が丸まるので、ページの中でフレームごとに見る
			const finished = await page.waitForFunction(
				() =>
					[...document.querySelectorAll("h2")].some((heading) => heading.textContent === "プレビュー") &&
					performance.now(),
				null,
				{ polling: "raf", timeout: 5 * 60 * 1000 },
			);
			const finishedAt = (await finished.jsonValue()) as number;
			durations.push(Math.round(finishedAt - startedAt));

			const tasks = await page.evaluate(
				({ from, to }) => window.__longTasks.filter((task) => task.startTime >= from && task.startTime <= to),
				{ from: startedAt, to: finishedAt },
			);
			longestTasks.push(Math.round(Math.max(0, ...tasks.map((task) => task.duration))));
		}

		const result = {
			set: set.name,
			iterations: durations,
			medianMs: median(durations),
			longestTaskMs: longestTasks,
			pdfBytes: pdf.length,
		};
		console.log(JSON.stringify(result));
		await testInfo.attach("merge-timing", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
	});
}
