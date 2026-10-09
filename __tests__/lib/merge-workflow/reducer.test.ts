import { describe, expect, it } from "vitest";
import { initialState, type MergeState, mergeWorkflowReducer } from "@/lib/merge-workflow/reducer";

// 結合の状態遷移（ADR 0005 決定 1）

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });
const item = (id: string, name = `${id}.pdf`) => ({ id, file: pdf(name) });

const done: MergeState = {
	items: [item("a"), item("b"), item("c")],
	phase: "done",
	result: { url: "blob:merged" },
	error: null,
	progress: null,
	skipped: [{ id: "c", reason: "encrypted" }],
};

describe("mergeWorkflowReducer", () => {
	it("初期状態は空で、結合していない", () => {
		expect(initialState).toEqual({ items: [], phase: "idle", result: null, error: null, progress: null, skipped: [] });
	});

	describe("add", () => {
		it("渡した順に末尾へ足す", () => {
			const state = mergeWorkflowReducer(
				{ ...initialState, items: [item("a")] },
				{ type: "add", items: [item("b"), item("c")] },
			);
			expect(state.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
		});

		it("結合の結果・エラー・飛ばしたファイルを捨てる（一覧が変わったので）", () => {
			const state = mergeWorkflowReducer({ ...done, error: "not_pdf" }, { type: "add", items: [item("d")] });
			expect(state).toMatchObject({ phase: "idle", result: null, error: null, skipped: [] });
		});
	});

	describe("reject", () => {
		it("一覧は変えず、エラーだけを持つ（PDF 以外が混ざったときは全部を受け付けない）", () => {
			const state = mergeWorkflowReducer(done, { type: "reject", reason: "not_pdf" });
			expect(state.items).toBe(done.items);
			expect(state.result).toEqual(done.result);
			expect(state.error).toBe("not_pdf");
		});
	});

	describe("remove", () => {
		it("id で消し、結果を捨てる", () => {
			const state = mergeWorkflowReducer(done, { type: "remove", id: "b" });
			expect(state.items.map((i) => i.id)).toEqual(["a", "c"]);
			expect(state).toMatchObject({ phase: "idle", result: null, error: null });
		});

		it("ない id なら何も変えない", () => {
			expect(mergeWorkflowReducer(done, { type: "remove", id: "x" })).toBe(done);
		});
	});

	describe("move", () => {
		it("from の位置のものを to の位置へ移し、結果を捨てる", () => {
			const state = mergeWorkflowReducer(done, { type: "move", from: 0, to: 2 });
			expect(state.items.map((i) => i.id)).toEqual(["b", "c", "a"]);
			expect(state).toMatchObject({ phase: "idle", result: null });
		});

		it("同じ位置や範囲外なら何も変えない", () => {
			expect(mergeWorkflowReducer(done, { type: "move", from: 1, to: 1 })).toBe(done);
			expect(mergeWorkflowReducer(done, { type: "move", from: -1, to: 1 })).toBe(done);
			expect(mergeWorkflowReducer(done, { type: "move", from: 0, to: 3 })).toBe(done);
		});
	});

	describe("結合", () => {
		it("merge_start で結合中になり、前のエラーを消す", () => {
			const state = mergeWorkflowReducer(
				{ ...initialState, items: [item("a")], error: "merge_failed", phase: "error" },
				{ type: "merge_start" },
			);
			expect(state).toMatchObject({ phase: "merging", error: null, result: null });
		});

		it("merge_start で前に飛ばしたファイルを捨てる", () => {
			const state = mergeWorkflowReducer(done, { type: "merge_start" });
			expect(state).toMatchObject({ phase: "merging", skipped: [], progress: null });
		});

		it("merge_progress で進捗を持つ（ADR 0002 決定 2）", () => {
			const merging = mergeWorkflowReducer({ ...initialState, items: [item("a"), item("b")] }, { type: "merge_start" });
			const state = mergeWorkflowReducer(merging, { type: "merge_progress", progress: { done: 1, total: 2 } });
			expect(state.progress).toEqual({ done: 1, total: 2 });
		});

		it("結合していないときの merge_progress は何も変えない（終わったあとに遅れて届いたもの）", () => {
			expect(mergeWorkflowReducer(done, { type: "merge_progress", progress: { done: 1, total: 2 } })).toBe(done);
		});

		it("merge_success で結果と飛ばしたファイルを持ち、進捗を消す", () => {
			const merging = mergeWorkflowReducer({ ...initialState, items: [item("a"), item("b")] }, { type: "merge_start" });
			const progressed = mergeWorkflowReducer(merging, { type: "merge_progress", progress: { done: 2, total: 2 } });
			const state = mergeWorkflowReducer(progressed, {
				type: "merge_success",
				url: "blob:x",
				skipped: [{ id: "b", reason: "corrupt" }],
			});
			expect(state).toMatchObject({
				phase: "done",
				result: { url: "blob:x" },
				error: null,
				progress: null,
				skipped: [{ id: "b", reason: "corrupt" }],
			});
		});

		it("merge_failure でエラーになる", () => {
			const merging = mergeWorkflowReducer({ ...initialState, items: [item("a")] }, { type: "merge_start" });
			const state = mergeWorkflowReducer(merging, { type: "merge_failure", error: "merge_failed" });
			expect(state).toMatchObject({ phase: "error", result: null, error: "merge_failed", skipped: [] });
		});

		it("読めるファイルがなかったときは no_valid_files にし、飛ばしたファイルを持つ（ADR 0030 決定 2）", () => {
			const merging = mergeWorkflowReducer({ ...initialState, items: [item("a")] }, { type: "merge_start" });
			const state = mergeWorkflowReducer(merging, {
				type: "merge_failure",
				error: "no_valid_files",
				skipped: [{ id: "a", reason: "encrypted" }],
			});
			expect(state).toMatchObject({
				phase: "error",
				error: "no_valid_files",
				skipped: [{ id: "a", reason: "encrypted" }],
			});
		});
	});
});
