import type { Meta, StoryObj } from "@storybook/react";
import { FileList } from "./file-list";
import { fn, userEvent, within, fireEvent, expect } from "storybook/test";
import { useArgs } from "storybook/internal/preview-api";

const meta = {
	title: "Components/FileList",
	component: FileList,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		onReorder: fn(),
		onRemove: fn(),
	},
} satisfies Meta<typeof FileList>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockFiles: File[] = [
	new File(["content1"], "document1.pdf", { type: "application/pdf" }),
	new File(["content2"], "document2.pdf", { type: "application/pdf" }),
	new File(["content3"], "document3.pdf", { type: "application/pdf" }),
];

export const IntractionDefault: Story = {
	args: {
		files: mockFiles,
	},
	render: (args) => {
		const [currentArgs, updateArgs] = useArgs<{ files: File[] }>();
		const handleReorder = (fromIndex: number, toIndex: number) => {
			const newFiles = [...currentArgs.files];
			const [removed] = newFiles.splice(fromIndex, 1);
			newFiles.splice(toIndex, 0, removed);
			updateArgs({ files: newFiles });
			args.onReorder(fromIndex, toIndex);
		};

		const handleRemove = (index: number) => {
			const newFIles = currentArgs.files.filter((_, i) => i !== index);
			updateArgs({ files: newFIles });
			args.onRemove(index);
		};

		return <FileList {...args} files={currentArgs.files} onReorder={handleReorder} onRemove={handleRemove} />;
	},
};

export const SingleFile: Story = {
	args: {
		files: [mockFiles[0]],
	},
};

export const ManyFiles: Story = {
	args: {
		files: [
			...mockFiles,
			new File(["content4"], "document4.pdf", { type: "application/pdf" }),
			new File(["content5"], "document5.pdf", { type: "application/pdf" }),
		],
	},
};

export const InCard: Story = {
	args: {
		files: mockFiles,
	},
	decorators: [
		(Story) => (
			<div className="w-[600px] rounded-lg border border-border bg-card p-6">
				<Story />
			</div>
		),
	],
};

export const TestRemoveFile: Story = {
	args: {
		files: mockFiles,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// "削除する" ボタンをすべて検索
		const removeButtons = await canvas.findAllByLabelText("削除する");

		// 2番目のファイル（document2.pdf）の削除ボタンをクリック
		await userEvent.click(removeButtons[1]);

		// onRemove が正しいインデックス（1）で呼ばれたことを確認
		await expect(args.onRemove).toHaveBeenCalledWith(1);
	},
};

export const TestReorderFiles: Story = {
	args: {
		files: mockFiles,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// ドラッグするアイテム（document1.pdf）を取得
		const itemToDrag = canvas.getByText("document1.pdf");

		// ドロップ先のアイテム（document2.pdf）を取得
		const dropTarget = canvas.getByText("document2.pdf");

		// ドラッグ開始 (document1.pdf)
		await fireEvent.dragStart(itemToDrag);

		// document2.pdf の上にドラッグ
		await fireEvent.dragOver(dropTarget);

		// ドロップ（ドラッグ終了）
		await fireEvent.dragEnd(itemToDrag);

		// onReorder が (index 0 を index 1 へ) で呼ばれたことを確認
		await expect(args.onReorder).toHaveBeenCalledWith(0, 1);
	},
};
