// 結合の状態と、その遷移（ADR 0005 決定 1）。副作用を持たない純粋な関数にして、遷移をユニットテストする。
// いまの画面に要る分だけを持つ。ページ数・行ごとの印は、ADR 0009 でその機能と一緒に足す

import type { SkippedFile } from "@/lib/pdf/merge";

export type MergeItem = {
	/** 並び替えと React の key に使う（ADR 0005 決定 2）。同じ名前のファイルでも別の id になる */
	id: string;
	file: File;
};

export type MergePhase = "idle" | "merging" | "done" | "error";

/**
 * 画面に出すエラー。PDF 以外が混ざった（not_pdf）、結合に失敗した（merge_failed）、
 * 読めるファイルが 1 つもなかった（no_valid_files。ADR 0030 決定 2）
 */
export type MergeError = "not_pdf" | "merge_failed" | "no_valid_files";

export type MergeProgress = { done: number; total: number };

export type MergeState = {
	items: MergeItem[];
	phase: MergePhase;
	/** 結合した PDF。一覧が変わったら捨てる（URL の解放はフックで行う。決定 3） */
	result: { url: string } | null;
	error: MergeError | null;
	/** 結合している間の進捗。1 ファイル終えるごとに進む（ADR 0002 決定 2） */
	progress: MergeProgress | null;
	/** 結合のときに飛ばしたファイル（ADR 0030 決定 2）。一覧が変わったら捨てる */
	skipped: SkippedFile[];
};

export type MergeAction =
	| { type: "add"; items: MergeItem[] }
	| { type: "reject"; reason: "not_pdf" }
	| { type: "remove"; id: string }
	| { type: "move"; from: number; to: number }
	| { type: "merge_start" }
	| { type: "merge_progress"; progress: MergeProgress }
	| { type: "merge_success"; url: string; skipped: SkippedFile[] }
	| { type: "merge_failure"; error: "merge_failed" | "no_valid_files"; skipped?: SkippedFile[] };

export const initialState: MergeState = {
	items: [],
	phase: "idle",
	result: null,
	error: null,
	progress: null,
	skipped: [],
};

// 一覧が変わったら、結合の結果とエラーを捨てて、結合する前に戻す
function withItems(state: MergeState, items: MergeItem[]): MergeState {
	return { ...state, items, phase: "idle", result: null, error: null, progress: null, skipped: [] };
}

export function mergeWorkflowReducer(state: MergeState, action: MergeAction): MergeState {
	switch (action.type) {
		case "add":
			return withItems(state, [...state.items, ...action.items]);
		case "reject":
			// PDF 以外が混ざったときは、PDF も含めて全部を受け付けない（いまの振る舞い。見直しは ADR 0009）
			return { ...state, error: action.reason };
		case "remove": {
			if (!state.items.some((item) => item.id === action.id)) return state;
			return withItems(
				state,
				state.items.filter((item) => item.id !== action.id),
			);
		}
		case "move": {
			const { from, to } = action;
			const size = state.items.length;
			if (from === to || from < 0 || to < 0 || from >= size || to >= size) return state;
			const items = [...state.items];
			const [moved] = items.splice(from, 1);
			items.splice(to, 0, moved);
			return withItems(state, items);
		}
		case "merge_start":
			return { ...state, phase: "merging", result: null, error: null, progress: null, skipped: [] };
		case "merge_progress":
			if (state.phase !== "merging") return state;
			return { ...state, progress: action.progress };
		case "merge_success":
			return {
				...state,
				phase: "done",
				result: { url: action.url },
				error: null,
				progress: null,
				skipped: action.skipped,
			};
		case "merge_failure":
			return {
				...state,
				phase: "error",
				result: null,
				error: action.error,
				progress: null,
				skipped: action.skipped ?? [],
			};
	}
}
