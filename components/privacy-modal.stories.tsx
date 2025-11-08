import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { PrivacyModal, STORAGE_KEY } from "./privacy-modal";

const meta = {
	title: "Components/PrivacyModal",
	component: PrivacyModal,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	args: {
		handleClose: fn(),
	},
	render: () => {
		const [isOpen, setIsOpen] = useState(false);

		useEffect(() => {
			sessionStorage.removeItem(STORAGE_KEY);
		}, []);
		return (
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" data-testid="dialog-trigger-button">
						モーダルを開く (Story)
					</Button>
				</DialogTrigger>
				<PrivacyModal />
			</Dialog>
		);
	},
	beforeEach: () => {
		sessionStorage.removeItem(STORAGE_KEY);
	},
} satisfies Meta<typeof PrivacyModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CheckedState: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByTestId("dialog-trigger-button"));

		const modalTitle = screen.getByText("ご利用上の注意");
		await expect(modalTitle).toBeInTheDocument();

		const overlay = screen.getByTestId("dialog-overlay");

		await userEvent.click(overlay);
		await expect(modalTitle).toBeInTheDocument();

		await userEvent.keyboard("{Escape}");
		await expect(modalTitle).toBeInTheDocument();

		const checkbox = screen.getByLabelText("上記の内容を理解しました");
		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });

		await expect(closeButton).toBeDisabled();

		await userEvent.click(checkbox);

		await expect(closeButton).toBeEnabled();

		await userEvent.click(closeButton);
	},
};
