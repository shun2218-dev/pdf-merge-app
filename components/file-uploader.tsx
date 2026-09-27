"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { countBucket, sizeBucket, totalSize, track } from "@/lib/analytics";

interface FileUploaderProps {
	onFilesSelected: (files: File[]) => void;
}

// PDF だけを受け付け、受け付けた / 断った結果をアナリティクスで数える（ADR 0011）
function acceptPdfFiles(files: File[], source: "picker" | "drop"): File[] | null {
	const pdfFiles = files.filter((file) => file.type === "application/pdf");

	if (pdfFiles.length !== files.length) {
		track("files_rejected", { reason: "not_pdf", count_bucket: countBucket(files.length - pdfFiles.length) });
		return null;
	}

	if (pdfFiles.length > 0) {
		track("files_added", {
			source,
			count_bucket: countBucket(pdfFiles.length),
			size_bucket: sizeBucket(totalSize(pdfFiles)),
		});
	}
	return pdfFiles;
}

export function FileUploader({ onFilesSelected }: FileUploaderProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	// PDF 以外を選んだのは利用者の操作の結果で、コードの不具合ではないので Sentry には送らない（ADR 0007 決定 4）
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const pdfFiles = acceptPdfFiles(Array.from(e.target.files || []), "picker");

		if (!pdfFiles) {
			alert("PDFファイルのみ選択してください");
			return;
		}

		if (pdfFiles.length > 0) {
			onFilesSelected(pdfFiles);
		}

		if (inputRef.current) {
			inputRef.current.value = "";
		}
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const pdfFiles = acceptPdfFiles(Array.from(e.dataTransfer.files), "drop");

		if (!pdfFiles) {
			alert("PDFファイルのみ選択してください");
			return;
		}

		if (pdfFiles.length > 0) {
			onFilesSelected(pdfFiles);
		}
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: This div is intentionally kept static because an alternative method for keyboard operation (file selection button) is provided separately.
		<div
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
			data-testid="dropzone"
		>
			<div className="flex flex-col items-center gap-4">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-primary"
					>
						<title>Drag and Drop File</title>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" x2="12" y1="3" y2="15" />
					</svg>
				</div>
				<div className="space-y-2">
					<p className="text-sm font-medium text-foreground">ファイルをドラッグ&ドロップ</p>
					<p className="text-xs text-muted-foreground">または</p>
				</div>
				<Button onClick={() => inputRef.current?.click()} variant="default">
					ファイルを選択
				</Button>
				<input
					ref={inputRef}
					type="file"
					accept="application/pdf"
					multiple
					onChange={handleFileChange}
					className="hidden"
					data-testid="file-input"
				/>
			</div>
		</div>
	);
}
