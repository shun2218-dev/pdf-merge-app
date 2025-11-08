import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "storybook/test";
import { Header } from "./header";
import { STORAGE_KEY } from "./privacy-modal";

const meta = {
	title: "Components/Header",
	component: Header,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
	render: () => {
		sessionStorage.setItem(STORAGE_KEY, "true");
		return <Header />;
	},
	beforeEach: () => {
		sessionStorage.removeItem(STORAGE_KEY);
	},
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstVisit: Story = {
	render: () => {
		return <Header />;
	},
	play: async () => {
		const checkbox = screen.getByLabelText("上記の内容を理解しました");
		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });

		await expect(closeButton).toBeDisabled();

		await userEvent.click(checkbox);

		await expect(closeButton).toBeEnabled();

		await userEvent.click(closeButton);
	},
};

export const AfterAgreed: Story = {
	render: () => {
		sessionStorage.setItem(STORAGE_KEY, "true");
		return <Header />;
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const openButton = canvas.getByTestId("dialog-trigger-button");
		await userEvent.click(openButton);

		const modal = screen.getByTestId("header-dialog");
		await expect(modal).toBeInTheDocument();

		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });

		await expect(closeButton).not.toBeDisabled();

		await expect(closeButton).toBeEnabled();

		await userEvent.click(closeButton);
	},
};
