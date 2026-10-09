import { LockKeyhole } from "lucide-react";

// ファイルの扱いの断り（ADR 0027）。ドロップ領域のすぐ下に常に出す。
// サーバーコンポーネントで描き、ブラウザの JS を使わない（決定 3）。結合の画面には props で渡す。
// 結合をブラウザの中に移した（ADR 0002）ので、ADR 0009 決定 1 の文言にした（ADR 0030 決定 6）

export const UPLOAD_NOTICE = {
	/** ファイルを端末の外へ送らないこと（ADR 0009 決定 1。鍵のアイコン付き） */
	local: "ファイルはこの端末の中だけで処理され、外部へ送信されません。",
	/** 免責。`/about` ができるまでここに小さく出す（ADR 0027 決定 4） */
	liability: "本サービスの利用によって生じた損害について、開発者は責任を負いません。",
} as const;

export function UploadNotice() {
	return (
		<div className="space-y-1 text-sm" data-testid="upload-notice">
			<p className="flex items-center gap-2 text-foreground">
				<LockKeyhole size={16} className="shrink-0" aria-hidden="true" />
				{UPLOAD_NOTICE.local}
			</p>
			<p className="text-xs text-muted-foreground">{UPLOAD_NOTICE.liability}</p>
		</div>
	);
}
