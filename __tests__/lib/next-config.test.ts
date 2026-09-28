import { describe, expect, it } from "vitest";
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
