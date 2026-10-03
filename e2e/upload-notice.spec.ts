import { expect, test } from "@playwright/test";
import { UPLOAD_NOTICE } from "@/components/merge/upload-notice";
import { SELECTORS } from "@/lib/tests/e2e/selectors";

// 注意事項は、自動で開くモーダルをやめ、ドロップ領域の下に常に出す（ADR 0027）
test.describe("ファイルを送る前の断り", () => {
	test("ページを開くと、モーダルを出さずに、断りをドロップ領域の下に出す", async ({ page }) => {
		await page.goto("/");

		const notice = page.locator(SELECTORS.UPLOAD_NOTICE);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText(UPLOAD_NOTICE.sending);
		await expect(notice).toContainText(UPLOAD_NOTICE.confidential);

		const dropzone = await page.locator(SELECTORS.FILE_UPLOADER_DROPZONE).boundingBox();
		const noticeBox = await notice.boundingBox();
		expect(noticeBox?.y).toBeGreaterThan((dropzone?.y ?? 0) + (dropzone?.height ?? 0) - 1);

		await expect(page.getByRole("dialog")).toHaveCount(0);
	});

	test("最初からファイルを選べる（モーダルを閉じる手数がない）", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByRole("button", { name: "ファイルを選択" })).toBeEnabled();
		await expect(page.getByRole("button", { name: "ファイルを選択" })).toBeInViewport();
	});
});
