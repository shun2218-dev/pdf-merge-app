"use client";

import { Card } from "@/components/ui/card";
import { useMergeWorkflow } from "@/hooks/use-merge-workflow";
import type { MergeError } from "@/lib/merge-workflow/reducer";
import { DropZone } from "./drop-zone";
import { FileList } from "./file-list";
import { MergeActions } from "./merge-actions";
import { MergePreview } from "./merge-preview";

// エラーの文言。ブラウザの alert ダイアログをやめて、画面の中に出す（ADR 0005 決定 7）。見せ方の作り直しは ADR 0009
const ERROR_MESSAGES: Record<MergeError, string> = {
	not_pdf: "PDFファイルのみ選択してください",
	merge_failed: "PDFの結合中にエラーが発生しました",
};

// 結合の画面。useMergeWorkflow を持つ唯一のコンポーネントで、ほかは props だけで描く（ADR 0005 決定 5）
export function MergeWorkspace() {
	const { items, phase, result, error, addFiles, removeFile, moveFile, reorderEnded, openPreview, download } =
		useMergeWorkflow();

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<Card className="p-6">
				<div className="space-y-4">
					<div>
						<h2 className="text-lg font-semibold text-foreground">ステップ 1: PDFファイルをアップロード</h2>
						<p className="text-sm text-muted-foreground">結合したいPDFファイルを選択してください</p>
					</div>
					<DropZone onFiles={addFiles} errorMessage={error === "not_pdf" ? ERROR_MESSAGES.not_pdf : null} />
				</div>
			</Card>

			{items.length > 0 && (
				<>
					<Card className="p-6">
						<div className="space-y-4">
							<div>
								<h2 className="text-lg font-semibold text-foreground">ステップ 2: ファイルの順番を調整</h2>
								<p className="text-sm text-muted-foreground">ドラッグ&ドロップで順番を変更できます</p>
							</div>
							<FileList items={items} onMove={moveFile} onRemove={removeFile} onReorderEnd={reorderEnded} />
						</div>
					</Card>

					<Card className="p-6">
						<div className="space-y-4">
							<div>
								<h2 className="text-lg font-semibold text-foreground">ステップ 3: プレビューとダウンロード</h2>
								<p className="text-sm text-muted-foreground">結合されたPDFを確認してダウンロードします</p>
							</div>
							<MergeActions
								isMerging={phase === "merging"}
								onPreview={openPreview}
								onDownload={download}
								errorMessage={error === "merge_failed" ? ERROR_MESSAGES.merge_failed : null}
							/>
						</div>
					</Card>

					{result && (
						<Card className="p-6">
							<div className="space-y-4">
								<h2 className="text-lg font-semibold text-foreground">プレビュー</h2>
								<MergePreview url={result.url} />
							</div>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
