import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Header } from "./header";

const meta = {
	title: "Components/Header",
	component: Header,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

// 注意事項のモーダルを開くボタンは置かない（ADR 0027 決定 1）
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("heading", { name: "PDF Merger" })).toBeVisible();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
};
