import type { Meta, StoryObj } from "@storybook/react";
import { createEvent, expect, fireEvent, fn, spyOn, userEvent, within } from "storybook/test";
import { DropZone } from "./drop-zone";

const meta = {
	title: "Merge/DropZone",
	component: DropZone,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		onFiles: fn(),
	},
} satisfies Meta<typeof DropZone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** PDF 以外が混ざって、受け付けなかったとき（ADR 0005 決定 7。見せ方の作り直しは ADR 0009） */
export const Rejected: Story = {
	args: {
		errorMessage: "PDFファイルのみ選択してください",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent("PDFファイルのみ選択してください");
	},
};

const mockPdfFile = new File(["dummy pdf content"], "test1.pdf", { type: "application/pdf" });
const mockTxtFile = new File(["dummy text content"], "test2.txt", { type: "text/plain" });

export const TestButtonRefClick: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByTestId("file-input");
		const clickSpy = spyOn(input, "click");

		await userEvent.click(canvas.getByRole("button", { name: "ファイルを選択" }));

		await expect(clickSpy).toHaveBeenCalled();
		clickSpy.mockRestore();
	},
};

export const TestPick: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByTestId("file-input");

		// accept="application/pdf" のため、ファイルの選択の画面からは PDF だけが渡される
		await userEvent.upload(input, [mockPdfFile, mockTxtFile]);

		await expect(args.onFiles).toHaveBeenCalledWith([mockPdfFile], "picker");
	},
};

export const TestDrop: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const dropzone = canvas.getByTestId("dropzone");

		await fireEvent.dragOver(dropzone);
		const dropEvent = createEvent.drop(dropzone);
		Object.defineProperty(dropEvent, "dataTransfer", { value: { files: [mockPdfFile, mockTxtFile] } });
		await fireEvent(dropzone, dropEvent);

		// PDF かどうかの判定は use-merge-workflow で行うので、ドロップしたものをそのまま渡す
		await expect(args.onFiles).toHaveBeenCalledWith([mockPdfFile, mockTxtFile], "drop");
	},
};
