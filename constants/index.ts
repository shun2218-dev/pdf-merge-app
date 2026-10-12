// 出力のファイル名の入力欄の文言（ADR 0031 決定 1・2・7）。Phase 5 の i18n で辞書に移す
export const FILE_NAME_TEXT = {
	label: "ファイル名",
	hint: "末尾の .pdf は自動で付きます。空欄のときは merged_年月日時分秒.pdf（ダウンロードした時刻）になります。使えない文字は _ に置き換えます。",
} as const;

// これを超えたら「端末によっては時間がかかるか失敗します」と出す。結合は止めない（ADR 0002 決定 5）。
// 見直すのは ADR 0029 の件数の基準を満たしたときか、失敗の報告が来たとき（ADR 0030 決定 4）
export const MERGE_WARNING_TOTAL_BYTES = 300 * 1024 * 1024;
export const MERGE_WARNING_FILE_COUNT = 100;
