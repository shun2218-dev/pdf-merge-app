import { afterEach, describe, expect, it, vi } from "vitest";
import { nextConfig } from "../../next.config";

// Turbopack（ADR 0015）でビルドするときの next.config の前提を確かめる

describe("next.config", () => {
	it("Sentry のトレースとデバッグ用のログのコードを、Turbopack のビルドから除く（ADR 0022）", () => {
		// Sentry の excludeTracing / disableLogger は webpack のビルドにしか効かないので、同じ定数を compiler.define で置き換える
		expect(nextConfig.compiler?.define).toMatchObject({ __SENTRY_TRACING__: false, __SENTRY_DEBUG__: false });
	});

	it("webpack の独自設定を持たない（ADR 0015 決定 3）", () => {
		expect(nextConfig.webpack).toBeUndefined();
	});

	it("/ingest の末尾の / を外すリダイレクトをしない（ADR 0021 決定 5）", () => {
		expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
	});
});

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

		const { sentryBuildOptions } = await import("../../next.config");

		expect(sentryBuildOptions.org).toBe("example-org");
		expect(sentryBuildOptions.project).toBe("example-project");
	});
});
