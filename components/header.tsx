import { FileText } from "lucide-react";

// ページの見出し。注意事項のモーダルとそれを開くボタンは、ドロップ領域の下の断りに置き換えた（ADR 0027 決定 1）。
// 状態を持たないので、サーバーコンポーネントのまま描く
export function Header() {
	return (
		<header className="border-b border-border bg-card">
			<div className="container mx-auto flex items-center justify-between px-4 py-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
						<FileText size={24} className="text-primary-foreground" aria-hidden="true" />
					</div>
					<div>
						<h1 className="text-2xl font-semibold text-foreground">PDF Merger</h1>
						<p className="text-sm text-muted-foreground">複数のPDFファイルを1つに結合</p>
					</div>
				</div>
			</div>
		</header>
	);
}
