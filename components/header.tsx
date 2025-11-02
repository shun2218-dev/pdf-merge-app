export function Header() {
	return (
		<header className="border-b border-border bg-card">
			<div className="container mx-auto px-4 py-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-primary-foreground"
						>
							<title>PDF Merger</title>
							<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" x2="8" y1="13" y2="13" />
							<line x1="16" x2="8" y1="17" y2="17" />
							<line x1="10" x2="8" y1="9" y2="9" />
						</svg>
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
