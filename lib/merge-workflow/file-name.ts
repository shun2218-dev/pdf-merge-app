// 結合した PDF のファイル名（ADR 0031）。入力欄の値から、ダウンロードの名前を作る純粋な関数

/** 既定の名前の先頭（決定 2） */
const DEFAULT_PREFIX = "merged_";

/** `.pdf` を除いた名前の長さの上限（決定 4）。日本語でも UTF-8 で 240 バイトに収まる */
export const FILE_NAME_MAX_LENGTH = 80;

// Windows で使えない文字と制御文字（決定 4）
// biome-ignore lint/suspicious/noControlCharactersInRegex: ファイル名から制御文字を取り除くため
const INVALID_CHARACTERS = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;
const PDF_EXTENSION = /\.pdf$/i;

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** ブラウザのローカル時刻を yyyyMMddHHmmss（24 時間制・0 埋め）にする */
export function formatTimestamp(date: Date): string {
	return [
		pad(date.getFullYear(), 4),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join("");
}

/** 既定の名前。merged_ + ダウンロードを押したときの時刻（決定 2） */
export function defaultFileName(now: Date): string {
	return `${DEFAULT_PREFIX}${formatTimestamp(now)}.pdf`;
}

// 前後の空白と、末尾のドット・空白を取り除く（Windows で使えないため）
const trimName = (name: string) => name.trim().replace(/[.\s]+$/, "");

/**
 * 入力欄の値からダウンロードの名前を作る（決定 2〜4）。
 * 使えない文字は _ に置き換え、80 文字に切り、.pdf を付ける。空なら既定の名前にする
 */
export function toDownloadFileName(input: string, now: Date): string {
	const base = trimName(trimName(input).replace(PDF_EXTENSION, "").replace(INVALID_CHARACTERS, "_"));
	// サロゲートペア（絵文字など）の途中で切らないよう、文字（コードポイント）で数える
	const truncated = trimName(Array.from(base).slice(0, FILE_NAME_MAX_LENGTH).join(""));
	return truncated ? `${truncated}.pdf` : defaultFileName(now);
}
