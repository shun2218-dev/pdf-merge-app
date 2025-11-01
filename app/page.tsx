"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/file-uploader";
import { FileList } from "@/components/file-list";
import { Header } from "@/components/header";
import { SentryFrontendError, useSentry } from "@/hooks/use-sentry";

const PdfPreview = dynamic(() => import("@/components/pdf-preview").then((mod) => mod.PdfPreview), {
	ssr: false,
	loading: () => (
		<div className="flex h-[800px] w-full items-center justify-center rounded-lg border border-border bg-background">
			<p className="text-muted-foreground">プレビューを読み込み中...</p>
		</div>
	),
});

export default function PdfMergerPage() {
	const [files, setFiles] = useState<File[]>([]);
	const [showPreview, setShowPreview] = useState(false);
	const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	useSentry();

	const handleFilesSelected = (newFiles: File[]) => {
		setFiles((prev) => [...prev, ...newFiles]);
		setShowPreview(false);
		setMergedPdfUrl(null);
	};

	const handleReorder = (fromIndex: number, toIndex: number) => {
		const newFiles = [...files];
		const [removed] = newFiles.splice(fromIndex, 1);
		newFiles.splice(toIndex, 0, removed);
		setFiles(newFiles);
		setShowPreview(false);
		setMergedPdfUrl(null);
	};

	const handleRemove = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
		setShowPreview(false);
		setMergedPdfUrl(null);
	};

	const handlePreview = async () => {
		if (files.length === 0) return;

		setIsProcessing(true);
		try {
			const formData = new FormData();
			files.forEach((file) => {
				formData.append("files", file);
			});

			const response = await fetch("/api/merge-pdf", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new SentryFrontendError(
					"SentryFrontendError:PdfMergerPage:handlePreview:PDFの結合中にエラーが発生しました",
				);
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);

			setMergedPdfUrl(url);
			setShowPreview(true);
		} catch (error) {
			alert("PDFの結合中にエラーが発生しました");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDownload = async () => {
		if (mergedPdfUrl) {
			const link = document.createElement("a");
			link.href = mergedPdfUrl;
			link.download = "merged.pdf";
			link.click();
		} else {
			await handlePreview();
			setTimeout(() => {
				if (mergedPdfUrl) {
					const link = document.createElement("a");
					link.href = mergedPdfUrl;
					link.download = "merged.pdf";
					link.click();
				}
			}, 1000);
		}
	};

	return (
		<div className="min-h-screen bg-background">
			<Header />

			<main className="container mx-auto px-4 py-8">
				<div className="mx-auto max-w-5xl space-y-6">
					<Card className="p-6">
						<div className="space-y-4">
							<div>
								<h2 className="text-lg font-semibold text-foreground">ステップ 1: PDFファイルをアップロード</h2>
								<p className="text-sm text-muted-foreground">結合したいPDFファイルを選択してください</p>
							</div>
							<FileUploader onFilesSelected={handleFilesSelected} />
						</div>
					</Card>

					{files.length > 0 && (
						<>
							<Card className="p-6">
								<div className="space-y-4">
									<div>
										<h2 className="text-lg font-semibold text-foreground">ステップ 2: ファイルの順番を調整</h2>
										<p className="text-sm text-muted-foreground">ドラッグ&ドロップで順番を変更できます</p>
									</div>
									<FileList files={files} onReorder={handleReorder} onRemove={handleRemove} />
								</div>
							</Card>

							<Card className="p-6">
								<div className="space-y-4">
									<div>
										<h2 className="text-lg font-semibold text-foreground">ステップ 3: プレビューとダウンロード</h2>
										<p className="text-sm text-muted-foreground">結合されたPDFを確認してダウンロードします</p>
									</div>
									<div className="flex gap-3">
										<Button
											onClick={handlePreview}
											disabled={isProcessing}
											variant="outline"
											className="flex-1 bg-transparent"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="mr-2"
											>
												<title>{isProcessing ? "処理中..." : "プレビュー"}</title>
												<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
												<circle cx="12" cy="12" r="3" />
											</svg>
											{isProcessing ? "処理中..." : "プレビュー"}
										</Button>
										<Button onClick={handleDownload} disabled={isProcessing} className="flex-1">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="mr-2"
											>
												<title>ダウンロード</title>
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
												<polyline points="8 10 12 14 16 10" />
												<line x1="12" x2="12" y1="14" y2="3" />
											</svg>
											ダウンロード
										</Button>
									</div>
								</div>
							</Card>

							{showPreview && mergedPdfUrl && (
								<Card className="p-6">
									<div className="space-y-4">
										<h2 className="text-lg font-semibold text-foreground">プレビュー</h2>
										<PdfPreview pdfUrl={mergedPdfUrl} />
									</div>
								</Card>
							)}
						</>
					)}
				</div>
			</main>
		</div>
	);
}
