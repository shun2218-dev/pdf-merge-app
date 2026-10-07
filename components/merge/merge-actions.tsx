import { Download, Eye, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MergeActionsProps {
	isMerging: boolean;
	/** 結合している間の進捗。1 ファイル終えるごとに進む（ADR 0002 決定 2） */
	progress?: { done: number; total: number } | null;
	onPreview: () => void;
	onDownload: () => void;
	/** ファイルが多い・大きいときの警告。結合は止めない（ADR 0002 決定 5） */
	warningMessage?: string | null;
	/** 結合に失敗したときの文言。表示の作り直しは ADR 0009 */
	errorMessage?: string | null;
}

function mergingLabel(progress: MergeActionsProps["progress"]) {
	return progress ? `処理中... ${progress.done} / ${progress.total}` : "処理中...";
}

// 「プレビュー」と「ダウンロード」。props だけで描く（ADR 0005 決定 5）
export function MergeActions({
	isMerging,
	progress,
	onPreview,
	onDownload,
	warningMessage,
	errorMessage,
}: MergeActionsProps) {
	return (
		<div className="space-y-3">
			{warningMessage && (
				<p className="flex items-start gap-2 text-sm text-foreground">
					<TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
					{warningMessage}
				</p>
			)}
			<div className="flex gap-3">
				<Button onClick={onPreview} disabled={isMerging} variant="outline" className="flex-1 bg-transparent">
					<Eye size={16} className="mr-2" aria-hidden="true" />
					{isMerging ? mergingLabel(progress) : "プレビュー"}
				</Button>
				<Button onClick={onDownload} disabled={isMerging} className="flex-1">
					<Download size={16} className="mr-2" aria-hidden="true" />
					ダウンロード
				</Button>
			</div>
			{errorMessage && (
				<p role="alert" className="text-sm text-destructive-foreground">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
