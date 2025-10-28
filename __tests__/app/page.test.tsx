"use client"

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PdfMergerPage from "@/app/page"

// Mock child components
vi.mock("@/components/header", () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

vi.mock("@/components/file-uploader", () => ({
  FileUploader: ({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) => (
    <button
      data-testid="file-uploader"
      onClick={() => {
        const mockFile = new File(["content"], "test.pdf", { type: "application/pdf" })
        onFilesSelected([mockFile])
      }}
    >
      Upload Files
    </button>
  ),
}))

vi.mock("@/components/file-list", () => ({
  FileList: ({ files, onReorder, onRemove }: any) => (
    <div data-testid="file-list">
      {files.map((file: File, index: number) => (
        <div key={index} data-testid={`file-item-${index}`}>
          {file.name}
          <button data-testid={`remove-${index}`} onClick={() => onRemove(index)}>
            Remove
          </button>
          <button data-testid={`reorder-${index}`} onClick={() => onReorder(index, 0)}>
            Reorder
          </button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock("@/components/pdf-preview", () => ({
  PdfPreview: ({ pdfUrl }: { pdfUrl: string }) => <div data-testid="pdf-preview">Preview: {pdfUrl}</div>,
}))

// Mock fetch
global.fetch = vi.fn()

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url")
global.URL.revokeObjectURL = vi.fn()

// Mock alert
global.alert = vi.fn()

describe("PdfMergerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("初期状態で3つのステップカードのうち、ステップ1のみが表示される", () => {
    render(<PdfMergerPage />)

    expect(screen.getByText("ステップ 1: PDFファイルをアップロード")).toBeInTheDocument()
    expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument()
    expect(screen.queryByText("ステップ 3: プレビューとダウンロード")).not.toBeInTheDocument()
  })

  it("Headerコンポーネントが表示される", () => {
    render(<PdfMergerPage />)

    expect(screen.getByTestId("header")).toBeInTheDocument()
  })

  it("FileUploaderコンポーネントが表示される", () => {
    render(<PdfMergerPage />)

    expect(screen.getByTestId("file-uploader")).toBeInTheDocument()
  })

  it("ファイルをアップロードするとステップ2と3が表示される", async () => {
    const user = userEvent.setup()
    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    expect(screen.getByText("ステップ 2: ファイルの順番を調整")).toBeInTheDocument()
    expect(screen.getByText("ステップ 3: プレビューとダウンロード")).toBeInTheDocument()
  })

  it("ファイルをアップロードするとFileListが表示される", async () => {
    const user = userEvent.setup()
    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    expect(screen.getByTestId("file-list")).toBeInTheDocument()
    expect(screen.getByText("test.pdf")).toBeInTheDocument()
  })

  it("複数回ファイルをアップロードすると既存のファイルに追加される", async () => {
    const user = userEvent.setup()
    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)
    await user.click(uploader)

    const fileItems = screen.getAllByTestId(/^file-item-/)
    expect(fileItems).toHaveLength(2)
  })

  it("ファイルを削除するとリストから削除される", async () => {
    const user = userEvent.setup()
    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)
    await user.click(uploader)

    const removeButton = screen.getByTestId("remove-0")
    await user.click(removeButton)

    const fileItems = screen.getAllByTestId(/^file-item-/)
    expect(fileItems).toHaveLength(1)
  })

  it("すべてのファイルを削除するとステップ2と3が非表示になる", async () => {
    const user = userEvent.setup()
    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const removeButton = screen.getByTestId("remove-0")
    await user.click(removeButton)

    expect(screen.queryByText("ステップ 2: ファイルの順番を調整")).not.toBeInTheDocument()
    expect(screen.queryByText("ステップ 3: プレビューとダウンロード")).not.toBeInTheDocument()
  })

  it("ファイルの順番を変更できる", async () => {
    const user = userEvent.setup()
    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const reorderButton = screen.getByTestId("reorder-0")
    await user.click(reorderButton)

    // Reorder should work without errors
    expect(screen.getByTestId("file-list")).toBeInTheDocument()
  })

  it("プレビューボタンをクリックするとAPI呼び出しが行われる", async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(["pdf content"], { type: "application/pdf" })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/merge-pdf",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      )
    })
  })

  it("プレビューボタンをクリックするとプレビューが表示される", async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(["pdf content"], { type: "application/pdf" })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByTestId("pdf-preview")).toBeInTheDocument()
      expect(screen.getByText(/Preview: blob:mock-url/)).toBeInTheDocument()
    })
  })

  it("処理中はボタンが無効化される", async () => {
    const user = userEvent.setup()

    // Make fetch hang to keep processing state
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    const downloadButton = screen.getByRole("button", { name: /ダウンロード/i })

    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /処理中/i })).toBeDisabled()
      expect(downloadButton).toBeDisabled()
    })
  })

  it("API呼び出しが失敗した場合にアラートが表示される", async () => {
    const user = userEvent.setup()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith("PDFの結合中にエラーが発生しました")
    })
  })

  it("ダウンロードボタンをクリックするとファイルがダウンロードされる（プレビュー済み）", async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(["pdf content"], { type: "application/pdf" })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    const mockLink = document.createElement("a")
    mockLink.click = vi.fn()
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockLink)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByTestId("pdf-preview")).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole("button", { name: /ダウンロード/i })
    await user.click(downloadButton)

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toBe("merged.pdf")
    expect(mockLink.href).toBe("blob:mock-url")

    createElementSpy.mockRestore()
  })

  it("ファイルの順番を変更するとプレビューがリセットされる", async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(["pdf content"], { type: "application/pdf" })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByTestId("pdf-preview")).toBeInTheDocument()
    })

    const reorderButton = screen.getByTestId("reorder-0")
    await user.click(reorderButton)

    expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument()
  })

  it("ファイルを削除するとプレビューがリセットされる", async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(["pdf content"], { type: "application/pdf" })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByTestId("pdf-preview")).toBeInTheDocument()
    })

    const removeButton = screen.getByTestId("remove-0")
    await user.click(removeButton)

    expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument()
  })

  it("新しいファイルを追加するとプレビューがリセットされる", async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(["pdf content"], { type: "application/pdf" })

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response)

    render(<PdfMergerPage />)

    const uploader = screen.getByTestId("file-uploader")
    await user.click(uploader)

    const previewButton = screen.getByRole("button", { name: /プレビュー/i })
    await user.click(previewButton)

    await waitFor(() => {
      expect(screen.getByTestId("pdf-preview")).toBeInTheDocument()
    })

    await user.click(uploader)

    expect(screen.queryByTestId("pdf-preview")).not.toBeInTheDocument()
  })
})
