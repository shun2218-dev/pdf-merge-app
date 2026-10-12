import type { SkipReason } from "@/lib/pdf/merge";

// 結合のときに飛ばしたファイルの名前と理由（ADR 0030 決定 2）。props だけで描く（ADR 0005 決定 5）。
// 名前は画面に出すだけで、アナリティクス・Sentry には送らない。一覧の行の印は ADR 0009（Phase 4）で作る

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
	encrypted: "パスワード付きのため",
	corrupt: "読み込めないため",
};

interface SkippedFilesProps {
	files: { id: string; name: string; reason: SkipReason }[];
}

// 結合が終わったときに読み上げられるよう、中身がなくても入れ物（aria-live）は出しておく
export function SkippedFiles({ files }: SkippedFilesProps) {
	return (
		<div aria-live="polite" data-testid="skipped-files">
			{files.length > 0 && (
				<div className="space-y-1 text-sm text-foreground">
					<p>次のファイルは結合に含めていません。</p>
					<ul className="list-disc space-y-1 pl-5">
						{files.map((file) => (
							<li key={file.id}>
								<span className="break-all">{file.name}</span>
								<span className="text-muted-foreground">（{SKIP_REASON_LABELS[file.reason]}）</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
