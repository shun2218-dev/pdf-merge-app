import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { UPLOAD_NOTICE, UploadNotice } from "./upload-notice";

const meta = {
	title: "Merge/UploadNotice",
	component: UploadNotice,
	tags: ["autodocs"],
} satisfies Meta<typeof UploadNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

// サーバーへ送っている間の断り（ADR 0027 決定 2・4）
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(UPLOAD_NOTICE.sending)).toBeVisible();
		await expect(canvas.getByText(UPLOAD_NOTICE.confidential)).toHaveClass("text-destructive");
		await expect(canvas.getByText(UPLOAD_NOTICE.liability)).toBeVisible();
	},
};
