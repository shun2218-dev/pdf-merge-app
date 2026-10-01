import type { Meta, StoryObj } from "@storybook/react";
import { useArgs } from "storybook/internal/preview-api";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import type { MergeItem } from "@/lib/merge-workflow/reducer";
import { FileList } from "./file-list";

const meta = {
	title: "Merge/FileList",
	component: FileList,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		items: [],
		onMove: fn(),
		onRemove: fn(),
		onReorderEnd: fn(),
	},
} satisfies Meta<typeof FileList>;

export default meta;
type Story = StoryObj<typeof meta>;

const item = (id: string, name: string, content = name): MergeItem => ({
	id,
	file: new File([content], name, { type: "application/pdf" }),
});

const mockItems = [item("1", "document1.pdf"), item("2", "document2.pdf"), item("3", "document3.pdf")];

export const InteractionDefault: Story = {
	args: {
		items: mockItems,
	},
	render: (args) => {
		const [currentArgs, updateArgs] = useArgs<{ items: MergeItem[] }>();
		const handleMove = (from: number, to: number) => {
			const items = [...currentArgs.items];
			const [moved] = items.splice(from, 1);
			items.splice(to, 0, moved);
			updateArgs({ items });
			args.onMove(from, to);
		};
		const handleRemove = (id: string) => {
			updateArgs({ items: currentArgs.items.filter((i) => i.id !== id) });
			args.onRemove(id);
		};
		return <FileList {...args} items={currentArgs.items} onMove={handleMove} onRemove={handleRemove} />;
	},
};

export const SingleFile: Story = {
	args: {
		items: [mockItems[0]],
	},
};

export const ManyFiles: Story = {
	args: {
		items: [...mockItems, item("4", "document4.pdf"), item("5", "document5.pdf")],
	},
};

/** 同じ名前のファイルが 2 つあっても、別の行として並ぶ（ADR 0005 決定 2・B-6） */
export const SameNames: Story = {
	args: {
		items: [item("a", "scan.pdf", "first"), item("b", "scan.pdf", "second-file")],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getAllByText("scan.pdf")).toHaveLength(2);
	},
};

export const TestRemoveFile: Story = {
	args: {
		items: mockItems,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const removeButtons = await canvas.findAllByLabelText("削除する");

		await userEvent.click(removeButtons[1]);

		// 位置ではなく id で消す
		await expect(args.onRemove).toHaveBeenCalledWith("2");
	},
};

export const TestReorderFiles: Story = {
	args: {
		items: mockItems,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const itemToDrag = canvas.getByText("document1.pdf");
		const dropTarget = canvas.getByText("document2.pdf");

		await fireEvent.dragStart(itemToDrag);
		await fireEvent.dragOver(dropTarget);
		await fireEvent.dragEnd(itemToDrag);

		await expect(args.onMove).toHaveBeenCalledWith(0, 1);
		await expect(args.onReorderEnd).toHaveBeenCalledTimes(1);
	},
};
