import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument, PDFName } from "pdf-lib";
import { STORAGE_KEY } from "@/components/disclaimer-modal";

// docs/performance.md の「固定のファイルの組」。変えるときは docs/performance.md も直す
const FILE_SETS = [
	{ name: "10 ファイル × 1MB", count: 10, bytes: 1 * 1024 * 1024 },
	{ name: "5 ファイル × 20MB", count: 5, bytes: 20 * 1024 * 1024 },
	{ name: "100 ファイル × 100KB", count: 100, bytes: 100 * 1024 },
] as const;

const ITERATIONS = 3;

// 指定した大きさに近い 1 ページの PDF を作る。
// ページの内容のストリームに PDF のコメント行（% で始まる）を詰めて大きさをかせぐ。
// コメントは描画されないが、結合（copyPages）ではページと一緒にコピーされるので、処理の重さは実際の大きさに比例する
async function createPdf(targetBytes: number): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([595, 842]);
	const line = `%${"x".repeat(1022)}\n`;
	const padding = line.repeat(Math.max(1, Math.floor(targetBytes / line.length)));
	const stream = doc.context.stream(padding);
	page.node.set(PDFName.of("Contents"), doc.context.register(stream));
	return doc.save({ useObjectStreams: false });
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

let workDir: string;

test.beforeAll(() => {
	workDir = mkdtempSync(join(tmpdir(), "pdf-merge-perf-"));
});

test.afterAll(() => {
	rmSync(workDir, { recursive: true, force: true });
});

for (const set of FILE_SETS) {
	test(`結合の時間: ${set.name}`, async ({ page }, testInfo) => {
		const dir = join(workDir, String(set.count));
		mkdirSync(dir);
		const pdf = await createPdf(set.bytes);
		const paths = Array.from({ length: set.count }, (_, i) => {
			const path = join(dir, `file-${String(i).padStart(3, "0")}.pdf`);
			writeFileSync(path, pdf);
			return path;
		});

		await page.addInitScript((key) => sessionStorage.setItem(key, "true"), STORAGE_KEY);

		const durations: number[] = [];
		for (let i = 0; i < ITERATIONS; i++) {
			await page.goto("/");
			await page.locator('[data-testid="file-input"]').setInputFiles(paths);

			// 「プレビュー」を押してから、結合した PDF を受け取り終えるまで（サーバーとの往復と結合）
			const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/merge-pdf"));
			const startedAt = Date.now();
			await page.getByRole("button", { name: /プレビュー/ }).click();
			const response = await responsePromise;
			await response.finished();
			durations.push(Date.now() - startedAt);

			expect(response.status()).toBe(200);
		}

		const result = { set: set.name, iterations: durations, medianMs: median(durations), pdfBytes: pdf.length };
		console.log(JSON.stringify(result));
		await testInfo.attach("merge-timing", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
	});
}
