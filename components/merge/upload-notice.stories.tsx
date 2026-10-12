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

// 端末の外へ送らないことの断り（ADR 0009 決定 1・ADR 0030 決定 6）と免責（ADR 0027 決定 4）
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(UPLOAD_NOTICE.local)).toBeVisible();
		await expect(canvas.getByText(UPLOAD_NOTICE.liability)).toBeVisible();
	},
};
