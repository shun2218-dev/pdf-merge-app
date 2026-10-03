// ファイルを送る前の断り（ADR 0027）。ドロップ領域のすぐ下に常に出す。
// サーバーコンポーネントで描き、ブラウザの JS を使わない（決定 3）。結合の画面には props で渡す。
// ADR 0002（結合をブラウザの中に移す）が本番に出たら、ADR 0009 決定 1 の文言に替える

export const UPLOAD_NOTICE = {
	/** サーバーへ送っていること（決定 2） */
	sending: "PDF は結合のためにサーバーへ送信します。サーバーには保存せず、処理のあとに破棄します。",
	/** 送らないでほしいファイル（決定 2。目立つ色で出す） */
	confidential: "社外秘の文書や個人情報を含むファイルは、アップロードしないでください。",
	/** 免責。`/about` ができるまでここに小さく出す（決定 4） */
	liability: "本サービスの利用によって生じた損害について、開発者は責任を負いません。",
} as const;

export function UploadNotice() {
	return (
		<div className="space-y-1 text-sm" data-testid="upload-notice">
			<p className="text-foreground">{UPLOAD_NOTICE.sending}</p>
			<p className="font-semibold text-destructive">{UPLOAD_NOTICE.confidential}</p>
			<p className="text-xs text-muted-foreground">{UPLOAD_NOTICE.liability}</p>
		</div>
	);
}
