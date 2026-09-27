import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { STORAGE_KEY } from "@/components/disclaimer-modal";
import { SELECTORS } from "@/lib/tests/e2e/selectors";
import { dirname } from "@/utils";

// テスト用のダミーPDFファイルへのパス
// プロジェクトのルートに `e2e/fixtures` フォルダを作成し、ダミーPDFを入れてください
const pdfFile1 = resolve(dirname, "fixtures/dummy1.pdf");
const pdfFile2 = resolve(dirname, "fixtures/dummy2.pdf");
const txtFile = resolve(dirname, "fixtures/dummy.txt");

test.describe("PDF Merger E2E Test", () => {
	test.beforeEach(async ({ page }) => {
		await page.context().addInitScript((key) => {
			sessionStorage.setItem(key, "true");
		}, STORAGE_KEY);
		// 各テストの前にトップページにアクセス
		await page.goto("/");
	});

	test("ファイルをアップロード(PDFファイル)", async ({ page }) => {
		const fileInput = page.locator(SELECTORS.FILE_INPUT);

		// 1. PDFをセット
		await fileInput.setInputFiles([pdfFile1, pdfFile2]);

		// 2. FileList に PDF のみ 2つ表示されることを確認
		await expect(page.locator(SELECTORS.fileName("dummy1.pdf"))).toBeVisible();
		await expect(page.locator(SELECTORS.fileName("dummy2.pdf"))).toBeVisible();
	});

	test("ファイルをアップロード(TXTファイル)", async ({ page }) => {
		page.on("dialog", async (dialog) => {
			expect(dialog.message()).toBe("PDFファイルのみ選択してください");
			await dialog.accept();
		});

		const fileInput = page.locator(SELECTORS.FILE_INPUT);

		// 1. TXTをセット
		await fileInput.setInputFiles([txtFile]);

		// 2. FileList に .txt　ファイルが表示されていないことを確認
		await expect(page.locator(SELECTORS.fileName("dummy.txt"))).not.toBeVisible();
	});

	test("ファイルの削除", async ({ page }) => {
		const fileInput = page.locator(SELECTORS.FILE_INPUT);
		await fileInput.setInputFiles([pdfFile1, pdfFile2]);

		// ステップ2が表示されていることを確認
		await expect(page.getByText("ステップ 2: ファイルの順番を調整")).toBeVisible();

		// 1. dummy1.pdf の削除ボタンをクリック
		await page.locator(SELECTORS.removeButton("dummy1.pdf")).click();

		// 2. dummy1.pdf がリストから消えることを確認
		await expect(page.locator(SELECTORS.fileItemContainer("dummy1.pdf"))).not.toBeVisible();

		// 3. dummy2.pdf は残っていることを確認
		await expect(page.locator(SELECTORS.fileItemContainer("dummy2.pdf"))).toBeVisible();
	});

	test("ファイルの並び替え（ドラッグ＆ドロップ）", async ({ page }) => {
		const fileInput = page.locator(SELECTORS.FILE_INPUT);
		await fileInput.setInputFiles([pdfFile1, pdfFile2]);

		const dragHandle = page.locator(SELECTORS.dragHandle("dummy1.pdf"));
		const dropTargetContainer = page.locator(SELECTORS.fileItemContainer("dummy2.pdf"));

		// 1. dummy1 を掴んで dummy2 の位置にドラッグ
		// await dragHandle1.dragTo(dropTargetContainer);
		await dragHandle.dispatchEvent("dragstart");
		await dropTargetContainer.dispatchEvent("dragover");
		await dragHandle.dispatchEvent("dropend");

		// 2. 順序が入れ替わったことを確認（DOMの順序で確認）
		const orderedFileNames = await page
			.locator(`${SELECTORS.FILE_LIST_CONTAINER} [data-testid='file-name']`)
			.allTextContents();

		// 順序が dummy2 -> dummy1 になっているはず
		expect(orderedFileNames).toEqual(["dummy2.pdf", "dummy1.pdf"]);
	});

	test("プレビューとダウンロード(API疎通)", async ({ page }) => {
		// サーバーがモックPDFを返すように設定 (このテストはローカルでのみ実行可能)
		// このテストは、APIが本物のPDFを返すことを前提としています
		if (process.env.CI) {
			test.skip(true, "Skipping API test in CI for now. Requires real PDF handling.");
			return;
		}

		const fileInput = page.locator(SELECTORS.FILE_INPUT);
		await fileInput.setInputFiles([pdfFile1, pdfFile2]);

		// 1. プレビューボタンをクリック
		await page.locator(SELECTORS.PREVIEW_BUTTON).click();

		// 2. プレビューが表示されるのを待つ
		await expect(page.locator(SELECTORS.PROCESSING_BUTTON)).toBeHidden({ timeout: 10000 }); // 10秒待機

		// 3. プレビューが表示されることを確認
		await expect(page.locator(SELECTORS.PDF_PREVIEW)).toBeVisible();

		// 4. ダウンロードボタンをクリック
		const downloadPromise = page.waitForEvent("download");
		await page.locator(SELECTORS.DOWNLOAD_BUTTON).click();
		const download = await downloadPromise;

		// 5. ダウンロードが開始されたことを確認
		expect(download.suggestedFilename()).toBe("merged.pdf");
	});

	test("プレビューせずにダウンロードを1回クリックするとダウンロードされる", async ({ page }) => {
		const fileInput = page.locator(SELECTORS.FILE_INPUT);
		await fileInput.setInputFiles([pdfFile1, pdfFile2]);

		const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
		await page.locator(SELECTORS.DOWNLOAD_BUTTON).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe("merged.pdf");
	});
});
