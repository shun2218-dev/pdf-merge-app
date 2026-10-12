import { useId } from "react";
import { FILE_NAME_TEXT } from "@/constants";
import { FILE_NAME_MAX_LENGTH } from "@/lib/merge-workflow/file-name";

interface FileNameInputProps {
	value: string;
	onChange: (value: string) => void;
}

// 出力のファイル名の入力欄（ADR 0031 決定 1）。props だけで描く（ADR 0005 決定 5）。
// 見えるラベルを付け、既定の名前と置き換えの説明を aria-describedby で読み上げる（ADR 0014）
// 文字はスマートフォンの幅で 16px にする（iOS の Safari は 16px 未満の入力欄に入ると画面を拡大するため）
export function FileNameInput({ value, onChange }: FileNameInputProps) {
	const id = useId();
	const hintId = `${id}-hint`;

	return (
		<div className="space-y-1">
			<label htmlFor={id} className="text-sm font-medium text-foreground">
				{FILE_NAME_TEXT.label}
			</label>
			<div className="flex items-center gap-2">
				<input
					id={id}
					type="text"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					maxLength={FILE_NAME_MAX_LENGTH}
					placeholder="merged_年月日時分秒"
					aria-describedby={hintId}
					autoComplete="off"
					spellCheck={false}
					data-testid="file-name-input"
					className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
				/>
				<span className="text-sm text-muted-foreground" aria-hidden="true">
					.pdf
				</span>
			</div>
			<p id={hintId} className="text-xs text-muted-foreground">
				{FILE_NAME_TEXT.hint}
			</p>
		</div>
	);
}
