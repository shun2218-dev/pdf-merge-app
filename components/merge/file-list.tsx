"use client";

import { FileText, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MergeItem } from "@/lib/merge-workflow/reducer";

interface FileListProps {
	items: MergeItem[];
	onMove: (from: number, to: number) => void;
	onRemove: (id: string) => void;
	/** ドラッグを終えて、並びが変わっていたときに 1 回だけ呼ばれる（アナリティクス用。ADR 0011） */
	onReorderEnd?: () => void;
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 結合するファイルの一覧と並び替え。props だけで描く（ADR 0005 決定 5）。並び替えの UI の作り直しは ADR 0010
export function FileList({ items, onMove, onRemove, onReorderEnd }: FileListProps) {
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	// ドラッグ中は dragover のたびに並びが変わるので、ドラッグ 1 回で並びが変わったかだけを覚えておく
	const [hasReordered, setHasReordered] = useState(false);

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;

		onMove(draggedIndex, index);
		setDraggedIndex(index);
		setHasReordered(true);
	};

	const handleDragEnd = () => {
		if (hasReordered) {
			onReorderEnd?.();
		}
		setDraggedIndex(null);
		setHasReordered(false);
	};

	return (
		<div className="space-y-2" data-testid="file-list">
			{items.map(({ id, file }, index) => (
				// biome-ignore lint/a11y/noStaticElementInteractions: This div is intentionally kept static because an alternative method for keyboard operation is provided separately.
				// biome-ignore lint/a11y/useAriaPropsSupportedByRole: Because of need to add it
				<div
					key={id}
					draggable
					onDragStart={() => setDraggedIndex(index)}
					onDragOver={(e) => handleDragOver(e, index)}
					onDragEnd={handleDragEnd}
					className={`flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all ${
						draggedIndex === index ? "opacity-50" : "opacity-100"
					} hover:border-primary/50 hover:bg-accent/50`}
					aria-label="File List"
					data-testid={`file-item-container-${file.name}`}
				>
					<div className="cursor-grab text-muted-foreground hover:text-foreground" data-testid="drag-handle">
						<GripVertical size={20} aria-hidden="true" />
					</div>
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<FileText size={20} className="text-primary" aria-hidden="true" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium text-foreground" data-testid="file-name">
							{file.name}
						</p>
						<p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
					</div>
					<div className="flex items-center gap-2">
						<span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
							{index + 1}
						</span>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onRemove(id)}
							className="h-8 w-8 text-muted-foreground hover:text-destructive-foreground"
							aria-label="削除する"
						>
							<X size={16} aria-hidden="true" />
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
