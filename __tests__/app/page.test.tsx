"use client";

import * as Sentry from "@sentry/nextjs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfMergerPage from "@/app/page";
import { track } from "@/lib/analytics";

// Mock child components
vi.mock("@/components/header", () => ({
	Header: () => <div data-testid="header">Header</div>,
}));

vi.mock("@/components/file-uploader", () => ({
	FileUploader: ({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) => (
		<button
			type="button"
			data-testid="file-uploader"
			onClick={() => {
				const mockFile = new File(["content"], "test.pdf", {
					type: "application/pdf",
				});
				onFilesSelected([mockFile]);
			}}
		>
			Upload Files
		</button>
	),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
}));

vi.mock("@/lib/analytics", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/analytics")>()),
	track: vi.fn(),
}));

vi.mock("@/components/file-list", () => ({
	FileList: ({
		files,
		onReorder,
		onRemove,
	}: {
		files: File[];
		onReorder: (index: number, newIndex: number) => void;
		onRemove: (index: number) => void;
	}) => (
		<div data-testid="file-list">
			{files.map((file: File, index: number) => (
				<div key={`${file.name}-${index}`} data-testid={`file-item-${index}`}>
					{file.name}
					<button type="button" data-testid={`remove-${index}`} onClick={() => onRemove(index)}>
						Remove
					</button>
					<button type="button" data-testid={`reorder-${index}`} onClick={() => onReorder(index, 0)}>
						Reorder
					</button>
				</div>
			))}
		</div>
	),
}));

vi.mock("@/components/pdf-preview", () => ({
	PdfPreview: ({ pdfUrl }: { pdfUrl: string }) => <div data-testid="pdf-preview">Preview: {pdfUrl}</div>,
}));

// Mock fetch
global.fetch = vi.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

// Mock alert
global.alert = vi.fn();

