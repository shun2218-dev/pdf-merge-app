import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MergeWorkspace } from "@/components/merge/merge-workspace";
import { MergeWorkerError, mergeInBrowser } from "@/lib/pdf/merge-in-browser";

vi.mock("@/lib/sentry/browser", () => ({ sentry: { captureException: vi.fn(), addBreadcrumb: vi.fn() } }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/analytics")>()),
	track: vi.fn(),
}));
vi.mock("@/lib/pdf/merge-in-browser", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/pdf/merge-in-browser")>()),
	mergeInBrowser: vi.fn(),
}));
vi.mock("@/components/pdf-preview", () => ({
	PdfPreview: ({ pdfUrl }: { pdfUrl: string }) => <div data-testid="pdf-preview">Preview: {pdfUrl}</div>,
}));

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });

function mergeSucceeds() {
	vi.mocked(mergeInBrowser).mockResolvedValueOnce({ bytes: new Uint8Array([1]), skipped: [] });
}

// 渡されたファイルのうち、名前が skip に入っているものを飛ばしたことにする
function mergeSkips(skip: Record<string, "encrypted" | "corrupt">, valid = true) {
	vi.mocked(mergeInBrowser).mockImplementationOnce(async (files) => ({
		bytes: valid ? new Uint8Array([1]) : null,
		skipped: files.filter(({ file }) => file.name in skip).map(({ id, file }) => ({ id, reason: skip[file.name] })),
	}));
}

