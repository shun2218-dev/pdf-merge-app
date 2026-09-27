import type { CountBucket, DurationBucket, SizeBucket } from "./events";

// 数や大きさを区間に丸める。個々のファイルを特定できないようにするため（ADR 0011 決定 3）

const MB = 1024 * 1024;

export function countBucket(count: number): CountBucket {
	if (count <= 0) return "0";
	if (count === 1) return "1";
	if (count === 2) return "2";
	if (count <= 5) return "3-5";
	if (count <= 10) return "6-10";
	if (count <= 30) return "11-30";
	return "31+";
}

export function sizeBucket(bytes: number): SizeBucket {
	if (bytes < 1 * MB) return "<1MB";
	if (bytes < 5 * MB) return "1-5MB";
	if (bytes < 20 * MB) return "5-20MB";
	if (bytes < 100 * MB) return "20-100MB";
	return "100MB+";
}

export function durationBucket(milliseconds: number): DurationBucket {
	if (milliseconds < 1_000) return "<1s";
	if (milliseconds < 3_000) return "1-3s";
	if (milliseconds < 10_000) return "3-10s";
	if (milliseconds < 30_000) return "10-30s";
	return "30s+";
}

export function totalSize(files: readonly { size: number }[]): number {
	return files.reduce((sum, file) => sum + file.size, 0);
}
