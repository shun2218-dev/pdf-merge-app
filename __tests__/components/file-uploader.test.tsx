import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { FileUploader } from "@/components/file-uploader";
import { SentryFrontendError } from "@/hooks/use-sentry";

vi.mock("@/hooks/use-sentry", () => {
	class MockSentryError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "MockSentryError";
		}
	}

	return {
		useSentry: () => ({
			setHasSentError: vi.fn(),
		}),
		SentryFrontendError: MockSentryError,
	};
});

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

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			new SentryFrontendError("SentryFrontendError:FileUploader:handleFileChange:PDFファイルのみ選択してください"),
		);
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

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			new SentryFrontendError("SentryFrontendError:FileUploader:handleDrop:PDFファイルのみ選択してください"),
		);
		expect(alertSpy).toHaveBeenCalledWith("PDFファイルのみ選択してください");
		expect(mockOnFilesSelected).not.toHaveBeenCalled();
	});
});
