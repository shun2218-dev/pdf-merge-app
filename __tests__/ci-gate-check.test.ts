import { expect, it } from "vitest";

// ADR 0006 の DoD の確認用。テストが落ちたら CI が赤になることを確かめるためだけのもので、マージしない
it("わざと失敗する", () => {
	expect(1).toBe(2);
});
