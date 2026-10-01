"use client";

import dynamic from "next/dynamic";

// プレビューのビューアと pdf.js は重いので、プレビューを開くまで読み込まない（ADR 0012 決定 3）
const PdfPreview = dynamic(() => import("@/components/pdf-preview").then((mod) => mod.PdfPreview), {
	ssr: false,
	loading: () => (
		<div className="flex h-[800px] w-full items-center justify-center rounded-lg border border-border bg-background">
			<p className="text-muted-foreground">プレビューを読み込み中...</p>
		</div>
	),
});

interface MergePreviewProps {
	url: string;
}

// 結合した PDF のプレビュー。props だけで描く（ADR 0005 決定 5）。ビューアの置き換えは ADR 0003
export function MergePreview({ url }: MergePreviewProps) {
	return <PdfPreview pdfUrl={url} />;
}
