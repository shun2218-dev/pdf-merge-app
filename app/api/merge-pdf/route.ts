import { type NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const files = formData.getAll("files") as File[];

		if (files.length === 0) {
			return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
		}

		// Create a new PDF document
		const mergedPdf = await PDFDocument.create();

		// Process each file
		for (const file of files) {
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await PDFDocument.load(arrayBuffer);
			const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
			copiedPages.forEach((page) => {
				mergedPdf.addPage(page);
			});
		}

		// Save the merged PDF
		const mergedPdfBytes = await mergedPdf.save();

		const pdfBuffer = Buffer.from(mergedPdfBytes);

		// Return the merged PDF as a response
		return new NextResponse(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'attachment; filename="merged.pdf"',
			},
		});
	} catch (error) {
		console.error("[v0] Error merging PDFs:", error);
		return NextResponse.json({ error: "PDFの結合中にエラーが発生しました" }, { status: 500 });
	}
}
