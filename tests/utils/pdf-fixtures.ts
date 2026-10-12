import { PDFDocument, PDFName } from "pdf-lib";

// テストで使う PDF を、その場で作る（ユニット・E2E・計測で共通）。
// バイナリのファイルをリポジトリに置かずに、パスワード付き・壊れたもの・大きいものを用意する

type PdfOptions = {
	/** ページ数 */
	pages?: number;
	/** ページの幅。結合したあとの並びを、ページの幅で見分けるのに使う */
	width?: number;
	/** この大きさに近づくまで、ページの内容に描画されないコメントを詰める */
	padToBytes?: number;
};

export async function createPdf({ pages = 1, width = 595, padToBytes }: PdfOptions = {}): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	for (let i = 0; i < pages; i++) {
		const page = doc.addPage([width, 842]);
		if (padToBytes && i === 0) {
			// コメント行（% で始まる）は描画されないが、結合（copyPages）ではページと一緒にコピーされるので、
			// 処理の重さは実際の大きさに比例する
			const line = `%${"x".repeat(1022)}\n`;
			const padding = line.repeat(Math.max(1, Math.floor(padToBytes / line.length)));
			page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream(padding)));
		}
	}
	return doc.save({ useObjectStreams: false });
}

/** パスワード付きの PDF。trailer に /Encrypt を持つので、pdf-lib は EncryptedPDFError を投げる */
export async function createEncryptedPdf(): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.addPage();
	doc.context.trailerInfo.Encrypt = doc.context.register(
		doc.context.obj({ Filter: "Standard", V: 2, R: 3, Length: 128, P: -3904 }),
	);
	return doc.save({ useObjectStreams: false });
}

/** ヘッダはあるが、中身が PDF として読めない */
export function createCorruptPdf(): Uint8Array {
	return new TextEncoder().encode("%PDF-1.7\nthis is not a pdf body\n%%EOF\n");
}

/** 拡張子だけ .pdf の、中身はテキストのファイル */
export function createTextFile(): Uint8Array {
	return new TextEncoder().encode("hello, this is plain text\n");
}

/** Uint8Array を、そのバイトだけを持つ ArrayBuffer にする */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}
