import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/merge-pdf/route"
import { NextRequest } from "next/server"
import { PDFDocument } from "pdf-lib"

let mockPdfBytes: Uint8Array;
let mockMergedPdf: any;

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    create: vi.fn(),
    load: vi.fn(),
  },
}));

describe("POST /api/merge-pdf", () => {  
  beforeEach(() => {
    mockPdfBytes = new Uint8Array([1, 2, 3, 4, 5]);

    mockMergedPdf = {
      copyPages: vi.fn().mockResolvedValue([{ id: "mockPage" }]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(mockPdfBytes),
    };

    vi.mocked(PDFDocument.create).mockResolvedValue(mockMergedPdf);
    
    vi.mocked(PDFDocument.load).mockResolvedValue({
      getPageIndices: vi.fn().mockReturnValue([0]),
    } as unknown as PDFDocument);
    
    vi.clearAllMocks();
  });

  it("PDFファイルが指定された場合、正しく結合して 200 OK を返す", async () => {    
    const buffer1 = new Uint8Array([1]);
    const buffer2 = new Uint8Array([1, 2]);
    const mockPdfFile1 = new File([buffer1], "test1.pdf", { type: "application/pdf" });
    const mockPdfFile2 = new File([buffer2], "test2.pdf", { type: "application/pdf" });

    Object.defineProperty(mockPdfFile1, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(buffer1.buffer as ArrayBuffer),
    });
    Object.defineProperty(mockPdfFile2, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(buffer2.buffer as ArrayBuffer),
    });

    const mockFormData = new FormData();
    mockFormData.append("files", mockPdfFile1);
    mockFormData.append("files", mockPdfFile2);
    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData)
    } as unknown as NextRequest;

    const response = await POST(request);
    const arrayBuffer = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="merged.pdf"');
    
    expect(PDFDocument.load).toHaveBeenCalledTimes(2);
    expect(mockMergedPdf.addPage).toHaveBeenCalledTimes(2);
    
    expect(new Uint8Array(arrayBuffer)).toEqual(mockPdfBytes);
  });

  it("ファイルが0個の場合に400エラーを返す", async () => {
    const mockFormData = new FormData();
    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData)
    } as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("ファイルが選択されていません");
  });

  it("処理中に pdf-lib がエラーを起こした場合に500エラーを返す", async () => {
    vi.mocked(PDFDocument.load).mockRejectedValue(new Error("Mocked PDF load error"));

    const buffer1 = new Uint8Array([1]);
    const mockPdfFile1 = new File([buffer1], "test1.pdf", { type: "application/pdf" });
    Object.defineProperty(mockPdfFile1, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(buffer1.buffer as ArrayBuffer),
    });
    const mockFormData = new FormData();
    mockFormData.append("files", mockPdfFile1);
    const request = {
      formData: vi.fn().mockResolvedValue(mockFormData)
    } as unknown as NextRequest;
    
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("PDFの結合中にエラーが発生しました");
  });
});