import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { hasPdfHeader, mergePdfs } from "@/lib/pdf/merge";
import {
	createCorruptPdf,
	createEncryptedPdf,
	createPdf,
	createTextFile,
	toArrayBuffer,
} from "@/tests/utils/pdf-fixtures";

// ブラウザでの結合の純粋な関数（ADR 0002 決定 1・4、ADR 0030 決定 2）

async function input(id: string, bytes: Uint8Array | Promise<Uint8Array>) {
	return { id, bytes: toArrayBuffer(await bytes) };
}

async function pageWidths(bytes: Uint8Array | null) {
	if (!bytes) throw new Error("結合した PDF がない");
	const pdf = await PDFDocument.load(bytes);
	return pdf.getPages().map((page) => page.getWidth());
}

describe("hasPdfHeader", () => {
	it("先頭に %PDF- があれば PDF とみなす", () => {
		expect(hasPdfHeader(toArrayBuffer(new TextEncoder().encode("%PDF-1.7\n")))).toBe(true);
	});

	it("先頭 1024 バイトの中なら、前に別のバイトがあってもよい（PDF の仕様）", () => {
		const bytes = new TextEncoder().encode(`${" ".repeat(1000)}%PDF-1.4\n`);
		expect(hasPdfHeader(toArrayBuffer(bytes))).toBe(true);
	});

	it("拡張子が .pdf でも、中身がテキストなら PDF ではない（B-8）", () => {
		expect(hasPdfHeader(toArrayBuffer(createTextFile()))).toBe(false);
	});

	it("1024 バイトより後ろにしかないものは PDF ではない", () => {
		const bytes = new TextEncoder().encode(`${" ".repeat(1024)}%PDF-1.4\n`);
		expect(hasPdfHeader(toArrayBuffer(bytes))).toBe(false);
	});

	it("空のファイルは PDF ではない", () => {
		expect(hasPdfHeader(new ArrayBuffer(0))).toBe(false);
	});
});

describe("mergePdfs", () => {
	it("並び順どおりに、すべてのページを結合する", async () => {
		const { bytes, skipped } = await mergePdfs([
			await input("b", createPdf({ width: 200, pages: 2 })),
			await input("a", createPdf({ width: 100 })),
		]);

		expect(await pageWidths(bytes)).toEqual([200, 200, 100]);
		expect(skipped).toEqual([]);
	});

	it("1 ファイル終えるごとに進捗を返す（決定 2）", async () => {
		const onProgress = vi.fn();
		await mergePdfs(
			[await input("a", createPdf()), await input("b", createEncryptedPdf()), await input("c", createPdf())],
			onProgress,
		);

		expect(onProgress.mock.calls).toEqual([
			[1, 3],
			[2, 3],
			[3, 3],
		]);
	});

	it("パスワード付き・壊れたもの・中身がテキストのものを飛ばし、残りで結合する（決定 4・ADR 0030 決定 2）", async () => {
		const { bytes, skipped } = await mergePdfs([
			await input("ok-1", createPdf({ width: 100 })),
			await input("encrypted", createEncryptedPdf()),
			await input("corrupt", createCorruptPdf()),
			await input("text", createTextFile()),
			await input("ok-2", createPdf({ width: 200 })),
		]);

		expect(await pageWidths(bytes)).toEqual([100, 200]);
		expect(skipped).toEqual([
			{ id: "encrypted", reason: "encrypted" },
			{ id: "corrupt", reason: "corrupt" },
			{ id: "text", reason: "corrupt" },
		]);
	});

	it("PDF として読めても、ページが 1 つもなければ読めなかったものとして飛ばす", async () => {
		// pdf-lib は既定ではページがないと 1 ページ足して保存するので、足さないようにする
		const empty = await (await PDFDocument.create()).save({ addDefaultPage: false });

		const { bytes, skipped } = await mergePdfs([await input("empty", empty), await input("ok", createPdf())]);

		expect(await pageWidths(bytes)).toEqual([595]);
		expect(skipped).toEqual([{ id: "empty", reason: "corrupt" }]);
	});

	it("読めるファイルが 1 つもなければ、結合した PDF を返さない", async () => {
		const { bytes, skipped } = await mergePdfs([
			await input("encrypted", createEncryptedPdf()),
			await input("text", createTextFile()),
		]);

		expect(bytes).toBeNull();
		expect(skipped.map((file) => file.id)).toEqual(["encrypted", "text"]);
	});

	it("ページのコピーに失敗したファイルだけを飛ばす", async () => {
		const copyPages = vi.spyOn(PDFDocument.prototype, "copyPages").mockRejectedValueOnce(new Error("broken page"));

		const { bytes, skipped } = await mergePdfs([
			await input("broken", createPdf({ width: 100 })),
			await input("ok", createPdf({ width: 200 })),
		]);
		copyPages.mockRestore();

		expect(await pageWidths(bytes)).toEqual([200]);
		expect(skipped).toEqual([{ id: "broken", reason: "corrupt" }]);
	});

	it("何も渡さなければ、結合した PDF を返さない", async () => {
		expect(await mergePdfs([])).toEqual({ bytes: null, skipped: [] });
	});
});
