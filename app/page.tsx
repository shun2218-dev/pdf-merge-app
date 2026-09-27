"use client";

import * as Sentry from "@sentry/nextjs";
import dynamic from "next/dynamic";
import { useState } from "react";
import { FileList } from "@/components/file-list";
import { FileUploader } from "@/components/file-uploader";
import { Header } from "@/components/header";
import { WebVitals } from "@/components/web-vitals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DOWNLOAD_FILE_NAME } from "@/constants";
import { countBucket, durationBucket, sizeBucket, totalSize, track } from "@/lib/analytics";

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
		track("file_removed", { remaining_bucket: countBucket(files.length - 1) });
		setFiles((prev) => prev.filter((_, i) => i !== index));
		setShowPreview(false);
		setMergedPdfUrl(null);
	};

	// 結合した PDF の URL を返す。呼び出し側は state の mergedPdfUrl ではなく、この戻り値を使う
	// （setState の直後に state を読んでも、その時点のレンダーの古い値しか読めないため）
	const handlePreview = async (): Promise<string | null> => {
		if (files.length === 0) return null;

		const mergeProperties = { count_bucket: countBucket(files.length), size_bucket: sizeBucket(totalSize(files)) };
		const startedAt = performance.now();
		track("merge_started", mergeProperties);

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

			// サーバーが返した失敗（500 など）は、サーバー側の Sentry が記録するので、ここでは送らない。
			// 大きすぎるファイル（413）のように利用者の操作が原因のものも、エラーとしては送らない（ADR 0007 決定 4）
			if (!response.ok) {
				track("merge_failed", { reason: response.status === 413 ? "payload_too_large" : "server_error" });
				alert("PDFの結合中にエラーが発生しました");
				return null;
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			track("merge_succeeded", { ...mergeProperties, duration_bucket: durationBucket(performance.now() - startedAt) });

			setMergedPdfUrl(url);
			setShowPreview(true);
			return url;
		} catch (error: unknown) {
			// 通信の失敗や想定外の例外は、コードの前提が崩れたものとして送る（ADR 0007 決定 4）
			track("merge_failed", { reason: "network_error" });
			Sentry.captureException(error);
			alert("PDFの結合中にエラーが発生しました");
			return null;
		} finally {
			setIsProcessing(false);
		}
	};

	const handleOpenPreview = async () => {
		const url = await handlePreview();
		if (url) {
			track("preview_opened", {});
		}
	};

	const handleDownload = async () => {
		// 押した時点でプレビューを見ていたか。プレビューなしで押すと、結合の結果としてプレビューも開くため、先に読む
		const previewed = showPreview;
		const url = mergedPdfUrl ?? (await handlePreview());
		if (!url) return;

		track("download_clicked", { renamed: false, previewed });

		const link = document.createElement("a");
		link.href = url;
		link.download = DOWNLOAD_FILE_NAME;
		link.click();
	};

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<WebVitals />

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
									<FileList
										files={files}
										onReorder={handleReorder}
										onRemove={handleRemove}
										onReorderEnd={() => track("files_reordered", { method: "pointer" })}
									/>
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
											onClick={handleOpenPreview}
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
												<title>{isProcessing ? "Loading..." : "Preview"}</title>
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
												<title>Download</title>
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
