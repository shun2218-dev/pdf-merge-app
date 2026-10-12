import { PDFDocument } from "pdf-lib";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MergeWorkerRequest, MergeWorkerResponse } from "@/lib/pdf/worker-messages";
import { createEncryptedPdf, createPdf, toArrayBuffer } from "@/tests/utils/pdf-fixtures";

// 結合の Worker（ADR 0002 決定 2）。テストでは self がページの window なので、postMessage を見張って動かす

const posted = vi.fn<(message: MergeWorkerResponse, transfer: Transferable[]) => void>();
let handle: (request: MergeWorkerRequest) => Promise<void>;

beforeAll(async () => {
	vi.spyOn(window, "postMessage").mockImplementation(posted as unknown as typeof window.postMessage);
	await import("@/workers/merge.worker");
	const onmessage = window.onmessage as unknown as (event: MessageEvent<MergeWorkerRequest>) => Promise<void>;
	handle = (request) => onmessage({ data: request } as MessageEvent<MergeWorkerRequest>);
});

afterEach(() => {
	posted.mockClear();
});

describe("merge.worker", () => {
	it("1 ファイルごとに進捗を返し、結合した PDF をコピーせずに返す", async () => {
		await handle({
			type: "merge",
			files: [
				{ id: "a", bytes: toArrayBuffer(await createPdf({ width: 100 })) },
				{ id: "x", bytes: toArrayBuffer(await createEncryptedPdf()) },
			],
		});

		const messages = posted.mock.calls.map(([message]) => message);
		expect(messages.slice(0, 2)).toEqual([
			{ type: "progress", done: 1, total: 2 },
			{ type: "progress", done: 2, total: 2 },
		]);
		const [done, transfer] = posted.mock.calls[2];
		expect(done).toMatchObject({ type: "done", skipped: [{ id: "x", reason: "encrypted" }] });
		if (done.type !== "done" || !done.bytes) throw new Error("結合した PDF がない");
		expect((await PDFDocument.load(done.bytes)).getPageCount()).toBe(1);
		expect(transfer).toEqual([done.bytes.buffer]);
	});

	it("読めるファイルがなければ、何も渡さずに bytes: null を返す", async () => {
		await handle({ type: "merge", files: [{ id: "x", bytes: toArrayBuffer(await createEncryptedPdf()) }] });

		const [done, transfer] = posted.mock.calls.at(-1) ?? [];
		expect(done).toEqual({ type: "done", bytes: null, skipped: [{ id: "x", reason: "encrypted" }] });
		expect(transfer).toEqual([]);
	});

	it("想定外の例外は worker_error、メモリ不足は out_of_memory として返す", async () => {
		const merge = await import("@/lib/pdf/merge");
		const spy = vi.spyOn(merge, "mergePdfs");

		spy.mockRejectedValueOnce(new TypeError("boom"));
		await handle({ type: "merge", files: [] });
		expect(posted.mock.calls.at(-1)?.[0]).toEqual({
			type: "error",
			reason: "worker_error",
			name: "TypeError",
			message: "boom",
		});

		spy.mockRejectedValueOnce(new RangeError("Array buffer allocation failed"));
		await handle({ type: "merge", files: [] });
		expect(posted.mock.calls.at(-1)?.[0]).toMatchObject({ type: "error", reason: "out_of_memory" });

		spy.mockRejectedValueOnce("not an error");
		await handle({ type: "merge", files: [] });
		expect(posted.mock.calls.at(-1)?.[0]).toMatchObject({
			type: "error",
			reason: "worker_error",
			message: "not an error",
		});
		spy.mockRestore();
	});
});
