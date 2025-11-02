import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility function", () => {
	it("複数のクラス名を正しく結合できる", () => {
		const result = cn("class1", "class2", "class3");
		expect(result).toBe("class1 class2 class3");
	});

	it("条件付きクラス名が正しく処理される", () => {
		const isActive = true;
		const isDisabled = false;
		const result = cn("base", isActive && "active", isDisabled && "disabled");
		expect(result).toBe("base active");
	});

	it("オブジェクト形式の条件付きクラス名が正しく処理される", () => {
		const result = cn({
			"base-class": true,
			"active-class": true,
			"disabled-class": false,
		});
		expect(result).toBe("base-class active-class");
	});

	it("配列形式のクラス名が正しく処理される", () => {
		const result = cn(["class1", "class2"], "class3");
		expect(result).toBe("class1 class2 class3");
	});

	it("Tailwindの競合クラスが正しくマージされる（後勝ち）", () => {
		// twMergeは同じプロパティの場合、後のクラスを優先する
		const result = cn("px-2", "px-4");
		expect(result).toBe("px-4");
	});

	it("Tailwindの異なるプロパティは両方保持される", () => {
		const result = cn("px-2", "py-4");
		expect(result).toBe("px-2 py-4");
	});

	it("複雑なTailwindクラスの競合が正しく解決される", () => {
		const result = cn("text-sm", "text-lg", "font-bold");
		expect(result).toBe("text-lg font-bold");
	});

	it("undefinedとnullが無視される", () => {
		const result = cn("class1", undefined, "class2", null, "class3");
		expect(result).toBe("class1 class2 class3");
	});

	it("空文字列が無視される", () => {
		const result = cn("class1", "", "class2");
		expect(result).toBe("class1 class2");
	});

	it("引数なしの場合は空文字列を返す", () => {
		const result = cn();
		expect(result).toBe("");
	});

	it("複雑な組み合わせが正しく処理される", () => {
		const isActive = true;
		const result = cn(
			"base-class",
			{
				"active-class": isActive,
				"disabled-class": false,
			},
			["array-class-1", "array-class-2"],
			isActive && "conditional-class",
			"px-2",
			"px-4", // これが優先される
		);
		expect(result).toContain("base-class");
		expect(result).toContain("active-class");
		expect(result).toContain("array-class-1");
		expect(result).toContain("array-class-2");
		expect(result).toContain("conditional-class");
		expect(result).toContain("px-4");
		expect(result).not.toContain("px-2"); // 競合するので除外される
		expect(result).not.toContain("disabled-class");
	});

	it("レスポンシブクラスが正しく処理される", () => {
		const result = cn("text-sm", "md:text-base", "lg:text-lg");
		expect(result).toBe("text-sm md:text-base lg:text-lg");
	});

	it("同じレスポンシブプレフィックスの競合が解決される", () => {
		const result = cn("md:text-sm", "md:text-lg");
		expect(result).toBe("md:text-lg");
	});
});
