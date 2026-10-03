import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createLazySentry, MAX_EARLY_ERRORS, runAfterLoad, type SentryFunctions } from "@/lib/sentry/lazy";

function fakeSentry() {
	return {
		init: vi.fn(),
		addBreadcrumb: vi.fn(),
		captureException: vi.fn(),
	};
}

function setup() {
	const sdk = fakeSentry();
	const load = vi.fn(async () => sdk as unknown as SentryFunctions);
	const options = vi.fn(() => ({ dsn: undefined, enabled: false }));
	const sentry = createLazySentry({ load, options });
	return { sdk, load, options, sentry };
}

function rejection(reason: unknown) {
	return Object.assign(new Event("unhandledrejection"), { reason });
}

describe("createLazySentry（ADR 0026）", () => {
	it("作っただけでは SDK を読み込まない", () => {
		const { load, sentry } = setup();
		sentry.captureEarlyErrors(new EventTarget() as unknown as Window);
		expect(load).not.toHaveBeenCalled();
	});

	it("読み込みと初期化は 1 回だけ（決定 1）", async () => {
		const { sdk, load, sentry } = setup();
		await Promise.all([sentry.start(), sentry.start()]);
		await sentry.start();
		expect(load).toHaveBeenCalledTimes(1);
		expect(sdk.init).toHaveBeenCalledTimes(1);
	});

	it("初期化の前にパンくずを渡されたら、読み込んで初期化してから渡す（決定 3）", async () => {
		const { sdk, load, sentry } = setup();
		const crumb = { category: "merge", message: "files_added" };
		sentry.addBreadcrumb(crumb);
		await vi.waitFor(() => expect(sdk.addBreadcrumb).toHaveBeenCalledWith(crumb));
		expect(load).toHaveBeenCalledTimes(1);
		expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(sdk.addBreadcrumb.mock.invocationCallOrder[0]);
	});

	it("初期化の前に captureException を呼ばれたら、初期化してから送る（決定 3）", async () => {
		const { sdk, sentry } = setup();
		const error = new Error("unexpected");
		sentry.captureException(error);
		await vi.waitFor(() => expect(sdk.captureException).toHaveBeenCalledWith(error));
		expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(sdk.captureException.mock.invocationCallOrder[0]);
	});

	it("初期化の前に起きたエラーをためておき、初期化したら送る（決定 2）", async () => {
		const { sdk, sentry } = setup();
		const target = new EventTarget();
		sentry.captureEarlyErrors(target as unknown as Window);
		const thrown = new Error("before load");
		target.dispatchEvent(new ErrorEvent("error", { error: thrown, message: thrown.message }));
		target.dispatchEvent(rejection("rejected before load"));
		expect(sdk.captureException).not.toHaveBeenCalled();

		await sentry.start();

		expect(sdk.captureException.mock.calls).toEqual([[thrown], ["rejected before load"]]);
		expect(sdk.init.mock.invocationCallOrder[0]).toBeLessThan(sdk.captureException.mock.invocationCallOrder[0]);
	});

	it("初期化したあとは受け口を外し、同じエラーを 2 回送らない（決定 2）", async () => {
		const { sdk, sentry } = setup();
		const target = new EventTarget();
		sentry.captureEarlyErrors(target as unknown as Window);
		await sentry.start();

		target.dispatchEvent(new ErrorEvent("error", { error: new Error("after load") }));
		target.dispatchEvent(rejection("after load"));
		await sentry.start();

		expect(sdk.captureException).not.toHaveBeenCalled();
	});

	it(`ためておくのは ${MAX_EARLY_ERRORS} 件まで`, async () => {
		const { sdk, sentry } = setup();
		const target = new EventTarget();
		sentry.captureEarlyErrors(target as unknown as Window);
		for (let i = 0; i < MAX_EARLY_ERRORS + 5; i++) {
			target.dispatchEvent(new ErrorEvent("error", { error: new Error(`error ${i}`) }));
		}
		await sentry.start();
		expect(sdk.captureException).toHaveBeenCalledTimes(MAX_EARLY_ERRORS);
	});

	it("SDK を読み込めなかったときは、何もしない（例外にしない）", async () => {
		const load = vi.fn(async (): Promise<SentryFunctions> => {
			throw new Error("ChunkLoadError");
		});
		const sentry = createLazySentry({ load, options: () => ({}) });
		await expect(sentry.start()).resolves.toBeUndefined();
		sentry.addBreadcrumb({ message: "files_added" });
		sentry.captureException(new Error("x"));
		await sentry.start();
		expect(load).toHaveBeenCalledTimes(1);
	});
});

describe("runAfterLoad（ADR 0026 決定 1）", () => {
	function fakeWindow(readyState: DocumentReadyState) {
		return {
			document: { readyState },
			setTimeout: vi.fn(),
			addEventListener: vi.fn(),
		};
	}

	it("load が済んでいれば、次のタスクで呼ぶ", () => {
		const win = fakeWindow("complete");
		const run = vi.fn();
		runAfterLoad(run, win as unknown as Window);
		expect(win.setTimeout).toHaveBeenCalledWith(run, 0);
		expect(win.addEventListener).not.toHaveBeenCalled();
	});

	it("load の前なら、load を待ってから次のタスクで呼ぶ", () => {
		const win = fakeWindow("interactive");
		const run = vi.fn();
		runAfterLoad(run, win as unknown as Window);
		expect(win.setTimeout).not.toHaveBeenCalled();
		expect(win.addEventListener).toHaveBeenCalledWith("load", expect.any(Function), { once: true });

		const onLoad = win.addEventListener.mock.calls[0][1] as () => void;
		onLoad();
		expect(win.setTimeout).toHaveBeenCalledWith(run, 0);
	});
});

describe("@sentry/nextjs を直接 import しない（ADR 0026 決定 4）", () => {
	const root = resolve(__dirname, "../..");
	const source = 'import * as Sentry from "@sentry/nextjs";\nexport const capture = Sentry.captureException;\n';

	// リポジトリの biome.json を一時ディレクトリに写し、指定したパスに置いたソースを Biome で検査する。通れば ok。
	// 標準入力（--stdin-file-path）では lint の診断が出ないので、ファイルに書いて検査する
	function lint(path: string): { ok: boolean; output: string } {
		const dir = mkdtempSync(join(tmpdir(), "biome-probe-"));
		try {
			copyFileSync(resolve(root, "biome.json"), join(dir, "biome.json"));
			mkdirSync(dirname(join(dir, path)), { recursive: true });
			writeFileSync(join(dir, path), source);
			execFileSync(resolve(root, "node_modules/.bin/biome"), ["lint", "--vcs-enabled=false", path], {
				cwd: dir,
				stdio: "pipe",
			});
			return { ok: true, output: "" };
		} catch (error) {
			const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
			return { ok: false, output: `${stdout ?? ""}${stderr ?? ""}` };
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}

	it.each([
		"components/probe.tsx",
		"hooks/probe.ts",
		"app/probe.tsx",
		"lib/analytics/probe.ts",
		"instrumentation-client.ts",
	])("ブラウザ側のファイル（%s）では lint が失敗する", (path) => {
		const result = lint(path);
		expect(result.ok).toBe(false);
		expect(result.output).toContain("noRestrictedImports");
	});

	it.each(["lib/sentry/client.ts", "sentry.server.config.ts", "sentry.edge.config.ts"])(
		"SDK を書き出すファイルとサーバーの設定（%s）では使える",
		(path) => {
			expect(lint(path)).toEqual({ ok: true, output: "" });
		},
	);
});
