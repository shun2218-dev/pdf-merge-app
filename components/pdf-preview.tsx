"use client";
import { useEffect, useState } from "react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

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
		},
	});

	return (
		<div className="h-[800px] w-full rounded-lg border border-border bg-background">
			<Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
				<Viewer fileUrl={pdfUrl} plugins={[defaultLayoutPluginInstance]} defaultScale={initialZoom} theme="dark" />
			</Worker>
		</div>
	);
}
