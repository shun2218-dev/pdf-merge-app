import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DisclaimerModal } from "@/components/disclaimer-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

describe("DisclaimerModal", () => {
	it("初期状態でボタンが無効化されている", async () => {
		const user = userEvent.setup();
		render(
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="destructive" size="sm">
						ご利用上の注意
					</Button>
				</DialogTrigger>
				<DisclaimerModal />
			</Dialog>,
		);
		const openButton = screen.getByRole("button", { name: "ご利用上の注意" });
		await user.click(openButton);
		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });
		expect(closeButton).toBeDisabled();
	});

	it("チェックボックスをクリックするとボタンが有効になる", async () => {
		const user = userEvent.setup();
		render(
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="destructive" size="sm">
						ご利用上の注意
					</Button>
				</DialogTrigger>
				<DisclaimerModal />
			</Dialog>,
		);

		const openButton = screen.getByRole("button", { name: "ご利用上の注意" });
		await user.click(openButton);
		const checkbox = screen.getByLabelText("上記の内容を理解しました");
		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });

		await user.click(checkbox);

		expect(closeButton).toBeEnabled();
	});

	it("チェックボックスがオフの時は、閉じるボタンをクリックしても handleClose が呼ばれない", async () => {
		const user = userEvent.setup();
		render(
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="destructive" size="sm">
						ご利用上の注意
					</Button>
				</DialogTrigger>
				<DisclaimerModal />
			</Dialog>,
		);

		const openButton = screen.getByRole("button", { name: "ご利用上の注意" });
		await user.click(openButton);
		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });

		await user.click(closeButton);
	});

	it("チェックボックスをオンにした後、閉じるボタンをクリックすると handleClose が呼ばれる", async () => {
		const user = userEvent.setup();
		render(
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="destructive" size="sm">
						ご利用上の注意
					</Button>
				</DialogTrigger>
				<DisclaimerModal />
			</Dialog>,
		);

		const openButton = screen.getByRole("button", { name: "ご利用上の注意" });
		await user.click(openButton);
		const checkbox = screen.getByLabelText("上記の内容を理解しました");
		const closeButton = screen.getByRole("button", { name: "理解して閉じる" });

		await user.click(checkbox);

		await user.click(closeButton);
	});
});