describe("PdfMergerPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("初期状態で3つのステップカードのうち、ステップ1のみが表示される", () => {
		render(<PdfMergerPage />);

		expect(screen.getByText("ステップ 1: PDFファイルをアップロード")).toBeInTheDocument();
		expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument();
		expect(screen.queryByText("ステップ 3: プレビューとダウンロード")).not.toBeInTheDocument();
	});

	it("Headerコンポーネントが表示される", () => {
		render(<PdfMergerPage />);

		expect(screen.getByTestId("header")).toBeInTheDocument();
	});

	it("FileUploaderコンポーネントが表示される", () => {
		render(<PdfMergerPage />);

		expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
	});

	it("ファイルをアップロードするとステップ2と3が表示される", async () => {
		const user = userEvent.setup();
		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		expect(screen.getByText("ステップ 2: ファイルの順番を調整")).toBeInTheDocument();
		expect(screen.getByText("ステップ 3: プレビューとダウンロード")).toBeInTheDocument();
	});

	it("ファイルをアップロードするとFileListが表示される", async () => {
		const user = userEvent.setup();
		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		expect(screen.getByTestId("file-list")).toBeInTheDocument();
		expect(screen.getByText("test.pdf")).toBeInTheDocument();
	});

	it("複数回ファイルをアップロードすると既存のファイルに追加される", async () => {
		const user = userEvent.setup();
		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);
		await user.click(uploader);

		const fileItems = screen.getAllByTestId(/^file-item-/);
		expect(fileItems).toHaveLength(2);
	});

	it("ファイルを削除するとリストから削除される", async () => {
		const user = userEvent.setup();
		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);
		await user.click(uploader);

		const removeButton = screen.getByTestId("remove-0");
		await user.click(removeButton);

		const fileItems = screen.getAllByTestId(/^file-item-/);
		expect(fileItems).toHaveLength(1);
	});

	it("すべてのファイルを削除するとステップ2と3が非表示になる", async () => {
		const user = userEvent.setup();
		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const removeButton = screen.getByTestId("remove-0");
		await user.click(removeButton);

		expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument();
		expect(screen.queryByText("ステップ 3: プレビューとダウンロード")).not.toBeInTheDocument();
	});

	it("ファイルの順番を変更できる", async () => {
		const user = userEvent.setup();
		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const reorderButton = screen.getByTestId("reorder-0");
		await user.click(reorderButton);

		// Reorder should work without errors
		expect(screen.getByTestId("file-list")).toBeInTheDocument();
	});

	it("プレビューボタンをクリックするとAPI呼び出しが行われる", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/merge-pdf",
				expect.objectContaining({
					method: "POST",
					body: expect.any(FormData),
				}),
			);
		});
	});

	it("プレビューボタンをクリックするとプレビューが表示される", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(screen.getByTestId("pdf-preview")).toBeInTheDocument();
			expect(screen.getByText(/Preview: blob:mock-url/)).toBeInTheDocument();
		});
	});

	it("処理中はボタンが無効化される", async () => {
		const user = userEvent.setup();

		// Make fetch hang to keep processing state
		vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		const downloadButton = screen.getByRole("button", {
			name: /ダウンロード/i,
		});

		await user.click(previewButton);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: /処理中/i })).toBeDisabled();
			expect(downloadButton).toBeDisabled();
		});
	});

	it("API呼び出しが失敗した場合にアラートが表示される", async () => {
		const user = userEvent.setup();

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
		} as Response);

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(alert).toHaveBeenCalledWith("PDFの結合中にエラーが発生しました");
		});
	});

	it("ダウンロードボタンをクリックするとファイルがダウンロードされる（プレビュー済み）", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		const originalCreateElement = document.createElement.bind(document);
		const mockClick = vi.fn();
		const mockLink = originalCreateElement("a") as HTMLAnchorElement;
		mockLink.click = mockClick;

		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			if (tagName.toLowerCase() === "a") {
				return mockLink;
			}
			return originalCreateElement(tagName);
		});

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(screen.getByTestId("pdf-preview")).toBeInTheDocument();
		});

		const downloadButton = screen.getByRole("button", {
			name: /ダウンロード/i,
		});
		await user.click(downloadButton);

		await waitFor(() => {
			expect(mockClick).toHaveBeenCalled();
			expect(mockLink.download).toBe("merged.pdf");
			expect(mockLink.href).toBe("blob:mock-url");
		});
	});

	it("プレビューせずにダウンロードボタンを1回クリックすると、結合してダウンロードされる", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		const originalCreateElement = document.createElement.bind(document);
		const mockClick = vi.fn();
		const mockLink = originalCreateElement("a") as HTMLAnchorElement;
		mockLink.click = mockClick;

		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			if (tagName.toLowerCase() === "a") {
				return mockLink;
			}
			return originalCreateElement(tagName);
		});

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const downloadButton = screen.getByRole("button", {
			name: /ダウンロード/i,
		});
		await user.click(downloadButton);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledTimes(1);
			expect(mockClick).toHaveBeenCalledTimes(1);
			expect(mockLink.download).toBe("merged.pdf");
			expect(mockLink.href).toBe("blob:mock-url");
		});
	});

	it("プレビューせずにダウンロードして結合に失敗したときは、ダウンロードしない", async () => {
		const user = userEvent.setup();

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
		} as Response);

		const originalCreateElement = document.createElement.bind(document);
		const mockClick = vi.fn();
		const mockLink = originalCreateElement("a") as HTMLAnchorElement;
		mockLink.click = mockClick;

		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			if (tagName.toLowerCase() === "a") {
				return mockLink;
			}
			return originalCreateElement(tagName);
		});

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const downloadButton = screen.getByRole("button", {
			name: /ダウンロード/i,
		});
		await user.click(downloadButton);

		await waitFor(() => {
			expect(global.alert).toHaveBeenCalledWith("PDFの結合中にエラーが発生しました");
		});
		expect(mockClick).not.toHaveBeenCalled();
	});

	it("サーバーが失敗を返したときは、Sentry に送らない（サーバー側で記録されるため）", async () => {
		const user = userEvent.setup();

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 500,
		} as Response);

		render(<PdfMergerPage />);

		await user.click(screen.getByTestId("file-uploader"));
		await user.click(screen.getByRole("button", { name: /プレビュー/i }));

		await waitFor(() => {
			expect(global.alert).toHaveBeenCalledWith("PDFの結合中にエラーが発生しました");
		});
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("通信に失敗したときは、想定外のエラーとして Sentry に送る", async () => {
		const user = userEvent.setup();
		const networkError = new TypeError("Failed to fetch");

		vi.mocked(fetch).mockRejectedValueOnce(networkError);

		render(<PdfMergerPage />);

		await user.click(screen.getByTestId("file-uploader"));
		await user.click(screen.getByRole("button", { name: /プレビュー/i }));

		await waitFor(() => {
			expect(global.alert).toHaveBeenCalledWith("PDFの結合中にエラーが発生しました");
		});
		expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
	});

	it("ファイルの順番を変更するとプレビューがリセットされる", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(screen.getByTestId("pdf-preview")).toBeInTheDocument();
		});

		const reorderButton = screen.getByTestId("reorder-0");
		await user.click(reorderButton);

		expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument();
	});

	it("ファイルを削除するとプレビューがリセットされる", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(screen.getByTestId("pdf-preview")).toBeInTheDocument();
		});

		const removeButton = screen.getByTestId("remove-0");
		await user.click(removeButton);

		expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument();
	});

	it("新しいファイルを追加するとプレビューがリセットされる", async () => {
		const user = userEvent.setup();
		const mockBlob = new Blob(["pdf content"], { type: "application/pdf" });

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			blob: async () => mockBlob,
		} as Response);

		render(<PdfMergerPage />);

		const uploader = screen.getByTestId("file-uploader");
		await user.click(uploader);

		const previewButton = screen.getByRole("button", { name: /プレビュー/i });
		await user.click(previewButton);

		await waitFor(() => {
			expect(screen.getByTestId("pdf-preview")).toBeInTheDocument();
		});

		await user.click(uploader);

		expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument();
	});
	describe("アナリティクス", () => {
		const trackedNames = () => vi.mocked(track).mock.calls.map(([name]) => name);

		const mockLinkClick = () => {
			const originalCreateElement = document.createElement.bind(document);
			const click = vi.fn();
			vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
				const element = originalCreateElement(tagName);
				if (tagName.toLowerCase() === "a") {
					(element as HTMLAnchorElement).click = click;
				}
				return element;
			});
			return click;
		};

		const mockMergeResponse = () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
			} as Response);
		};

		it("プレビューで結合すると merge_started → merge_succeeded → preview_opened を 1 回ずつ送る", async () => {
			const user = userEvent.setup();
			mockMergeResponse();
			render(<PdfMergerPage />);

			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByRole("button", { name: /プレビュー/i }));

			await waitFor(() => expect(trackedNames()).toContain("preview_opened"));
			expect(trackedNames()).toEqual(["merge_started", "merge_succeeded", "preview_opened"]);
			expect(track).toHaveBeenCalledWith("merge_started", { count_bucket: "1", size_bucket: "<1MB" });
			expect(track).toHaveBeenCalledWith(
				"merge_succeeded",
				expect.objectContaining({ count_bucket: "1", size_bucket: "<1MB", duration_bucket: "<1s" }),
			);
		});

		it.each([
			[413, "payload_too_large"],
			[500, "server_error"],
		])("サーバーが %i を返したら merge_failed（%s）を送る", async (status, reason) => {
			const user = userEvent.setup();
			vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status } as Response);
			render(<PdfMergerPage />);

			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByRole("button", { name: /プレビュー/i }));

			await waitFor(() => expect(track).toHaveBeenCalledWith("merge_failed", { reason }));
			expect(trackedNames()).not.toContain("preview_opened");
		});

		it("通信に失敗したら merge_failed（network_error）を送る", async () => {
			const user = userEvent.setup();
			vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
			render(<PdfMergerPage />);

			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByRole("button", { name: /プレビュー/i }));

			await waitFor(() => expect(track).toHaveBeenCalledWith("merge_failed", { reason: "network_error" }));
		});

		it("プレビューせずにダウンロードすると download_clicked（previewed: false）を送り、preview_opened は送らない", async () => {
			const user = userEvent.setup();
			mockMergeResponse();
			const click = mockLinkClick();
			render(<PdfMergerPage />);

			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByRole("button", { name: /ダウンロード/i }));

			await waitFor(() => expect(click).toHaveBeenCalled());
			expect(track).toHaveBeenCalledWith("download_clicked", { renamed: false, previewed: false });
			expect(trackedNames()).not.toContain("preview_opened");
		});

		it("プレビューしてからダウンロードすると previewed: true になる", async () => {
			const user = userEvent.setup();
			mockMergeResponse();
			const click = mockLinkClick();
			render(<PdfMergerPage />);

			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByRole("button", { name: /プレビュー/i }));
			await waitFor(() => expect(screen.getByTestId("pdf-preview")).toBeInTheDocument());
			await user.click(screen.getByRole("button", { name: /ダウンロード/i }));

			await waitFor(() => expect(click).toHaveBeenCalled());
			expect(track).toHaveBeenCalledWith("download_clicked", { renamed: false, previewed: true });
		});

		it("ファイルを削除すると file_removed を残りの数とともに送る", async () => {
			const user = userEvent.setup();
			render(<PdfMergerPage />);

			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByTestId("file-uploader"));
			await user.click(screen.getByTestId("remove-0"));

			expect(track).toHaveBeenCalledWith("file_removed", { remaining_bucket: "1" });
		});
	});
});
