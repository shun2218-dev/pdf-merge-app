import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UPLOAD_NOTICE, UploadNotice } from "@/components/merge/upload-notice";

describe("UploadNotice（ADR 0027）", () => {
	it("ファイルを端末の外へ送らないことを伝える（ADR 0009 決定 1・ADR 0030 決定 6）", () => {
		render(<UploadNotice />);

		const local = screen.getByText(UPLOAD_NOTICE.local);
		expect(local.textContent).toContain("この端末の中だけで処理され");
		expect(local.textContent).toContain("外部へ送信されません");
	});

	it("サーバーへ送る前提の断り（社外秘のファイルを避けてほしい）はもう出さない", () => {
		const { container } = render(<UploadNotice />);

		expect(container.textContent).not.toContain("サーバー");
		expect(container.textContent).not.toContain("社外秘");
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