async function upload(...files: File[]) {
	await userEvent.upload(screen.getByTestId("file-input"), files);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(mergeInBrowser).mockReset();
	global.URL.createObjectURL = vi.fn(() => "blob:merged");
	global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("MergeWorkspace", () => {
	it("最初はステップ 1 だけを出す", () => {
		render(<MergeWorkspace />);
		expect(screen.getByText("ステップ 1: PDFファイルをアップロード")).toBeInTheDocument();
		expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument();
		expect(screen.queryByText("ステップ 3: プレビューとダウンロード")).not.toBeInTheDocument();
	});

	it("PDF を足すと一覧とステップ 2・3 を出し、足すたびに後ろへ並べる", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("a.pdf"));
		await upload(pdf("b.pdf"));

		expect(screen.getByText("ステップ 2: ファイルの順番を調整")).toBeInTheDocument();
		expect(screen.getByText("ステップ 3: プレビューとダウンロード")).toBeInTheDocument();
		expect(screen.getAllByTestId("file-name").map((el) => el.textContent)).toEqual(["a.pdf", "b.pdf"]);
	});

	it("PDF 以外をドロップすると、alert ではなく画面に文言を出し、一覧には足さない（ADR 0005 決定 7）", () => {
		const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
		render(<MergeWorkspace />);

		fireEvent.drop(screen.getByTestId("dropzone"), {
			dataTransfer: { files: [pdf("a.pdf"), new File(["x"], "b.txt", { type: "text/plain" })] },
		});

		expect(screen.getByRole("alert")).toHaveTextContent("PDFファイルのみ選択してください");
		expect(screen.queryByTestId("file-list")).not.toBeInTheDocument();
		expect(alert).not.toHaveBeenCalled();
	});

	it("すべて削除すると、ステップ 2・3 を隠す", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("a.pdf"));

		await userEvent.click(screen.getByRole("button", { name: "削除する" }));

		expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument();
	});

	it("プレビューを押すと、結合してプレビューを出す", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("a.pdf"));
		mergeSucceeds();

		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));

		expect(await screen.findByTestId("pdf-preview")).toHaveTextContent("blob:merged");
	});

	it("一覧を変えると、プレビューを閉じる", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("a.pdf"));
		mergeSucceeds();
		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));
		await screen.findByTestId("pdf-preview");

		await upload(pdf("b.pdf"));

		expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument();
	});

	it("結合に失敗すると、alert ではなく画面に文言を出す（ADR 0005 決定 7）", async () => {
		const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
		render(<MergeWorkspace />);
		await upload(pdf("a.pdf"));
		vi.mocked(mergeInBrowser).mockRejectedValueOnce(new MergeWorkerError("worker_error", "x"));

		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));

		expect(await screen.findByRole("alert")).toHaveTextContent("PDFの結合中にエラーが発生しました");
		expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument();
		expect(alert).not.toHaveBeenCalled();
	});

	it("プレビューせずにダウンロードを 1 回押すと、結合してダウンロードする（B-1）", async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		render(<MergeWorkspace />);
		await upload(pdf("a.pdf"));
		mergeSucceeds();

		await userEvent.click(screen.getByRole("button", { name: "ダウンロード" }));

		await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
		expect(mergeInBrowser).toHaveBeenCalledTimes(1);
	});

	it("飛ばしたファイルの名前と理由を、結合の操作の近くに出す（ADR 0030 決定 2）", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("ok.pdf"), pdf("locked.pdf"), pdf("broken.pdf"));
		mergeSkips({ "locked.pdf": "encrypted", "broken.pdf": "corrupt" });

		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));

		const skipped = screen.getByTestId("skipped-files");
		await waitFor(() => expect(skipped).toHaveTextContent("locked.pdf"));
		expect(skipped).toHaveTextContent("locked.pdf（パスワード付きのため）");
		expect(skipped).toHaveTextContent("broken.pdf（読み込めないため）");
		expect(skipped).not.toHaveTextContent("ok.pdf");
		expect(await screen.findByTestId("pdf-preview")).toBeInTheDocument();
	});

	it("読めるファイルが 1 つもなければ、失敗の文言と飛ばしたファイルを出す", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("locked.pdf"));
		mergeSkips({ "locked.pdf": "encrypted" }, false);

		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));

		expect(await screen.findByRole("alert")).toHaveTextContent("結合できる PDF がありませんでした");
		expect(screen.getByTestId("skipped-files")).toHaveTextContent("locked.pdf（パスワード付きのため）");
		expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument();
	});

	it("一覧を変えると、飛ばしたファイルの表示を消す", async () => {
		render(<MergeWorkspace />);
		await upload(pdf("ok.pdf"), pdf("locked.pdf"));
		mergeSkips({ "locked.pdf": "encrypted" });
		await userEvent.click(screen.getByRole("button", { name: "プレビュー" }));
		await waitFor(() => expect(screen.getByTestId("skipped-files")).toHaveTextContent("locked.pdf"));

		await upload(pdf("more.pdf"));

		expect(screen.getByTestId("skipped-files")).toBeEmptyDOMElement();
	});

	it("100 ファイルを超えたら、時間がかかるか失敗しうると警告する。結合は止めない（ADR 0002 決定 5）", async () => {
		render(<MergeWorkspace />);
		await upload(...Array.from({ length: 100 }, (_, i) => pdf(`${i}.pdf`)));
		expect(screen.queryByText(/端末によっては時間がかかる/)).not.toBeInTheDocument();

		await upload(pdf("101.pdf"));

		expect(screen.getByText(/端末によっては時間がかかる/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "プレビュー" })).toBeEnabled();
	});

	it("合計が 300MB を超えたら警告する", async () => {
		render(<MergeWorkspace />);
		const large = pdf("large.pdf");
		Object.defineProperty(large, "size", { value: 300 * 1024 * 1024 + 1 });
		await upload(large);

		expect(screen.getByText(/端末によっては時間がかかる/)).toBeInTheDocument();
	});

	it("受け取った断りを、ドロップ領域のすぐ下に出す（ADR 0027 決定 2・3）", () => {
		render(<MergeWorkspace notice={<p data-testid="notice">断り</p>} />);

		const dropzone = screen.getByTestId("dropzone");
		const notice = screen.getByTestId("notice");
		expect(dropzone.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument();
	});
});
