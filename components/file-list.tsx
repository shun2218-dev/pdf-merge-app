"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FileListProps {
	files: File[];
	onReorder: (fromIndex: number, toIndex: number) => void;
	onRemove: (index: number) => void;
}

export function FileList({ files, onReorder, onRemove }: FileListProps) {
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

	const handleDragStart = (index: number) => {
		setDraggedIndex(index);
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;

		onReorder(draggedIndex, index);
		setDraggedIndex(index);
	};

	const handleDragEnd = () => {
		setDraggedIndex(null);
	};

	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<div className="space-y-2" data-testid="file-list">
			{files.map((file, index) => (
				// biome-ignore lint/a11y/noStaticElementInteractions: This div is intentionally kept static because an alternative method for keyboard operation is provided separately.
				// biome-ignore lint/a11y/useAriaPropsSupportedByRole: Because of need to add it
				<div
					key={`${file.name}-${index}`}
					draggable
					onDragStart={() => handleDragStart(index)}
					onDragOver={(e) => handleDragOver(e, index)}
					onDragEnd={handleDragEnd}
					className={`flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all ${
						draggedIndex === index ? "opacity-50" : "opacity-100"
					} hover:border-primary/50 hover:bg-accent/50`}
					aria-label="File List"
					data-testid={`file-item-container-${file.name}`}
				>
					<div className="cursor-grab text-muted-foreground hover:text-foreground" data-testid="drag-handle">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<title>Reorder File</title>
							<circle cx="9" cy="12" r="1" />
							<circle cx="9" cy="5" r="1" />
							<circle cx="9" cy="19" r="1" />
							<circle cx="15" cy="12" r="1" />
							<circle cx="15" cy="5" r="1" />
							<circle cx="15" cy="19" r="1" />
						</svg>
					</div>
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-primary"
						>
							<title>PDF File</title>
							<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" x2="8" y1="13" y2="13" />
							<line x1="16" x2="8" y1="17" y2="17" />
							<line x1="10" x2="8" y1="9" y2="9" />
						</svg>
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
							onClick={() => onRemove(index)}
							className="h-8 w-8 text-muted-foreground hover:text-destructive"
							aria-label="削除する"
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
							>
								<title>Delete</title>
								<path d="M18 6 6 18" />
								<path d="m6 6 12 12" />
							</svg>
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
