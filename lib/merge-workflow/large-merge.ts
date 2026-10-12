import { MERGE_WARNING_FILE_COUNT, MERGE_WARNING_TOTAL_BYTES } from "@/constants";
import { totalSize } from "@/lib/analytics";

/** 合計 300MB または 100 ファイルを超えるか。超えたら警告するが、結合は止めない（ADR 0002 決定 5） */
export function isLargeMerge(files: readonly { size: number }[]): boolean {
	return files.length > MERGE_WARNING_FILE_COUNT || totalSize(files) > MERGE_WARNING_TOTAL_BYTES;
}
