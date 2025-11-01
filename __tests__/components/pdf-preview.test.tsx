import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PdfPreview } from "@/components/pdf-preview";

// Mock the react-pdf-viewer components
vi.mock("@react-pdf-viewer/core", () => ({
	Viewer: ({ fileUrl, defaultScale }: { fileUrl: string; defaultScale: number }) => (
		<div data-testid="pdf-viewer" data-file-url={fileUrl} data-default-scale={defaultScale}>
			PDF Viewer Mock
		</div>
	),
	Worker: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-worker">{children}</div>,
}));

vi.mock("@react-pdf-viewer/default-layout", () => ({
	defaultLayoutPlugin: vi.fn(() => ({})),
}));

describe("PdfPreview", () => {
	const mockPdfUrl = "https://example.com/test.pdf";
	let originalInnerWidth: number;

	beforeEach(() => {
		originalInnerWidth = window.innerWidth;
	});

	afterEach(() => {
		// Restore original window width
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: originalInnerWidth,
		});
	});

	it("PDFビューアーが正しくレンダリングされる", () => {
		render(<PdfPreview pdfUrl={mockPdfUrl} />);

		expect(screen.getByTestId("pdf-worker")).toBeInTheDocument();
		expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
	});

	it("渡されたPDF URLが正しく表示される", () => {
		render(<PdfPreview pdfUrl={mockPdfUrl} />);

		const viewer = screen.getByTestId("pdf-viewer");
		expect(viewer).toHaveAttribute("data-file-url", mockPdfUrl);
	});

	it("デスクトップサイズ（1024px以上）でズームレベルが1.0に設定される", () => {
		// Set desktop width
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 1920,
		});

		render(<PdfPreview pdfUrl={mockPdfUrl} />);

		const viewer = screen.getByTestId("pdf-viewer");
		expect(viewer).toHaveAttribute("data-default-scale", "1");
	});

	it("タブレットサイズ（768px-1023px）でズームレベルが0.85に設定される", () => {
		// Set tablet width
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 800,
		});

		render(<PdfPreview pdfUrl={mockPdfUrl} />);

		const viewer = screen.getByTestId("pdf-viewer");
		expect(viewer).toHaveAttribute("data-default-scale", "0.85");
	});

	it("モバイルサイズ（768px未満）でズームレベルが計算される", () => {
		// Set mobile width
		const mobileWidth = 375;
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: mobileWidth,
		});

		render(<PdfPreview pdfUrl={mockPdfUrl} />);

		const viewer = screen.getByTestId("pdf-viewer");
		const expectedZoom = mobileWidth / 650;
		expect(viewer).toHaveAttribute("data-default-scale", expectedZoom.toString());
	});

	it("ウィンドウリサイズ時にズームレベルが再計算される", async () => {
		// Start with desktop size
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: 1920,
		});

		const { rerender } = render(<PdfPreview pdfUrl={mockPdfUrl} />);

		let viewer = screen.getByTestId("pdf-viewer");
		expect(viewer).toHaveAttribute("data-default-scale", "1");

		await act(async () => {
			// Simulate resize to mobile
			Object.defineProperty(window, "innerWidth", {
				writable: true,
				configurable: true,
				value: 375,
			});

			// Trigger resize event
			window.dispatchEvent(new Event("resize"));

			// Force re-render to see updated state
			rerender(<PdfPreview pdfUrl={mockPdfUrl} />);
		});

		viewer = screen.getByTestId("pdf-viewer");
		const expectedZoom = 375 / 650;
		expect(viewer).toHaveAttribute("data-default-scale", expectedZoom.toString());
	});

	it("コンテナに正しいスタイルクラスが適用される", () => {
		const { container } = render(<PdfPreview pdfUrl={mockPdfUrl} />);

		const containerDiv = container.firstChild as HTMLElement;
		expect(containerDiv).toHaveClass("h-[800px]");
		expect(containerDiv).toHaveClass("w-full");
		expect(containerDiv).toHaveClass("rounded-lg");
		expect(containerDiv).toHaveClass("border");
		expect(containerDiv).toHaveClass("border-border");
		expect(containerDiv).toHaveClass("bg-background");
	});

	it("異なるPDF URLで再レンダリングされる", () => {
		const { rerender } = render(<PdfPreview pdfUrl={mockPdfUrl} />);

		let viewer = screen.getByTestId("pdf-viewer");
		expect(viewer).toHaveAttribute("data-file-url", mockPdfUrl);

		const newPdfUrl = "https://example.com/new-test.pdf";
		rerender(<PdfPreview pdfUrl={newPdfUrl} />);

		viewer = screen.getByTestId("pdf-viewer");
		expect(viewer).toHaveAttribute("data-file-url", newPdfUrl);
	});
});
