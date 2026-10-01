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
};

describe("mergeWorkflowReducer", () => {
	it("初期状態は空で、結合していない", () => {
		expect(initialState).toEqual({ items: [], phase: "idle", result: null, error: null });
	});

	describe("add", () => {
		it("渡した順に末尾へ足す", () => {
			const state = mergeWorkflowReducer(
				{ ...initialState, items: [item("a")] },
				{ type: "add", items: [item("b"), item("c")] },
			);
			expect(state.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
		});

		it("結合の結果とエラーを捨てる（一覧が変わったので）", () => {
			const state = mergeWorkflowReducer({ ...done, error: "not_pdf" }, { type: "add", items: [item("d")] });
			expect(state).toMatchObject({ phase: "idle", result: null, error: null });
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

		it("merge_success で結果を持つ", () => {
			const merging = mergeWorkflowReducer({ ...initialState, items: [item("a")] }, { type: "merge_start" });
			const state = mergeWorkflowReducer(merging, { type: "merge_success", url: "blob:x" });
			expect(state).toMatchObject({ phase: "done", result: { url: "blob:x" }, error: null });
		});

		it("merge_failure でエラーになる", () => {
			const merging = mergeWorkflowReducer({ ...initialState, items: [item("a")] }, { type: "merge_start" });
			const state = mergeWorkflowReducer(merging, { type: "merge_failure" });
			expect(state).toMatchObject({ phase: "error", result: null, error: "merge_failed" });
		});
	});
});
