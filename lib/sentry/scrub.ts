// Sentry に送るイベントから、ファイル名を取り除く（ADR 0007 決定 1）。
// ファイル名は「2026_源泉徴収票_山田.pdf」のように個人情報を含みうる。
// どこに紛れ込むか（例外のメッセージ・パンくず・extra）を網羅的に追うより、
// イベント全体の文字列を走査して置き換えるほうが漏れにくい。

export const FILE_PLACEHOLDER = "[file]";

// 空白・引用符・パスの区切り・山括弧以外が続いたあとに `.pdf` で終わるもの。
// URL やパスの中の最後の要素だけを置き換えるため、区切り文字は含めない。
const PDF_FILE_NAME = /[^\s"'`<>/\\]+\.pdf\b/gi;

// 循環参照や極端に深いオブジェクトで止まらないようにする上限
const MAX_DEPTH = 20;

export function scrubFileNames(value: string): string {
	return value.replace(PDF_FILE_NAME, FILE_PLACEHOLDER);
}

export function scrubDeep<T>(value: T, depth = 0): T {
	if (depth > MAX_DEPTH) return value;
	if (typeof value === "string") return scrubFileNames(value) as T;
	if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1)) as T;
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			result[key] = scrubDeep(item, depth + 1);
		}
		return result as T;
	}
	return value;
}
