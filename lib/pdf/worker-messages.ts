import type { MergeInput, SkippedFile } from "./merge";

// ページと結合の Worker（workers/merge.worker.ts）のあいだのメッセージ（ADR 0002 決定 2）。
// ファイル名は Worker に渡さない。飛ばしたファイルは id で返し、名前に戻すのはページの側で行う

export type MergeWorkerRequest = { type: "merge"; files: MergeInput[] };

/** Worker の中で起きた失敗。端末のメモリが足りない（out_of_memory）と、それ以外（worker_error） */
export type MergeWorkerFailure = "out_of_memory" | "worker_error";

export type MergeWorkerResponse =
	| { type: "progress"; done: number; total: number }
	| { type: "done"; bytes: Uint8Array | null; skipped: SkippedFile[] }
	| { type: "error"; reason: MergeWorkerFailure; name: string; message: string };

/** 配列の確保の失敗など、端末のメモリが足りないときの例外か */
export function isOutOfMemory(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return error instanceof RangeError || /out of memory|allocation failed/i.test(error.message);
}
