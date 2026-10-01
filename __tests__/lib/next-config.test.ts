import { afterEach, describe, expect, it, vi } from "vitest";

describe("Sentry のビルドの設定", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("ソースマップの送り先の組織とプロジェクトを、Vercel の環境変数から読む", async () => {
		// 直接書いた組織名とプロジェクト名が実際のもの（Vercel の環境変数）と違い、ソースマップを送れていなかった（B-10）
		vi.stubEnv("SENTRY_ORG", "example-org");
		vi.stubEnv("SENTRY_PROJECT", "example-project");
		vi.resetModules();

		const { sentryBuildOptions } = await import("../../next.config.mjs");

		expect(sentryBuildOptions.org).toBe("example-org");
		expect(sentryBuildOptions.project).toBe("example-project");
	});
});
