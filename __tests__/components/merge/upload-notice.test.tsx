import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UPLOAD_NOTICE, UploadNotice } from "@/components/merge/upload-notice";

describe("UploadNotice（ADR 0027）", () => {
	it("サーバーへ送ること・保存しないことを伝える（決定 2）", () => {
		render(<UploadNotice />);

		const sending = screen.getByText(UPLOAD_NOTICE.sending);
		expect(sending.textContent).toContain("サーバーへ送信します");
		expect(sending.textContent).toContain("保存せず");
	});

	it("送らないでほしいファイルを、目立つ色で伝える（決定 2）", () => {
		render(<UploadNotice />);

		const confidential = screen.getByText(UPLOAD_NOTICE.confidential);
		expect(confidential.textContent).toContain("社外秘の文書や個人情報");
		expect(confidential).toHaveClass("text-destructive-foreground");
	});

	it("免責を小さく出す（決定 4）", () => {
		render(<UploadNotice />);

		expect(screen.getByText(UPLOAD_NOTICE.liability)).toHaveClass("text-xs", "text-muted-foreground");
	});

	it("同意のチェックや操作を求めない（決定 5）", () => {
		render(<UploadNotice />);

		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});
