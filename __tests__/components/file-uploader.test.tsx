import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FileUploader } from "@/components/file-uploader"

describe("FileUploader", () => {
  it("ファイル選択ボタンが表示される", () => {
    const mockOnFilesSelected = vi.fn()
    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    expect(screen.getByText("ファイルを選択")).toBeInTheDocument()
    expect(screen.getByText("ファイルをドラッグ&ドロップ")).toBeInTheDocument()
  })

  it("ファイル選択ボタンをクリックするとファイル入力がトリガーされる", async () => {
    const mockOnFilesSelected = vi.fn()
    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const button = screen.getByText("ファイルを選択")
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute("accept", "application/pdf")
    expect(input).toHaveAttribute("multiple")
  })

  it("PDFファイルを選択するとonFilesSelectedが呼ばれる", async () => {
    const mockOnFilesSelected = vi.fn()
    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(["dummy content"], "test.pdf", { type: "application/pdf" })

    await userEvent.upload(input, pdfFile)

    expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile])
  })

  it("複数のPDFファイルを選択できる", async () => {
    const mockOnFilesSelected = vi.fn()
    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile1 = new File(["content1"], "test1.pdf", { type: "application/pdf" })
    const pdfFile2 = new File(["content2"], "test2.pdf", { type: "application/pdf" })

    await userEvent.upload(input, [pdfFile1, pdfFile2])

    expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile1, pdfFile2])
  })

  it("PDF以外のファイルを選択するとアラートが表示される", async () => {
    const mockOnFilesSelected = vi.fn()
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})

    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const txtFile = new File(["content"], "test.txt", { type: "text/plain" })

    await userEvent.upload(input, txtFile)

    expect(alertSpy).toHaveBeenCalledWith("PDFファイルのみ選択してください")
    expect(mockOnFilesSelected).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it("ドラッグ&ドロップでPDFファイルを追加できる", () => {
    const mockOnFilesSelected = vi.fn()
    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const dropZone = screen.getByText("ファイルをドラッグ&ドロップ").closest("div")
    const pdfFile = new File(["content"], "test.pdf", { type: "application/pdf" })

    const dropEvent = new Event("drop", { bubbles: true }) as any
    dropEvent.dataTransfer = {
      files: [pdfFile],
    }

    fireEvent.drop(dropZone!, dropEvent)

    expect(mockOnFilesSelected).toHaveBeenCalledWith([pdfFile])
  })

  it("ドラッグオーバー時にデフォルト動作を防ぐ", () => {
    const mockOnFilesSelected = vi.fn()
    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const dropZone = screen.getByText("ファイルをドラッグ&ドロップ").closest("div")
    const dragOverEvent = new Event("dragover", { bubbles: true }) as any
    dragOverEvent.preventDefault = vi.fn()

    fireEvent.dragOver(dropZone!, dragOverEvent)

    expect(dragOverEvent.preventDefault).toHaveBeenCalled()
  })

  it("ドロップ時にPDF以外のファイルを拒否する", () => {
    const mockOnFilesSelected = vi.fn()
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})

    render(<FileUploader onFilesSelected={mockOnFilesSelected} />)

    const dropZone = screen.getByText("ファイルをドラッグ&ドロップ").closest("div")
    const txtFile = new File(["content"], "test.txt", { type: "text/plain" })

    const dropEvent = new Event("drop", { bubbles: true }) as any
    dropEvent.dataTransfer = {
      files: [txtFile],
    }
    dropEvent.preventDefault = vi.fn()

    fireEvent.drop(dropZone!, dropEvent)

    expect(alertSpy).toHaveBeenCalledWith("PDFファイルのみ選択してください")
    expect(mockOnFilesSelected).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })
})
