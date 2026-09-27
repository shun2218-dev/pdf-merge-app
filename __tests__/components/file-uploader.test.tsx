import * as Sentry from "@sentry/nextjs";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { FileUploader } from "@/components/file-uploader";
import { track } from "@/lib/analytics";

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/analytics")>()),
	track: vi.fn(),
}));

// ファイル名にしか現れない文字列。アナリティクスに送る値に含まれていないことを確かめる（ADR 0011）
const SECRET = "山田太郎_源泉徴収票";

describe("FileUploader", () => {
	let consoleErrorSpy: Mock<Console["error"]>;
	let alertSpy: Mock<Window["alert"]>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		alertSpy.mockRestore();
		vi.clearAllMocks();
	});

	it("ファイル選択ボタンが表示される", () => {
		const mockOnFilesSelected = vi.fn();
		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		expect(screen.getByText("ファイルを選択")).toBeInTheDocument();
		expect(screen.getByText("ファイルをドラッグ&ドロップ")).toBeInTheDocument();
	});

	it("ファイル選択ボタンをクリックするとファイル入力がトリガーされる", async () => {
		const mockOnFilesSelected = vi.fn();
		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;

		expect(input).toBeInTheDocument();
		expect(input).toHaveAttribute("accept", "application/pdf");
		expect(input).toHaveAttribute("multiple");
	});

	it("PDFファイルを選択するとonFilesSelectedが呼ばれる", async () => {
		const mockOnFilesSelected = vi.fn();
		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const pdfFile = new File(["dummy content"], "test.pdf", {
			type: "application/pdf",
		});

		await userEvent.upload(input, pdfFile);

		expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile]);
	});

	it("複数のPDFファイルを選択できる", async () => {
		const mockOnFilesSelected = vi.fn();
		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const pdfFile1 = new File(["content1"], "test1.pdf", {
			type: "application/pdf",
		});
		const pdfFile2 = new File(["content2"], "test2.pdf", {
			type: "application/pdf",
		});

		await userEvent.upload(input, [pdfFile1, pdfFile2]);

		expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile1, pdfFile2]);
	});

	it("PDF以外のファイルを選択するとアラートが表示される", async () => {
		const mockOnFilesSelected = vi.fn();

		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const txtFile = new File(["content"], "test.txt", { type: "text/plain" });

		Object.defineProperty(input, "files", {
			value: [txtFile],
			writable: false,
		});
		fireEvent.change(input);

		// 利用者の操作の結果なので、Sentry にもコンソールにもエラーとして出さない（ADR 0007 決定 4）
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(alertSpy).toHaveBeenCalledWith("PDFファイルのみ選択してください");
		expect(mockOnFilesSelected).not.toHaveBeenCalled();
	});

	it("ドラッグ&ドロップでPDFファイルを追加できる", () => {
		const mockOnFilesSelected = vi.fn();
		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const dropZone = screen.getByText("ファイルをドラッグ&ドロップ").closest("div");
		const pdfFile = new File(["content"], "test.pdf", {
			type: "application/pdf",
		});

		// biome-ignore lint/style/noNonNullAssertion: There is dropZone
		fireEvent.drop(dropZone!, {
			dataTransfer: {
				files: [pdfFile],
			},
		});

		expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile]);
	});

	it("ドラッグオーバー時にデフォルト動作を防ぐ", () => {
		const mockOnFilesSelected = vi.fn();
		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const dropZone = screen.getByText("ファイルをドラッグ&ドロップ").closest("div");

		// biome-ignore lint/style/noNonNullAssertion: There is dropZone
		fireEvent.dragOver(dropZone!, {
			dataTransfer: {
				files: [],
			},
		});

		expect(dropZone).toBeInTheDocument();
	});

	describe("アナリティクス", () => {
		const selectFiles = (files: File[]) => {
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			Object.defineProperty(input, "files", { value: files, writable: false });
			fireEvent.change(input);
		};

		it("ファイルを選んで追加したら files_added を 1 回送る", () => {
			render(<FileUploader onFilesSelected={vi.fn()} />);

			selectFiles([
				new File(["a"], `${SECRET}_1.pdf`, { type: "application/pdf" }),
				new File(["b"], `${SECRET}_2.pdf`, { type: "application/pdf" }),
			]);

			expect(track).toHaveBeenCalledTimes(1);
			expect(track).toHaveBeenCalledWith("files_added", {
				source: "picker",
				count_bucket: "2",
				size_bucket: "<1MB",
			});
			expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain(SECRET);
		});

		it("ドロップで追加したら source が drop になる", () => {
			render(<FileUploader onFilesSelected={vi.fn()} />);

			fireEvent.drop(screen.getByTestId("dropzone"), {
				dataTransfer: { files: [new File(["a"], `${SECRET}.pdf`, { type: "application/pdf" })] },
			});

			expect(track).toHaveBeenCalledWith("files_added", expect.objectContaining({ source: "drop", count_bucket: "1" }));
		});

		it("PDF 以外が混ざっていたら files_rejected を送り、files_added は送らない", () => {
			render(<FileUploader onFilesSelected={vi.fn()} />);

			selectFiles([
				new File(["a"], `${SECRET}.pdf`, { type: "application/pdf" }),
				new File(["b"], `${SECRET}.docx`, { type: "application/msword" }),
			]);

			expect(track).toHaveBeenCalledTimes(1);
			expect(track).toHaveBeenCalledWith("files_rejected", { reason: "not_pdf", count_bucket: "1" });
			expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain(SECRET);
		});
	});

	it("ドロップ時にPDF以外のファイルを拒否する", async () => {
		const mockOnFilesSelected = vi.fn();

		render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

		const dropZone = screen.getByText("ファイルをドラッグ&ドロップ").closest("div");
		const txtFile = new File(["content"], "test.txt", { type: "text/plain" });

		// biome-ignore lint/style/noNonNullAssertion: There is dropZone
		fireEvent.drop(dropZone!, {
			dataTransfer: {
				files: [txtFile],
			},
		});

		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(consoleErrorSpy).not.toHaveBeenCalled();
		expect(alertSpy).toHaveBeenCalledWith("PDFファイルのみ選択してください");
		expect(mockOnFilesSelected).not.toHaveBeenCalled();
	});
});
