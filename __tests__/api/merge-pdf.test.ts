import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/merge-pdf/route"
import { NextRequest } from "next/server"
import { PDFDocument } from "pdf-lib"

// Mock pdf-lib
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    create: vi.fn(),
    load: vi.fn(),
  },
}))

describe("POST /api/merge-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ファイルが0個の場合に400エラーを返す", async () => {
    const formData = new FormData()
    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("ファイルが選択されていません")
  })

  it("複数のPDFファイルを正しく結合できる", async () => {
    // Mock PDF documents
    const mockPage1 = { id: "page1" }
    const mockPage2 = { id: "page2" }
    const mockPage3 = { id: "page3" }

    const mockPdf1 = {
      getPageIndices: vi.fn().mockReturnValue([0]),
    }

    const mockPdf2 = {
      getPageIndices: vi.fn().mockReturnValue([0]),
    }

    const mockMergedPdf = {
      copyPages: vi.fn().mockResolvedValueOnce([mockPage1]).mockResolvedValueOnce([mockPage2, mockPage3]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    }

    vi.mocked(PDFDocument.create).mockResolvedValue(mockMergedPdf as any)
    vi.mocked(PDFDocument.load)
      .mockResolvedValueOnce(mockPdf1 as any)
      .mockResolvedValueOnce(mockPdf2 as any)

    // Create mock files
    const file1 = new File(["pdf1"], "test1.pdf", { type: "application/pdf" })
    const file2 = new File(["pdf2"], "test2.pdf", { type: "application/pdf" })

    const formData = new FormData()
    formData.append("files", file1)
    formData.append("files", file2)

    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(PDFDocument.create).toHaveBeenCalledTimes(1)
    expect(PDFDocument.load).toHaveBeenCalledTimes(2)
    expect(mockMergedPdf.copyPages).toHaveBeenCalledTimes(2)
    expect(mockMergedPdf.addPage).toHaveBeenCalledTimes(3) // 1 page from pdf1, 2 pages from pdf2
    expect(mockMergedPdf.save).toHaveBeenCalledTimes(1)
  })

  it("結合されたPDFが正しいContent-Typeで返される", async () => {
    const mockMergedPdf = {
      copyPages: vi.fn().mockResolvedValue([{ id: "page1" }]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    }

    const mockPdf = {
      getPageIndices: vi.fn().mockReturnValue([0]),
    }

    vi.mocked(PDFDocument.create).mockResolvedValue(mockMergedPdf as any)
    vi.mocked(PDFDocument.load).mockResolvedValue(mockPdf as any)

    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" })
    const formData = new FormData()
    formData.append("files", file)

    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="merged.pdf"')
  })

  it("結合されたPDFのバイナリデータが正しく返される", async () => {
    const mockPdfBytes = new Uint8Array([1, 2, 3, 4, 5])

    const mockMergedPdf = {
      copyPages: vi.fn().mockResolvedValue([{ id: "page1" }]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(mockPdfBytes),
    }

    const mockPdf = {
      getPageIndices: vi.fn().mockReturnValue([0]),
    }

    vi.mocked(PDFDocument.create).mockResolvedValue(mockMergedPdf as any)
    vi.mocked(PDFDocument.load).mockResolvedValue(mockPdf as any)

    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" })
    const formData = new FormData()
    formData.append("files", file)

    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(request)
    const arrayBuffer = await response.arrayBuffer()
    const responseBytes = new Uint8Array(arrayBuffer)

    expect(responseBytes).toEqual(mockPdfBytes)
  })

  it("エラー時に500エラーを返す", async () => {
    vi.mocked(PDFDocument.create).mockRejectedValue(new Error("PDF creation failed"))

    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" })
    const formData = new FormData()
    formData.append("files", file)

    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe("PDFの結合中にエラーが発生しました")
  })

  it("PDFのページが正しい順序で追加される", async () => {
    const addPageCalls: any[] = []

    const mockMergedPdf = {
      copyPages: vi
        .fn()
        .mockResolvedValueOnce([{ id: "page1" }, { id: "page2" }])
        .mockResolvedValueOnce([{ id: "page3" }]),
      addPage: vi.fn((page) => addPageCalls.push(page)),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    }

    const mockPdf1 = {
      getPageIndices: vi.fn().mockReturnValue([0, 1]),
    }

    const mockPdf2 = {
      getPageIndices: vi.fn().mockReturnValue([0]),
    }

    vi.mocked(PDFDocument.create).mockResolvedValue(mockMergedPdf as any)
    vi.mocked(PDFDocument.load)
      .mockResolvedValueOnce(mockPdf1 as any)
      .mockResolvedValueOnce(mockPdf2 as any)

    const file1 = new File(["pdf1"], "test1.pdf", { type: "application/pdf" })
    const file2 = new File(["pdf2"], "test2.pdf", { type: "application/pdf" })

    const formData = new FormData()
    formData.append("files", file1)
    formData.append("files", file2)

    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    await POST(request)

    // Verify pages were added in correct order
    expect(addPageCalls).toHaveLength(3)
    expect(addPageCalls[0]).toEqual({ id: "page1" })
    expect(addPageCalls[1]).toEqual({ id: "page2" })
    expect(addPageCalls[2]).toEqual({ id: "page3" })
  })

  it("単一のPDFファイルでも正しく処理される", async () => {
    const mockMergedPdf = {
      copyPages: vi.fn().mockResolvedValue([{ id: "page1" }]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    }

    const mockPdf = {
      getPageIndices: vi.fn().mockReturnValue([0]),
    }

    vi.mocked(PDFDocument.create).mockResolvedValue(mockMergedPdf as any)
    vi.mocked(PDFDocument.load).mockResolvedValue(mockPdf as any)

    const file = new File(["pdf"], "test.pdf", { type: "application/pdf" })
    const formData = new FormData()
    formData.append("files", file)

    const request = new NextRequest("http://localhost:3000/api/merge-pdf", {
      method: "POST",
      body: formData,
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockMergedPdf.addPage).toHaveBeenCalledTimes(1)
  })
})
