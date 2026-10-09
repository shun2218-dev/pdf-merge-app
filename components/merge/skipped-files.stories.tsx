import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { SkippedFiles } from "./skipped-files";

const meta = {
	title: "Merge/SkippedFiles",
	component: SkippedFiles,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		files: [
			{ id: "1", name: "2026_契約書_署名済み.pdf", reason: "encrypted" },
			{ id: "2", name: "scan_broken.pdf", reason: "corrupt" },
		],
	},
} satisfies Meta<typeof SkippedFiles>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 結合のときに飛ばしたファイルの名前と理由（ADR 0030 決定 2） */
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const region = canvas.getByTestId("skipped-files");
		await expect(region).toHaveAttribute("aria-live", "polite");
		await expect(region).toHaveTextContent("2026_契約書_署名済み.pdf（パスワード付きのため）");
		await expect(region).toHaveTextContent("scan_broken.pdf（読み込めないため）");
	},
};

/** 長いファイル名でも、はみ出さずに折り返す */
export const LongName: Story = {
	args: {
		files: [{ id: "1", name: `${"とても長いファイル名".repeat(8)}.pdf`, reason: "corrupt" }],
	},
};

/** 飛ばしたファイルがなければ、読み上げの入れ物だけで何も出さない */
export const Empty: Story = {
	args: { files: [] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId("skipped-files")).toBeEmptyDOMElement();
	},
};
