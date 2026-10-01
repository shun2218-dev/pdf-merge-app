import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MergeActionsProps {
	isMerging: boolean;
	onPreview: () => void;
	onDownload: () => void;
	/** 結合に失敗したときの文言。表示の作り直しは ADR 0009 */
	errorMessage?: string | null;
}

// 「プレビュー」と「ダウンロード」。props だけで描く（ADR 0005 決定 5）
export function MergeActions({ isMerging, onPreview, onDownload, errorMessage }: MergeActionsProps) {
	return (
		<div className="space-y-3">
			<div className="flex gap-3">
				<Button onClick={onPreview} disabled={isMerging} variant="outline" className="flex-1 bg-transparent">
					<Eye size={16} className="mr-2" aria-hidden="true" />
					{isMerging ? "処理中..." : "プレビュー"}
				</Button>
				<Button onClick={onDownload} disabled={isMerging} className="flex-1">
					<Download size={16} className="mr-2" aria-hidden="true" />
					ダウンロード
				</Button>
			</div>
			{errorMessage && (
				<p role="alert" className="text-sm text-destructive">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
