import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { sharedSentryOptions } from "@/lib/sentry/options";
import { FILE_PLACEHOLDER, scrubDeep, scrubFileNames } from "@/lib/sentry/scrub";

describe("scrubFileNames", () => {
	it.each([
		["2026_源泉徴収票_山田.pdf を読み込めません", "[file] を読み込めません"],
		["Failed: report.PDF", "Failed: [file]"],
		["https://example.com/files/contract-v2.pdf?x=1", "https://example.com/files/[file]?x=1"],
		["C:\\Users\\me\\請求書.pdf", "C:\\Users\\me\\[file]"],
		['"a.pdf", "b.pdf"', '"[file]", "[file]"'],
	])("%s", (input, expected) => {
		expect(scrubFileNames(input)).toBe(expected);
	});

	it.each(["PDFの結合中にエラーが発生しました", "application/pdf", "/api/merge-pdf", "merge.pdfium is not a file"])(
		"ファイル名でないものは変えない: %s",
		(input) => {
			expect(scrubFileNames(input)).toBe(input);
		},
	);
});

describe("scrubDeep", () => {
	it("イベントの中のどこにあるファイル名も置き換える", () => {
		const event = {
			message: "山田_履歴書.pdf の結合に失敗",
			exception: { values: [{ type: "Error", value: "Invalid PDF: 山田_履歴書.pdf" }] },
			breadcrumbs: [{ message: "added 山田_履歴書.pdf", data: { names: ["山田_履歴書.pdf"] } }],
			extra: { nested: { deeper: { name: "山田_履歴書.pdf" } } },
			timestamp: 1790000000,
			level: "error",
		};

		const serialized = JSON.stringify(scrubDeep(event));

		// ファイル名にしか現れない文字列が、どこにも残っていない（ADR 0007 の DoD）
		expect(serialized).not.toContain("山田_履歴書");
		expect(serialized).toContain(FILE_PLACEHOLDER);
	});

	it("文字列以外の値はそのまま残す", () => {
		const value = { count: 3, ok: true, none: null, list: [1, 2] };
		expect(scrubDeep(value)).toEqual(value);
	});

	it("元のオブジェクトを書き換えない", () => {
		const event = { message: "a.pdf" };
		scrubDeep(event);
		expect(event.message).toBe("a.pdf");
	});
});

describe("sharedSentryOptions", () => {
	it("DSN がないとき（ローカル・CI）は送信しない", () => {
		const options = sharedSentryOptions({});
		expect(options.enabled).toBe(false);
		expect(options.dsn).toBeUndefined();
		expect(options.environment).toBe("development");
	});

	it("DSN があるときは送信し、環境は Vercel の環境の名前にする", () => {
		const options = sharedSentryOptions({
			NEXT_PUBLIC_SENTRY_DSN: "https://public@o0.ingest.sentry.io/0",
			NEXT_PUBLIC_VERCEL_ENV: "production",
		});
		expect(options.enabled).toBe(true);
		expect(options.dsn).toBe("https://public@o0.ingest.sentry.io/0");
		expect(options.environment).toBe("production");
	});

	it("PII を送らず、トレースは使わない（ADR 0022）", () => {
		const options = sharedSentryOptions({});
		expect(options.sendDefaultPii).toBe(false);
		expect(options).not.toHaveProperty("tracesSampleRate");
		expect(options).not.toHaveProperty("tracesSampler");
	});

	it("送る前のイベントとパンくずからファイル名を取り除く", () => {
		const options = sharedSentryOptions({});

		const event = options.beforeSend({ message: "secret.pdf" } as ErrorEvent);
		expect(event.message).toBe(FILE_PLACEHOLDER);

		const breadcrumb = options.beforeBreadcrumb({ message: "secret.pdf" } as Breadcrumb);
		expect(breadcrumb.message).toBe(FILE_PLACEHOLDER);
	});
});
