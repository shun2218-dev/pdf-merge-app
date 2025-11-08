import { expect, test } from "@playwright/test";
import { SELECTORS } from "@/lib/tests/e2e/selectors";

test.describe("Disclaimer Modal E2E Test", () => {
	test("初回訪問時にモーダルが自動で表示され、チェックすると閉じられる", async ({ page }) => {
		await page.goto("/");

		const modal = page.locator(SELECTORS.DISCLAIMER_MODAL);
		await expect(modal).toBeVisible();

		// 2. チェックボックスとボタンを取得
		const checkbox = page.locator(SELECTORS.DISCLAIMER_MODAL_CHECKBOX);
		const closeButton = page.locator(SELECTORS.DISCLAIMER_MODAL_CLOSE_BUTTON);

		await expect(closeButton).toBeDisabled();

		await checkbox.check();

		await expect(closeButton).toBeEnabled();

		await closeButton.click();

		await expect(modal).toBeHidden();
	});
});
