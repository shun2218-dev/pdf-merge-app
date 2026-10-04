import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Node の版は package.json の volta の版にそろえる（CLAUDE.md）。
// Vercel は engines.node をプロジェクトの設定より優先するので、本番の版も engines.node で決める

const root = resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
	volta: { node: string };
	engines?: { node?: string };
};
const major = (version: string) => version.split(".")[0];

describe("Node の版", () => {
	it("本番（Vercel）の版を engines.node で決め、volta と同じメジャーにする", () => {
		expect(pkg.engines?.node).toBe(`${major(pkg.volta.node)}.x`);
	});

	it("CI の版が volta と同じ", () => {
		const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
		expect(workflow).toContain(`NODE_VERSION: "${pkg.volta.node}"`);
	});
});
