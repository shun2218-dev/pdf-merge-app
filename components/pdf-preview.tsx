"use client";
import { type PdfJs, Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { useEffect, useState } from "react";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { DOWNLOAD_FILE_NAME } from "@/constants";

// CVE-2024-4367（pdfjs-dist 4.1.392 以前）の公開されている回避策。細工した PDF のフォントから任意の JavaScript を
// 実行されるのを防ぐため、PDF.js にフォントの描画で eval（new Function）を使わせない（ADR 0003 決定 1）。
// @react-pdf-viewer の型には isEvalSupported がないが、渡した値はそのまま PDF.js の getDocument に届く。
// pdfjs-dist を 4.2.67 以上に上げたら（ADR 0003 決定 2）、この回避策は要らなくなる
const disableEval = (params: PdfJs.GetDocumentParams): PdfJs.GetDocumentParams =>
	({ ...params, isEvalSupported: false }) as PdfJs.GetDocumentParams;

interface PdfPreviewProps {
	pdfUrl: string;
}

export function PdfPreview({ pdfUrl }: PdfPreviewProps) {
	const [initialZoom, setInitialZoom] = useState(1);

	useEffect(() => {
		const calculateZoom = () => {
			const width = window.innerWidth;
			// On mobile/tablet, scale down to fit without horizontal scroll
			if (width < 768) {
				// Mobile: scale to fit with some padding
				setInitialZoom(width / 650);
			} else if (width < 1024) {
				// Tablet: slightly reduced zoom
				setInitialZoom(0.85);
			} else {
				// Desktop: 100% zoom
				setInitialZoom(1);
			}
		};

		calculateZoom();
		window.addEventListener("resize", calculateZoom);
		return () => window.removeEventListener("resize", calculateZoom);
	}, []);

	const defaultLayoutPluginInstance = defaultLayoutPlugin({
		toolbarPlugin: {
			fullScreenPlugin: {
				onEnterFullScreen: (zoom) => {
					zoom(1);
				},
			},
			getFilePlugin: {
				fileNameGenerator: () => DOWNLOAD_FILE_NAME,
			},
		},
	});

	return (
		<div className="h-[800px] w-full rounded-lg border border-border bg-background">
			<Worker workerUrl="/lib/pdf.worker.min.js">
				<Viewer
					fileUrl={pdfUrl}
					plugins={[defaultLayoutPluginInstance]}
					defaultScale={initialZoom}
					theme="dark"
					transformGetDocumentParams={disableEval}
				/>
			</Worker>
		</div>
	);
}
