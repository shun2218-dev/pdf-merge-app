import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MergeActions } from "@/components/merge/merge-actions";

describe("MergeActions", () => {
	it("プレビューとダウンロードのボタンで、それぞれの操作を呼ぶ", async () => {
		const onPreview = vi.fn();
		const onDownload = vi.fn();
		render(<MergeActions isMerging={false} onPreview={onPreview} onDownload={onDownload} />);

		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));
		await userEvent.click(screen.getByRole("button", { name: "ダウンロード" }));

		expect(onPreview).toHaveBeenCalledTimes(1);
		expect(onDownload).toHaveBeenCalledTimes(1);
	});

	it("結合している間は「処理中...」にして、どちらも押せなくする", () => {
		render(<MergeActions isMerging onPreview={vi.fn()} onDownload={vi.fn()} />);

		expect(screen.getByRole("button", { name: "処理中..." })).toBeDisabled();
		expect(screen.getByRole("button", { name: "ダウンロード" })).toBeDisabled();
	});

	it("進捗があれば、終えたファイルの数を出す（ADR 0002 決定 2）", () => {
		render(<MergeActions isMerging progress={{ done: 2, total: 5 }} onPreview={vi.fn()} onDownload={vi.fn()} />);

		expect(screen.getByRole("button", { name: "処理中... 2 / 5" })).toBeDisabled();
	});

	it("警告の文言を出しても、ボタンは押せる（ADR 0002 決定 5）", () => {
		render(
			<MergeActions isMerging={false} onPreview={vi.fn()} onDownload={vi.fn()} warningMessage="時間がかかります" />,
		);

		expect(screen.getByText("時間がかかります")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "プレビュー" })).toBeEnabled();
	});

	it("エラーの文言を role=alert で出す（ADR 0005 決定 7）", () => {
		render(
			<MergeActions
				isMerging={false}
				onPreview={vi.fn()}
				onDownload={vi.fn()}
				errorMessage="PDFの結合中にエラーが発生しました"
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent("PDFの結合中にエラーが発生しました");
	});
});
