import { PDFDocument } from "pdf-lib";

// PDF の結合（ADR 0002 決定 1）。DOM にも React にも依存しない純粋な関数にして、Worker からもメインスレッドからも呼ぶ。
// 読めないファイルは飛ばして、残りで結合する（ADR 0030 決定 2）

export type MergeInput = {
	/** 一覧の行の id。飛ばしたファイルを画面で名前に戻すのに使う。ファイル名は受け取らない */
	id: string;
	bytes: ArrayBuffer;
};

/** 飛ばした理由。パスワード付き（encrypted）と、PDF として読めない（corrupt） */
export type SkipReason = "encrypted" | "corrupt";

export type SkippedFile = { id: string; reason: SkipReason };

export type MergeOutput = {
	/** 結合した PDF。読めるファイルが 1 つもなければ null */
	bytes: Uint8Array | null;
	skipped: SkippedFile[];
};

export type MergeProgress = (done: number, total: number) => void;

// PDF の仕様では、ヘッダ（%PDF-）はファイルの先頭 1024 バイトのどこかにあればよい
const HEADER = "%PDF-";
const HEADER_SEARCH_BYTES = 1024;

/** 先頭のバイトに %PDF- があるか。拡張子や MIME ではなく中身で判定する（ADR 0002 決定 4） */
export function hasPdfHeader(bytes: ArrayBuffer): boolean {
	const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, HEADER_SEARCH_BYTES));
	return new TextDecoder("latin1").decode(head).includes(HEADER);
}

async function load(bytes: ArrayBuffer): Promise<PDFDocument | SkipReason> {
	if (!hasPdfHeader(bytes)) return "corrupt";
	try {
		// pdf-lib の EncryptedPDFError は ES5 に変換されていて instanceof で見分けられないので、
		// 暗号化のまま読み込んで isEncrypted で見分ける（ADR 0002 の追記）
		const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
		if (pdf.isEncrypted) return "encrypted";
		// pdf-lib は壊れたオブジェクトを読み飛ばすので、ページが取れなければ読めなかったものとして扱う
		return pdf.getPageCount() > 0 ? pdf : "corrupt";
	} catch {
		return "corrupt";
	}
}

/** 並び順どおりに結合する。1 ファイル終えるごとに onProgress を呼ぶ（ADR 0002 決定 2） */
export async function mergePdfs(inputs: readonly MergeInput[], onProgress?: MergeProgress): Promise<MergeOutput> {
	const merged = await PDFDocument.create();
	const skipped: SkippedFile[] = [];
	let pageCount = 0;

	for (const [index, input] of inputs.entries()) {
		const pdf = await load(input.bytes);
		if (typeof pdf === "string") {
			skipped.push({ id: input.id, reason: pdf });
		} else {
			try {
				// copyPages が途中で失敗しても、merged にはまだ何も足していないので、そのファイルだけを飛ばせる
				const pages = await merged.copyPages(pdf, pdf.getPageIndices());
				for (const page of pages) merged.addPage(page);
				pageCount += pages.length;
			} catch {
				skipped.push({ id: input.id, reason: "corrupt" });
			}
		}
		onProgress?.(index + 1, inputs.length);
	}

	if (pageCount === 0) return { bytes: null, skipped };
	return { bytes: await merged.save(), skipped };
}
