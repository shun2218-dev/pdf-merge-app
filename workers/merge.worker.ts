import { mergePdfs } from "@/lib/pdf/merge";
import { isOutOfMemory, type MergeWorkerRequest, type MergeWorkerResponse } from "@/lib/pdf/worker-messages";

// 結合の Worker（ADR 0002 決定 2）。pdf-lib はここでだけ読み込み、ページの最初の読み込みに入れない（ADR 0030 決定 1）。
// プロジェクトの型は DOM なので、self はページの Window の型になる。Worker の postMessage の形に合わせて使う
const worker = self as unknown as {
	postMessage(message: MergeWorkerResponse, transfer: Transferable[]): void;
	onmessage: ((event: MessageEvent<MergeWorkerRequest>) => void) | null;
};

worker.onmessage = async (event) => {
	try {
		const { bytes, skipped } = await mergePdfs(event.data.files, (done, total) =>
			worker.postMessage({ type: "progress", done, total }, []),
		);
		// 結合した PDF はコピーせずにページへ渡す
		worker.postMessage({ type: "done", bytes, skipped }, bytes ? [bytes.buffer] : []);
	} catch (error: unknown) {
		const { name, message } = error instanceof Error ? error : new Error(String(error));
		worker.postMessage(
			{ type: "error", reason: isOutOfMemory(error) ? "out_of_memory" : "worker_error", name, message },
			[],
		);
	}
};
