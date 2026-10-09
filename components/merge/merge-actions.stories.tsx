import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { MergeActions } from "./merge-actions";

const meta = {
	title: "Merge/MergeActions",
	component: MergeActions,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		isMerging: false,
		onPreview: fn(),
		onDownload: fn(),
	},
} satisfies Meta<typeof MergeActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "プレビュー" }));
		await userEvent.click(canvas.getByRole("button", { name: "ダウンロード" }));

		await expect(args.onPreview).toHaveBeenCalledTimes(1);
		await expect(args.onDownload).toHaveBeenCalledTimes(1);
	},
};

/** 結合している間は、どちらのボタンも押せない */
export const Merging: Story = {
	args: {
		isMerging: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("button", { name: "処理中..." })).toBeDisabled();
		await expect(canvas.getByRole("button", { name: "ダウンロード" })).toBeDisabled();
	},
};

/** 結合に失敗したとき（ADR 0005 決定 7。見せ方の作り直しは ADR 0009） */
export const Failed: Story = {
	args: {
		errorMessage: "PDFの結合中にエラーが発生しました",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent("PDFの結合中にエラーが発生しました");
	},
};

/** 結合している間、1 ファイル終えるごとに進捗を出す（ADR 0002 決定 2） */
export const MergingWithProgress: Story = {
	args: {
		isMerging: true,
		progress: { done: 2, total: 5 },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("button", { name: "処理中... 2 / 5" })).toBeDisabled();
	},
};

/** ファイルが多い・大きいときの警告。結合は止めない（ADR 0002 決定 5） */
export const LargeMergeWarning: Story = {
	args: {
		warningMessage: "ファイルの数か合計の大きさが大きいため、端末によっては時間がかかるか、失敗することがあります。",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/端末によっては時間がかかる/)).toBeVisible();
		await expect(canvas.getByRole("button", { name: "プレビュー" })).toBeEnabled();
	},
};
