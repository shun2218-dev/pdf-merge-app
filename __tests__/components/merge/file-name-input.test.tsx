import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FileNameInput } from "@/components/merge/file-name-input";
import { FILE_NAME_MAX_LENGTH } from "@/lib/merge-workflow/file-name";

// 出力のファイル名の入力欄（ADR 0031 決定 1）

function Controlled({ onChange }: { onChange?: (value: string) => void }) {
	const [value, setValue] = useState("");
	return (
		<FileNameInput
			value={value}
			onChange={(next) => {
				setValue(next);
				onChange?.(next);
			}}
		/>
	);
}

describe("FileNameInput", () => {
	it("見えるラベル「ファイル名」で入力欄を見つけられる（ADR 0014）", () => {
		render(<FileNameInput value="" onChange={vi.fn()} />);

		expect(screen.getByRole("textbox", { name: "ファイル名" })).toBeInTheDocument();
	});

	it("既定の名前と置き換えの説明を、aria-describedby で結び付ける", () => {
		render(<FileNameInput value="" onChange={vi.fn()} />);

		const input = screen.getByRole("textbox", { name: "ファイル名" });
		expect(input).toHaveAccessibleDescription(/空欄のときは merged_年月日時分秒\.pdf/);
		expect(input).toHaveAccessibleDescription(/\.pdf は自動で付きます/);
	});

	it("入力すると onChange を呼ぶ", async () => {
		const onChange = vi.fn();
		render(<Controlled onChange={onChange} />);

		await userEvent.type(screen.getByRole("textbox", { name: "ファイル名" }), "契約書");

		expect(onChange).toHaveBeenLastCalledWith("契約書");
	});

	it(`${FILE_NAME_MAX_LENGTH} 文字より長くは入力できない（決定 4）`, () => {
		render(<FileNameInput value="" onChange={vi.fn()} />);

		expect(screen.getByRole("textbox", { name: "ファイル名" })).toHaveAttribute(
			"maxLength",
			String(FILE_NAME_MAX_LENGTH),
		);
	});
});
