export const DOWNLOAD_FILE_NAME = "merged.pdf";

// これを超えたら「端末によっては時間がかかるか失敗します」と出す。結合は止めない（ADR 0002 決定 5）。
// 見直すのは ADR 0029 の件数の基準を満たしたときか、失敗の報告が来たとき（ADR 0030 決定 4）
export const MERGE_WARNING_TOTAL_BYTES = 300 * 1024 * 1024;
export const MERGE_WARNING_FILE_COUNT = 100;
