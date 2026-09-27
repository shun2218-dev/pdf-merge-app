import { defineConfig, devices } from "@playwright/test";

// 結合の時間を測るテスト（ADR 0012 決定 1）。時間がかかるので、通常の E2E と CI には含めない。
// 実行: pnpm build && pnpm test:perf
export default defineConfig({
	testDir: "./perf",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 10 * 60 * 1000,
	reporter: "list",
	use: {
		baseURL: "http://localhost:3000",
		...devices["Desktop Chrome"],
	},
	webServer: {
		command: "pnpm run start",
		url: "http://localhost:3000",
		timeout: 120 * 1000,
		reuseExistingServer: true,
	},
});
