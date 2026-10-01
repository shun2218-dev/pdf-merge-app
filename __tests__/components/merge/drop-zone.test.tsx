import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropZone } from "@/components/merge/drop-zone";

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

describe("DropZone", () => {
	it("「ファイルを選択」を押すと、ファイルの選択を開く", async () => {
		render(<DropZone onFiles={vi.fn()} />);
		const input = screen.getByTestId("file-input");
		const click = vi.spyOn(input, "click");

		await userEvent.click(screen.getByRole("button", { name: "ファイルを選択" }));

		expect(click).toHaveBeenCalled();
	});

	it("選んだファイルを source: picker で渡し、選択を空に戻す", async () => {
		const onFiles = vi.fn();
		render(<DropZone onFiles={onFiles} />);
		const input = screen.getByTestId("file-input") as HTMLInputElement;
		const files = [pdf("a.pdf"), pdf("b.pdf")];

		await userEvent.upload(input, files);

		expect(onFiles).toHaveBeenCalledWith(files, "picker");
		expect(input.value).toBe("");
	});

	it("ドロップしたファイルを source: drop でそのまま渡す", () => {
		const onFiles = vi.fn();
		render(<DropZone onFiles={onFiles} />);
		const files = [pdf("a.pdf"), new File(["x"], "b.txt", { type: "text/plain" })];

		fireEvent.drop(screen.getByTestId("dropzone"), { dataTransfer: { files } });

		expect(onFiles).toHaveBeenCalledWith(files, "drop");
	});

	it("ドラッグ中は、ブラウザがファイルを開く既定の動きを止める", () => {
		render(<DropZone onFiles={vi.fn()} />);
		const event = fireEvent.dragOver(screen.getByTestId("dropzone"));
		expect(event).toBe(false);
	});

	it("エラーの文言を role=alert で出し、なければ出さない（ADR 0005 決定 7）", () => {
		const { rerender } = render(<DropZone onFiles={vi.fn()} />);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();

		rerender(<DropZone onFiles={vi.fn()} errorMessage="PDFファイルのみ選択してください" />);
		expect(screen.getByRole("alert")).toHaveTextContent("PDFファイルのみ選択してください");
	});
});
