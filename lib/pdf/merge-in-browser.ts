import type { MergeInput, MergeOutput, MergeProgress } from "./merge";
import type { MergeWorkerFailure, MergeWorkerRequest, MergeWorkerResponse } from "./worker-messages";

// ページの側から結合を呼ぶ窓口（ADR 0002 決定 2）。PDF はどこにも送らず、この端末の中で結合する。
// Worker は結合を始めたときに作り、終わったら閉じる（ADR 0030 決定 1）。メモリも一緒に手放せる

/** Worker の中の失敗。理由はアナリティクスの merge_failed にそのまま使う */
export class MergeWorkerError extends Error {
	readonly reason: MergeWorkerFailure;

	constructor(reason: MergeWorkerFailure, message: string, name = "MergeWorkerError") {
		super(message);
		this.name = name;
		this.reason = reason;
	}
}

export type MergeFile = { id: string; file: File };

// Worker を作れない古いブラウザ（Worker がない・モジュールの Worker を作れない）では null
function createWorker(): Worker | null {
	if (typeof Worker === "undefined") return null;
	try {
		return new Worker(new URL("../../workers/merge.worker.ts", import.meta.url), { type: "module" });
	} catch {
		return null;
	}
}

function runInWorker(worker: Worker, files: MergeInput[], onProgress?: MergeProgress): Promise<MergeOutput> {
	return new Promise<MergeOutput>((resolve, reject) => {
		worker.onmessage = (event: MessageEvent<MergeWorkerResponse>) => {
			const message = event.data;
			if (message.type === "progress") {
				onProgress?.(message.done, message.total);
			} else if (message.type === "done") {
				resolve({ bytes: message.bytes, skipped: message.skipped });
			} else {
				reject(new MergeWorkerError(message.reason, message.message, message.name));
			}
		};
		// Worker のスクリプトを読み込めなかったときや、受け取ったメッセージを復元できなかったとき
		worker.onerror = (event) => {
			event.preventDefault();
			reject(new MergeWorkerError("worker_error", event.message || "Worker failed"));
		};
		worker.onmessageerror = () => reject(new MergeWorkerError("worker_error", "Worker message could not be read"));

		const request: MergeWorkerRequest = { type: "merge", files };
		// ArrayBuffer はコピーせずに Worker へ渡す（決定 2）
		worker.postMessage(
			request,
			files.map((file) => file.bytes),
		);
	}).finally(() => worker.terminate());
}

async function runOnMainThread(files: MergeInput[], onProgress?: MergeProgress): Promise<MergeOutput> {
	const { mergePdfs } = await import("./merge");
	return mergePdfs(files, onProgress);
}

/** 並び順どおりに結合する。Worker を作れない古いブラウザでは、メインスレッドで結合する（決定 2） */
export async function mergeInBrowser(files: readonly MergeFile[], onProgress?: MergeProgress): Promise<MergeOutput> {
	const inputs = await Promise.all(files.map(async ({ id, file }) => ({ id, bytes: await file.arrayBuffer() })));
	const worker = createWorker();
	return worker ? runInWorker(worker, inputs, onProgress) : runOnMainThread(inputs, onProgress);
}
