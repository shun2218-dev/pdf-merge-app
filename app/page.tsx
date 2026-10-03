import { Header } from "@/components/header";
import { MergeWorkspace } from "@/components/merge/merge-workspace";
import { UploadNotice } from "@/components/merge/upload-notice";
import { WebVitals } from "@/components/web-vitals";

// サーバーコンポーネント。結合の画面（状態を持つ部分）は MergeWorkspace に分けた（ADR 0005 決定 5）
export default function PdfMergerPage() {
	return (
		<div className="min-h-screen bg-background">
			<Header />
			<WebVitals />

			<main className="container mx-auto px-4 py-8">
				<MergeWorkspace notice={<UploadNotice />} />
			</main>
		</div>
	);
}
