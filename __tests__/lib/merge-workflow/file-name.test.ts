import { describe, expect, it } from "vitest";
import {
	defaultFileName,
	FILE_NAME_MAX_LENGTH,
	formatTimestamp,
	toDownloadFileName,
} from "@/lib/merge-workflow/file-name";

// 結合した PDF のファイル名（ADR 0031）

// 2026-03-04 05:06:07（ブラウザのローカル時刻）
const now = new Date(2026, 2, 4, 5, 6, 7);

describe("formatTimestamp", () => {
	it("ローカル時刻を yyyyMMddHHmmss（0 埋め）にする", () => {
		expect(formatTimestamp(now)).toBe("20260304050607");
	});

	it("24 時間制で書く", () => {
		expect(formatTimestamp(new Date(2026, 11, 31, 23, 59, 58))).toBe("20261231235958");
	});
});

describe("defaultFileName", () => {
	it("merged_ + 時刻 + .pdf（決定 2）", () => {
		expect(defaultFileName(now)).toBe("merged_20260304050607.pdf");
	});
});

describe("toDownloadFileName", () => {
	it("空なら既定の名前にする（決定 2）", () => {
		expect(toDownloadFileName("", now)).toBe("merged_20260304050607.pdf");
		expect(toDownloadFileName("   ", now)).toBe("merged_20260304050607.pdf");
	});

	it("入力した名前に .pdf を付ける（決定 3）", () => {
		expect(toDownloadFileName("2026年度_契約書", now)).toBe("2026年度_契約書.pdf");
	});

	it(".pdf で終わっていれば重ねて付けない。大文字でも同じ（決定 3）", () => {
		expect(toDownloadFileName("report.pdf", now)).toBe("report.pdf");
		expect(toDownloadFileName("report.PDF", now)).toBe("report.pdf");
	});

	it("使えない文字を _ に置き換える（決定 4）", () => {
		expect(toDownloadFileName('a/b\\c:d*e?f"g<h>i|j', now)).toBe("a_b_c_d_e_f_g_h_i_j.pdf");
	});

	it("制御文字も _ に置き換える", () => {
		expect(toDownloadFileName("a\tb\nc\u007fd", now)).toBe("a_b_c_d.pdf");
	});

	it("前後の空白と、末尾のドット・空白を取り除く", () => {
		expect(toDownloadFileName("  請求書  ", now)).toBe("請求書.pdf");
		expect(toDownloadFileName("請求書. . ", now)).toBe("請求書.pdf");
		expect(toDownloadFileName("請求書..pdf", now)).toBe("請求書.pdf");
	});

	it("置き換えたあとに名前として残らなければ、既定の名前にする", () => {
		expect(toDownloadFileName(".pdf", now)).toBe("merged_20260304050607.pdf");
		expect(toDownloadFileName("...", now)).toBe("merged_20260304050607.pdf");
	});

	it(`.pdf を除いて ${FILE_NAME_MAX_LENGTH} 文字に切る（決定 4）`, () => {
		const name = toDownloadFileName("あ".repeat(100), now);
		expect(name).toBe(`${"あ".repeat(FILE_NAME_MAX_LENGTH)}.pdf`);
		expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255);
	});

	it("絵文字を途中で切らない", () => {
		const name = toDownloadFileName("😀".repeat(100), now);
		expect(Array.from(name.replace(/\.pdf$/, ""))).toHaveLength(FILE_NAME_MAX_LENGTH);
		expect(name).not.toContain("�");
	});

	it("切ったあとの末尾のドットも取り除く", () => {
		const input = `${"a".repeat(FILE_NAME_MAX_LENGTH - 1)}.b`;
		expect(toDownloadFileName(input, now)).toBe(`${"a".repeat(FILE_NAME_MAX_LENGTH - 1)}.pdf`);
	});
});
