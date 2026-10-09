import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { SELECTORS } from "@/lib/tests/e2e/selectors";
import { createCorruptPdf, createEncryptedPdf, createPdf, createTextFile } from "@/tests/utils/pdf-fixtures";

// 結合をブラウザの中で行い、PDF をサーバーへ送らない（ADR 0002・ADR 0030）

const MB = 1024 * 1024;
let workDir: string;
const files: Record<string, string> = {};

test.beforeAll(async () => {
	workDir = mkdtempSync(join(tmpdir(), "pdf-merge-e2e-"));
	const write = (name: string, bytes: Uint8Array) => {
		files[name] = join(workDir, name);
		writeFileSync(files[name], bytes);
	};
	write("first.pdf", await createPdf({ width: 100 }));
	write("second.pdf", await createPdf({ width: 200, pages: 2 }));
	write("locked.pdf", await createEncryptedPdf());
	write("broken.pdf", createCorruptPdf());
	write("text-only.pdf", createTextFile());
	// 合計 20MB（もとのサーバーの上限 4.5MB を超える）。1 つずつ幅を変えて、並びを確かめられるようにする
	for (let i = 0; i < 4; i++) {
		write(`large-${i}.pdf`, await createPdf({ width: 300 + i, padToBytes: 5 * MB }));
	}
});

test.afterAll(() => {
	rmSync(workDir, { recursive: true, force: true });
});

// ページとその Worker が出したリクエストを残す
function recordRequests(context: BrowserContext) {
	const requests: { url: string; body: Buffer | null }[] = [];
	context.on("request", (request) => requests.push({ url: request.url(), body: request.postDataBuffer() }));
	return requests;
}

async function downloadMerged(page: Page) {
	const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
	await page.locator(SELECTORS.DOWNLOAD_BUTTON).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe("merged.pdf");
	const pdf = await PDFDocument.load(readFileSync(await download.path()));
	return pdf.getPages().map((page) => page.getWidth());
}

test.describe("ブラウザの中での結合", () => {
	test("結合する前は、Worker の起動のコード（と pdf-lib）を読み込まない（ADR 0030 決定 1）", async ({
		page,
		context,
	}) => {
		const requests = recordRequests(context);
		await page.goto("/");
		await page.locator(SELECTORS.FILE_INPUT).setInputFiles([files["first.pdf"], files["second.pdf"]]);
		await expect(page.locator(SELECTORS.fileName("second.pdf"))).toBeVisible();
		await page.waitForLoadState("networkidle");

		expect(requests.filter((request) => /turbopack-worker/.test(request.url))).toEqual([]);

		// 結合を始めると読み込む（上の確かめが、読み込みを見落としているだけではないこと）
		expect(await downloadMerged(page)).toEqual([100, 200, 200]);
		expect(requests.some((request) => /turbopack-worker/.test(request.url))).toBe(true);
	});

	test("合計 20MB の PDF を、サーバーへ送らずに結合できる（ADR 0002 の DoD）", async ({ page, context }) => {
		test.setTimeout(120_000);
		const requests = recordRequests(context);
		await page.goto("/");
		const large = [0, 1, 2, 3].map((i) => files[`large-${i}.pdf`]);
		await page.locator(SELECTORS.FILE_INPUT).setInputFiles(large);

		expect(await downloadMerged(page)).toEqual([300, 301, 302, 303]);

		// PDF の中身を本文に含むリクエストが 1 件もない（ADR 0002 決定 7）
		const withPdf = requests.filter((request) => request.body?.includes("%PDF-"));
		expect(withPdf.map((request) => request.url)).toEqual([]);
		expect(requests.filter((request) => request.url.includes("/api/merge-pdf"))).toEqual([]);
		const largest = Math.max(0, ...requests.map((request) => request.body?.length ?? 0));
		expect(largest).toBeLessThan(MB);
	});

	test("パスワード付き・壊れたもの・中身がテキストのものを飛ばし、名前と理由を出して残りで結合する（ADR 0030 決定 2）", async ({
		page,
	}) => {
		await page.goto("/");
		await page
			.locator(SELECTORS.FILE_INPUT)
			.setInputFiles([
				files["first.pdf"],
				files["locked.pdf"],
				files["broken.pdf"],
				files["text-only.pdf"],
				files["second.pdf"],
			]);

		expect(await downloadMerged(page)).toEqual([100, 200, 200]);

		const skipped = page.locator(SELECTORS.SKIPPED_FILES);
		await expect(skipped).toContainText("locked.pdf（パスワード付きのため）");
		await expect(skipped).toContainText("broken.pdf（読み込めないため）");
		await expect(skipped).toContainText("text-only.pdf（読み込めないため）");
		await expect(skipped).not.toContainText("first.pdf");
	});

	test("読めるファイルが 1 つもなければ、結合の失敗として出す", async ({ page }) => {
		await page.goto("/");
		await page.locator(SELECTORS.FILE_INPUT).setInputFiles([files["locked.pdf"], files["broken.pdf"]]);

		await page.locator(SELECTORS.PREVIEW_BUTTON).click();

		await expect(page.getByRole("alert").filter({ hasText: "結合できる PDF がありませんでした" })).toBeVisible();
		await expect(page.locator(SELECTORS.SKIPPED_FILES)).toContainText("locked.pdf（パスワード付きのため）");
	});
});
