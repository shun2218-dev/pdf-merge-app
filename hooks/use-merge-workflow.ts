"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { DOWNLOAD_FILE_NAME } from "@/constants";
import { countBucket, durationBucket, sizeBucket, totalSize, track } from "@/lib/analytics";
import type { EventName, EventProperties } from "@/lib/analytics/events";
import { isLargeMerge } from "@/lib/merge-workflow/large-merge";
import { initialState, type MergeItem, mergeWorkflowReducer } from "@/lib/merge-workflow/reducer";
import type { SkippedFile, SkipReason } from "@/lib/pdf/merge";
import { MergeWorkerError, mergeInBrowser } from "@/lib/pdf/merge-in-browser";
import { sentry } from "@/lib/sentry/browser";

// 操作をアナリティクス（ADR 0011）に送り、同じ名前・同じ値で Sentry のパンくずにも残す（ADR 0024 決定 2）。
// エラーが起きたとき、その前の操作を順番どおりに読めるようにする。値は区間（バケット）だけで、ファイル名は入らない
function record<N extends EventName>(name: N, properties: EventProperties<N>) {
	track(name, properties);
	sentry.addBreadcrumb({
		category: "merge",
		message: name,
		data: properties,
		level: name === "merge_failed" ? "warning" : "info",
	});
}

// 結合のときに飛ばしたファイルを、理由ごとの数で送る（ADR 0030 決定 3）。名前は送らない
function recordSkipped(skipped: SkippedFile[]) {
	const reasons: SkipReason[] = ["encrypted", "corrupt"];
	for (const reason of reasons) {
		const count = skipped.filter((file) => file.reason === reason).length;
		if (count > 0) record("files_rejected", { reason, count_bucket: countBucket(count) });
	}
}

// 結合の状態と操作をまとめたフック（ADR 0005 決定 1）。画面ではこれを持つのは merge-workspace だけにする。
// 結合・URL の解放・アナリティクス（ADR 0011）・Sentry（ADR 0007）の副作用はここに置き、状態遷移は reducer に任せる
export function useMergeWorkflow() {
	const [state, dispatch] = useReducer(mergeWorkflowReducer, initialState);

	// 非同期の操作の途中でも、最新の状態を読む（setState の直後の state は古いレンダーの値のため。B-1）
	const stateRef = useRef(state);
	stateRef.current = state;

	// 結果が捨てられたとき（一覧の変更・次の結合）とアンマウントのときに、前の URL を解放する（決定 3・B-5）
	const resultUrl = state.result?.url;
	useEffect(() => {
		if (!resultUrl) return;
		return () => URL.revokeObjectURL(resultUrl);
	}, [resultUrl]);

	const addFiles = useCallback((files: File[], source: "picker" | "drop") => {
		if (files.length === 0) return;

		// PDF 以外を選んだのは利用者の操作の結果で、コードの不具合ではないので Sentry には送らない（ADR 0007 決定 4）
		const rejected = files.filter((file) => file.type !== "application/pdf");
		if (rejected.length > 0) {
			record("files_rejected", { reason: "not_pdf", count_bucket: countBucket(rejected.length) });
			dispatch({ type: "reject", reason: "not_pdf" });
			return;
		}

		record("files_added", {
			source,
			count_bucket: countBucket(files.length),
			size_bucket: sizeBucket(totalSize(files)),
		});
		const items: MergeItem[] = files.map((file) => ({ id: crypto.randomUUID(), file }));
		// 足したことで、時間がかかるか失敗しうる大きさを超えたら、警告を出したことを送る（ADR 0002 決定 5）
		const before = stateRef.current.items.map((item) => item.file);
		const after = [...before, ...files];
		if (!isLargeMerge(before) && isLargeMerge(after)) {
			record("size_warning_shown", { size_bucket: sizeBucket(totalSize(after)) });
		}
		dispatch({ type: "add", items });
	}, []);

	const removeFile = useCallback((id: string) => {
		record("file_removed", { remaining_bucket: countBucket(stateRef.current.items.length - 1) });
		dispatch({ type: "remove", id });
	}, []);

	const moveFile = useCallback((from: number, to: number) => {
		dispatch({ type: "move", from, to });
	}, []);

	// ドラッグを終えて、並びが変わっていたときに 1 回だけ呼ぶ
	const reorderEnded = useCallback(() => {
		record("files_reordered", { method: "pointer" });
	}, []);

	// 結合した PDF の URL を返す。結果があれば結合し直さない。呼び出し側は state ではなく、この戻り値を使う（B-1）
	const merge = useCallback(async (): Promise<string | null> => {
		const { items, result, phase } = stateRef.current;
		if (result) return result.url;
		if (items.length === 0 || phase === "merging") return null;

		const files = items.map((item) => item.file);
		const mergeProperties = { count_bucket: countBucket(files.length), size_bucket: sizeBucket(totalSize(files)) };
		const startedAt = performance.now();
		record("merge_started", mergeProperties);
		dispatch({ type: "merge_start" });

		try {
			// PDF はサーバーへ送らず、この端末の中で結合する（ADR 0002）
			const { bytes, skipped } = await mergeInBrowser(items, (done, total) =>
				dispatch({ type: "merge_progress", progress: { done, total } }),
			);
			recordSkipped(skipped);

			// パスワード付き・壊れたファイルは利用者の手元のファイルの問題なので、Sentry には送らない（ADR 0007 決定 4）
			if (!bytes) {
				record("merge_failed", { reason: "no_valid_files" });
				dispatch({ type: "merge_failure", error: "no_valid_files", skipped });
				return null;
			}

			const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
			record("merge_succeeded", { ...mergeProperties, duration_bucket: durationBucket(performance.now() - startedAt) });
			dispatch({ type: "merge_success", url, skipped });
			return url;
		} catch (error: unknown) {
			// メモリ不足は端末の限界なので送らない。Worker の失敗と想定外の例外は、コードの前提が崩れたものとして送る
			// （ADR 0007 決定 4・ADR 0030 決定 5）
			const reason = error instanceof MergeWorkerError ? error.reason : "unknown";
			record("merge_failed", { reason });
			if (reason !== "out_of_memory") sentry.captureException(error);
			dispatch({ type: "merge_failure", error: "merge_failed" });
			return null;
		}
	}, []);

	const openPreview = useCallback(async () => {
		const url = await merge();
		if (url) record("preview_opened", {});
	}, [merge]);

	// 結果がなければ結合を待ってから、得た結果でダウンロードする（決定 4・B-1）
	const download = useCallback(async () => {
		// 押した時点でプレビューを見ていたか。プレビューなしで押すと、結合の結果としてプレビューも開くため、先に読む
		const previewed = stateRef.current.phase === "done";
		const url = await merge();
		if (!url) return;

		record("download_clicked", { renamed: false, previewed });
		const link = document.createElement("a");
		link.href = url;
		link.download = DOWNLOAD_FILE_NAME;
		link.click();
	}, [merge]);

	return {
		items: state.items,
		phase: state.phase,
		result: state.result,
		error: state.error,
		progress: state.progress,
		skipped: state.skipped,
		addFiles,
		removeFile,
		moveFile,
		reorderEnded,
		openPreview,
		download,
	};
}
