import { PDFDocument } from "pdf-lib";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MergeWorkerError, mergeInBrowser } from "@/lib/pdf/merge-in-browser";
import type { MergeWorkerRequest, MergeWorkerResponse } from "@/lib/pdf/worker-messages";
import { isOutOfMemory } from "@/lib/pdf/worker-messages";
import { createEncryptedPdf, createPdf } from "@/tests/utils/pdf-fixtures";

// ページの側から結合を呼ぶ窓口（ADR 0002 決定 2）

const pdfFile = async (name: string, width: number) =>
	new File([(await createPdf({ width })) as BlobPart], name, { type: "application/pdf" });

// Worker の代わり。受け取ったメッセージと渡されたもの（transfer）を残し、決めた返事を返す
class FakeWorker {
	static instances: FakeWorker[] = [];
	static respond: (worker: FakeWorker, request: MergeWorkerRequest) => void = () => {};

	onmessage: ((event: MessageEvent<MergeWorkerResponse>) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	onmessageerror: (() => void) | null = null;
	terminate = vi.fn();
	transfer: Transferable[] = [];

	constructor(
		readonly url: URL,
		readonly options: WorkerOptions,
	) {
		FakeWorker.instances.push(this);
	}

	postMessage(request: MergeWorkerRequest, transfer: Transferable[]) {
		this.transfer = transfer;
		queueMicrotask(() => FakeWorker.respond(this, request));
	}

	reply(message: MergeWorkerResponse) {
		this.onmessage?.({ data: message } as MessageEvent<MergeWorkerResponse>);
	}
}

// jsdom の File には arrayBuffer() がないので、FileReader で補う（ブラウザにはある）
beforeAll(() => {
	if (typeof File.prototype.arrayBuffer === "function") return;
	File.prototype.arrayBuffer = function (this: File) {
		return new Promise<ArrayBuffer>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(this);
		});
	};
});

afterEach(() => {
	vi.unstubAllGlobals();
	FakeWorker.instances = [];
});

describe("mergeInBrowser", () => {
	describe("Worker があるとき", () => {
		it("モジュールの Worker を作り、ファイルの中身をコピーせずに渡す", async () => {
			vi.stubGlobal("Worker", FakeWorker);
			FakeWorker.respond = (worker) => worker.reply({ type: "done", bytes: new Uint8Array([1]), skipped: [] });

			await mergeInBrowser([{ id: "a", file: await pdfFile("a.pdf", 100) }]);

			const [worker] = FakeWorker.instances;
			expect(worker.url.pathname).toMatch(/workers\/merge\.worker\.ts$/);
			expect(worker.options).toEqual({ type: "module" });
			expect(worker.transfer).toHaveLength(1);
			expect(worker.transfer[0]).toBeInstanceOf(ArrayBuffer);
		});

		it("Worker にファイル名を渡さない（id と中身だけ）", async () => {
			vi.stubGlobal("Worker", FakeWorker);
			let received: MergeWorkerRequest | undefined;
			FakeWorker.respond = (worker, request) => {
				received = request;
				worker.reply({ type: "done", bytes: null, skipped: [] });
			};

			await mergeInBrowser([{ id: "a", file: await pdfFile("2026_源泉徴収票.pdf", 100) }]);

			expect(received?.files.map((file) => Object.keys(file).sort())).toEqual([["bytes", "id"]]);
		});

		it("進捗を伝え、結果を返し、Worker を閉じる", async () => {
			vi.stubGlobal("Worker", FakeWorker);
			FakeWorker.respond = (worker) => {
				worker.reply({ type: "progress", done: 1, total: 2 });
				worker.reply({ type: "progress", done: 2, total: 2 });
				worker.reply({ type: "done", bytes: new Uint8Array([1, 2]), skipped: [{ id: "b", reason: "corrupt" }] });
			};
			const onProgress = vi.fn();

			const output = await mergeInBrowser(
				[
					{ id: "a", file: await pdfFile("a.pdf", 100) },
					{ id: "b", file: await pdfFile("b.pdf", 200) },
				],
				onProgress,
			);

			expect(onProgress.mock.calls).toEqual([
				[1, 2],
				[2, 2],
			]);
			expect(output).toEqual({ bytes: new Uint8Array([1, 2]), skipped: [{ id: "b", reason: "corrupt" }] });
			expect(FakeWorker.instances[0].terminate).toHaveBeenCalled();
		});

		it("Worker が失敗を返したら、理由を持った MergeWorkerError にする", async () => {
			vi.stubGlobal("Worker", FakeWorker);
			FakeWorker.respond = (worker) =>
				worker.reply({
					type: "error",
					reason: "out_of_memory",
					name: "RangeError",
					message: "Array buffer allocation failed",
				});

			const error = await mergeInBrowser([{ id: "a", file: await pdfFile("a.pdf", 100) }]).catch((e) => e);

			expect(error).toBeInstanceOf(MergeWorkerError);
			expect(error).toMatchObject({ reason: "out_of_memory", name: "RangeError" });
			expect(FakeWorker.instances[0].terminate).toHaveBeenCalled();
		});

		it("Worker のスクリプトが動かなかったら worker_error にする", async () => {
			vi.stubGlobal("Worker", FakeWorker);
			FakeWorker.respond = (worker) =>
				worker.onerror?.({ message: "", preventDefault: vi.fn() } as unknown as ErrorEvent);

			const error = await mergeInBrowser([{ id: "a", file: await pdfFile("a.pdf", 100) }]).catch((e) => e);

			expect(error).toMatchObject({ reason: "worker_error", message: "Worker failed" });
		});

		it("Worker からのメッセージを復元できなかったら worker_error にする", async () => {
			vi.stubGlobal("Worker", FakeWorker);
			FakeWorker.respond = (worker) => worker.onmessageerror?.();

			const error = await mergeInBrowser([{ id: "a", file: await pdfFile("a.pdf", 100) }]).catch((e) => e);

			expect(error).toMatchObject({ reason: "worker_error" });
		});
	});

	describe("Worker を作れないとき（決定 2）", () => {
		it("Worker がなければ、メインスレッドで結合する", async () => {
			vi.stubGlobal("Worker", undefined);
			const onProgress = vi.fn();

			const { bytes, skipped } = await mergeInBrowser(
				[
					{ id: "b", file: await pdfFile("b.pdf", 200) },
					{ id: "x", file: new File([(await createEncryptedPdf()) as BlobPart], "x.pdf") },
					{ id: "a", file: await pdfFile("a.pdf", 100) },
				],
				onProgress,
			);

			const merged = await PDFDocument.load(bytes as Uint8Array);
			expect(merged.getPages().map((page) => page.getWidth())).toEqual([200, 100]);
			expect(skipped).toEqual([{ id: "x", reason: "encrypted" }]);
			expect(onProgress).toHaveBeenCalledTimes(3);
		});

		it("モジュールの Worker を作れなければ、メインスレッドで結合する", async () => {
			vi.stubGlobal(
				"Worker",
				class {
					constructor() {
						throw new TypeError("Module scripts are not supported");
					}
				},
			);

			const { bytes } = await mergeInBrowser([{ id: "a", file: await pdfFile("a.pdf", 100) }]);

			expect(bytes).not.toBeNull();
		});
	});
});

describe("isOutOfMemory", () => {
	it.each([
		[new RangeError("Array buffer allocation failed"), true],
		[new Error("Out of memory"), true],
		[new Error("Failed to parse PDF document"), false],
		["out of memory", false],
	])("%s → %s", (error, expected) => {
		expect(isOutOfMemory(error)).toBe(expected);
	});
});
