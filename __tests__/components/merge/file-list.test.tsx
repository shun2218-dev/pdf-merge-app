import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileList } from "@/components/merge/file-list";
import type { MergeItem } from "@/lib/merge-workflow/reducer";

const item = (id: string, name: string, size = 1024): MergeItem => {
	const file = new File(["content"], name, { type: "application/pdf" });
	Object.defineProperty(file, "size", { value: size });
	return { id, file };
};

const items = [item("1", "test1.pdf", 1024), item("2", "test2.pdf", 2048), item("3", "test3.pdf", 1048576)];

function setup(list = items) {
	const props = { onMove: vi.fn(), onRemove: vi.fn(), onReorderEnd: vi.fn() };
	const view = render(<FileList items={list} {...props} />);
	const rows = Array.from(view.container.querySelectorAll<HTMLElement>('[draggable="true"]'));
	return { ...props, ...view, rows };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("FileList", () => {
	it("各ファイルの名前・大きさ・順番を表示する", () => {
		setup();
		for (const text of ["test1.pdf", "1.0 KB", "test2.pdf", "2.0 KB", "test3.pdf", "1.0 MB", "1", "2", "3"]) {
			expect(screen.getByText(text)).toBeInTheDocument();
		}
	});

	it("大きさを B / KB / MB で表示する", () => {
		setup([item("a", "small.pdf", 512), item("b", "large.pdf", 2097152)]);
		expect(screen.getByText("512 B")).toBeInTheDocument();
		expect(screen.getByText("2.0 MB")).toBeInTheDocument();
	});

	it("削除ボタンを押すと、その行の id で onRemove を呼ぶ", () => {
		const { onRemove } = setup();
		fireEvent.click(screen.getAllByRole("button", { name: "削除する" })[1]);
		expect(onRemove).toHaveBeenCalledWith("2");
	});

	it("ドラッグしている行を薄くし、終えたら戻す", () => {
		const { rows } = setup();
		fireEvent.dragStart(rows[0]);
		expect(rows[0]).toHaveClass("opacity-50");
		fireEvent.dragEnd(rows[0]);
		expect(rows[0]).toHaveClass("opacity-100");
	});

	it("ほかの行の上にドラッグすると onMove を呼び、同じ行の上では呼ばない", () => {
		const { rows, onMove } = setup();
		fireEvent.dragStart(rows[0]);
		fireEvent.dragOver(rows[0]);
		expect(onMove).not.toHaveBeenCalled();
		fireEvent.dragOver(rows[1]);
		expect(onMove).toHaveBeenCalledWith(0, 1);
	});

	it("並びが変わったドラッグでは、終えたときに onReorderEnd を 1 回だけ呼ぶ", () => {
		const { rows, onReorderEnd } = setup();
		fireEvent.dragStart(rows[0]);
		fireEvent.dragOver(rows[1]);
		fireEvent.dragOver(rows[2]);
		fireEvent.dragEnd(rows[2]);
		expect(onReorderEnd).toHaveBeenCalledTimes(1);
	});

	it("並びが変わらなかったドラッグでは onReorderEnd を呼ばない", () => {
		const { rows, onReorderEnd } = setup();
		fireEvent.dragStart(rows[0]);
		fireEvent.dragEnd(rows[0]);
		expect(onReorderEnd).not.toHaveBeenCalled();
	});

	it("並び替えても、同じファイルの行は同じ要素のまま動く（key に id を使う。B-6）", () => {
		// key が「ファイル名-位置」だと、並び替えのたびに key が変わり、React が行を作り直してしまう
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const same = [item("a", "same.pdf"), item("b", "same.pdf")];
		const { rerender, rows, onMove, onRemove } = setup(same);

		rerender(<FileList items={[same[1], same[0]]} onMove={onMove} onRemove={onRemove} />);

		const reordered = Array.from(document.querySelectorAll<HTMLElement>('[draggable="true"]'));
		expect(reordered[1]).toBe(rows[0]);
		expect(reordered[0]).toBe(rows[1]);
		expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/key/i);
	});

	it("空の一覧も描ける", () => {
		setup([]);
		expect(screen.getByTestId("file-list")).toBeEmptyDOMElement();
	});
});
