import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileNameInput } from "./file-name-input";

const meta = {
	title: "Merge/FileNameInput",
	component: FileNameInput,
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
	args: {
		value: "",
		onChange: fn(),
	},
	// 入力した値が見えるよう、値をここで持つ
	render: function Render(args) {
		const [value, setValue] = useState(args.value);
		return (
			<FileNameInput
				value={value}
				onChange={(next) => {
					setValue(next);
					args.onChange(next);
				}}
			/>
		);
	},
} satisfies Meta<typeof FileNameInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 最初は空。空のままなら merged_ + ダウンロードした時刻になる（ADR 0031 決定 2） */
export const Empty: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: "ファイル名" });
		await expect(input).toHaveValue("");
		await expect(input).toHaveAccessibleDescription(/空欄のときは merged_年月日時分秒\.pdf/);
	},
};

/** キーボードで入力できる */
export const Typing: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.tab();
		await expect(canvas.getByRole("textbox", { name: "ファイル名" })).toHaveFocus();
		await userEvent.keyboard("2026年度_契約書");
		await expect(args.onChange).toHaveBeenLastCalledWith("2026年度_契約書");
	},
};

/** 長い名前を入れたとき（80 文字まで） */
export const LongName: Story = {
	args: {
		value: "とても長いファイル名".repeat(8),
	},
};
