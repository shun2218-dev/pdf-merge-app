import { expect, test } from "@playwright/test";

type Probe = { sentryAtLoad?: boolean };

// ブラウザの Sentry は、最初の表示の邪魔をしないよう、ページの load のあとに読み込む（ADR 0026 決定 1）
test.describe("Sentry の読み込み", () => {
	test("load の時点では SDK を読み込まず、load のあとに読み込む", async ({ page }) => {
		// ページのスクリプトより先に load の受け口を置き、その時点で SDK（グローバルの __SENTRY__）があるかを残す
		await page.addInitScript(() => {
			window.addEventListener("load", () => {
				(window as Probe).sentryAtLoad = "__SENTRY__" in window;
			});
		});

		await page.goto("/");
		await page.waitForFunction(() => "__SENTRY__" in window);

		expect(await page.evaluate(() => (window as Probe).sentryAtLoad)).toBe(false);
	});
});
