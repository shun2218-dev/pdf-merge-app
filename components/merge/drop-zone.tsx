"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
	/** 選んだ / ドロップしたファイル。PDF かどうかの判定は呼び出し側（use-merge-workflow）で行う */
	onFiles: (files: File[], source: "picker" | "drop") => void;
	/** 受け付けなかったときの文言。表示の作り直しは ADR 0009 */
	errorMessage?: string | null;
}

// ファイルを受け取る領域。props だけで描く（ADR 0005 決定 5）
export function DropZone({ onFiles, errorMessage }: DropZoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onFiles(Array.from(e.target.files || []), "picker");
		// 同じファイルを選び直しても change が起きるよう、選択を空に戻す
		e.target.value = "";
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		onFiles(Array.from(e.dataTransfer.files), "drop");
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
	};

	return (
		<div className="space-y-3">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: This div is intentionally kept static because an alternative method for keyboard operation (file selection button) is provided separately. */}
			<div
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
				data-testid="dropzone"
			>
				<div className="flex flex-col items-center gap-4">
					<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
						<Upload size={32} className="text-primary" aria-hidden="true" />
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
			{errorMessage && (
				<p role="alert" className="text-sm text-destructive-foreground">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
