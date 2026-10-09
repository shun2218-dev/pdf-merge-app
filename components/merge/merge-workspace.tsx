"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { useMergeWorkflow } from "@/hooks/use-merge-workflow";
import { isLargeMerge } from "@/lib/merge-workflow/large-merge";
import type { MergeError, MergeItem } from "@/lib/merge-workflow/reducer";
import type { SkippedFile } from "@/lib/pdf/merge";
import { DropZone } from "./drop-zone";
import { FileList } from "./file-list";
import { MergeActions } from "./merge-actions";
import { MergePreview } from "./merge-preview";
import { SkippedFiles } from "./skipped-files";

// エラーの文言。ブラウザの alert ダイアログをやめて、画面の中に出す（ADR 0005 決定 7）。見せ方の作り直しは ADR 0009
const ERROR_MESSAGES: Record<MergeError, string> = {
	not_pdf: "PDFファイルのみ選択してください",
	merge_failed: "PDFの結合中にエラーが発生しました",
	no_valid_files: "結合できる PDF がありませんでした",
};

const LARGE_MERGE_WARNING =
	"ファイルの数か合計の大きさが大きいため、端末によっては時間がかかるか、失敗することがあります。";

// 飛ばしたファイルの id を、一覧の名前に戻す。一覧が変わると skipped は捨てるので、必ず見つかる
function withNames(skipped: SkippedFile[], items: MergeItem[]) {
	return skipped.flatMap(({ id, reason }) => {
		const item = items.find((candidate) => candidate.id === id);
		return item ? [{ id, reason, name: item.file.name }] : [];
	});
}

// 結合の画面。useMergeWorkflow を持つ唯一のコンポーネントで、ほかは props だけで描く（ADR 0005 決定 5）。
// notice はドロップ領域の下に出す断り。サーバーコンポーネントで描いたものを受け取る（ADR 0027 決定 3）
export function MergeWorkspace({ notice }: { notice?: ReactNode }) {
	const {
		items,
		phase,
		result,
		error,
		progress,
		skipped,
		addFiles,
		removeFile,
		moveFile,
		reorderEnded,
		openPreview,
		download,
	} = useMergeWorkflow();
	const mergeError = error === "merge_failed" || error === "no_valid_files" ? ERROR_MESSAGES[error] : null;

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<Card className="p-6">
				<div className="space-y-4">
					<div>
						<h2 className="text-lg font-semibold text-foreground">ステップ 1: PDFファイルをアップロード</h2>
						<p className="text-sm text-muted-foreground">結合したいPDFファイルを選択してください</p>
					</div>
					<DropZone onFiles={addFiles} errorMessage={error === "not_pdf" ? ERROR_MESSAGES.not_pdf : null} />
					{notice}
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
								progress={progress}
								onPreview={openPreview}
								onDownload={download}
								warningMessage={isLargeMerge(items.map((item) => item.file)) ? LARGE_MERGE_WARNING : null}
								errorMessage={mergeError}
							/>
							<SkippedFiles files={withNames(skipped, items)} />
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
