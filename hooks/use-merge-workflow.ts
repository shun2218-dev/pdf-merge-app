"use client";

import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { DOWNLOAD_FILE_NAME } from "@/constants";
import { countBucket, durationBucket, sizeBucket, totalSize, track } from "@/lib/analytics";
import { initialState, type MergeItem, mergeWorkflowReducer } from "@/lib/merge-workflow/reducer";

// 結合の状態と操作をまとめたフック（ADR 0005 決定 1）。画面ではこれを持つのは merge-workspace だけにする。
// 通信・URL の解放・アナリティクス（ADR 0011）・Sentry（ADR 0007）の副作用はここに置き、状態遷移は reducer に任せる
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
			track("files_rejected", { reason: "not_pdf", count_bucket: countBucket(rejected.length) });
			dispatch({ type: "reject", reason: "not_pdf" });
			return;
		}

		track("files_added", {
			source,
			count_bucket: countBucket(files.length),
			size_bucket: sizeBucket(totalSize(files)),
		});
		const items: MergeItem[] = files.map((file) => ({ id: crypto.randomUUID(), file }));
		dispatch({ type: "add", items });
	}, []);

	const removeFile = useCallback((id: string) => {
		track("file_removed", { remaining_bucket: countBucket(stateRef.current.items.length - 1) });
		dispatch({ type: "remove", id });
	}, []);

	const moveFile = useCallback((from: number, to: number) => {
		dispatch({ type: "move", from, to });
	}, []);

	// ドラッグを終えて、並びが変わっていたときに 1 回だけ呼ぶ
	const reorderEnded = useCallback(() => {
		track("files_reordered", { method: "pointer" });
	}, []);

	// 結合した PDF の URL を返す。結果があれば結合し直さない。呼び出し側は state ではなく、この戻り値を使う（B-1）
	const merge = useCallback(async (): Promise<string | null> => {
		const { items, result, phase } = stateRef.current;
		if (result) return result.url;
		if (items.length === 0 || phase === "merging") return null;

		const files = items.map((item) => item.file);
		const mergeProperties = { count_bucket: countBucket(files.length), size_bucket: sizeBucket(totalSize(files)) };
		const startedAt = performance.now();
		track("merge_started", mergeProperties);
		dispatch({ type: "merge_start" });

		try {
			const formData = new FormData();
			for (const file of files) {
				formData.append("files", file);
			}
			const response = await fetch("/api/merge-pdf", { method: "POST", body: formData });

			// サーバーが返した失敗（500 など）は、サーバー側の Sentry が記録するので、ここでは送らない。
			// 大きすぎるファイル（413）のように利用者の操作が原因のものも、エラーとしては送らない（ADR 0007 決定 4）
			if (!response.ok) {
				track("merge_failed", { reason: response.status === 413 ? "payload_too_large" : "server_error" });
				dispatch({ type: "merge_failure" });
				return null;
			}

			const url = URL.createObjectURL(await response.blob());
			track("merge_succeeded", { ...mergeProperties, duration_bucket: durationBucket(performance.now() - startedAt) });
			dispatch({ type: "merge_success", url });
			return url;
		} catch (error: unknown) {
			// 通信の失敗や想定外の例外は、コードの前提が崩れたものとして送る（ADR 0007 決定 4）
			track("merge_failed", { reason: "network_error" });
			Sentry.captureException(error);
			dispatch({ type: "merge_failure" });
			return null;
		}
	}, []);

	const openPreview = useCallback(async () => {
		const url = await merge();
		if (url) track("preview_opened", {});
	}, [merge]);

	// 結果がなければ結合を待ってから、得た結果でダウンロードする（決定 4・B-1）
	const download = useCallback(async () => {
		// 押した時点でプレビューを見ていたか。プレビューなしで押すと、結合の結果としてプレビューも開くため、先に読む
		const previewed = stateRef.current.phase === "done";
		const url = await merge();
		if (!url) return;

		track("download_clicked", { renamed: false, previewed });
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
		addFiles,
		removeFile,
		moveFile,
		reorderEnded,
		openPreview,
		download,
	};
}
